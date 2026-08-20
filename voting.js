import "dotenv/config";
import {
  AccountId,
  Client,
  ContractCallQuery,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  Hbar,
  PrivateKey,
} from "@hashgraph/sdk";

function required(name) {
  // Fail early with a useful message instead of producing an SDK error later.
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

function accountConfig(accountNumber = "1") {
  // Account 1 has no suffix; later accounts use _2, _3, and so on.
  const suffix = accountNumber === "1" ? "" : `_${accountNumber}`;
  return {
    number: accountNumber,
    id: required(`HEDERA_OPERATOR_ID${suffix}`),
    rawKey: required(`HEDERA_OPERATOR_KEY${suffix}`),
    keyType: process.env[`HEDERA_OPERATOR_KEY_TYPE${suffix}`],
  };
}

function parsePrivateKey(raw, configuredType) {
  // Accept the formats supplied by Hedera Portal: DER or raw hexadecimal.
  const trimmed = raw.trim();
  const value = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
  if (value.length !== 64 && PrivateKey.isDerKey(value)) {
    return PrivateKey.fromStringDer(value);
  }
  const type = (configuredType ?? "ECDSA").toUpperCase();
  if (type === "ECDSA") return PrivateKey.fromStringECDSA(value);
  if (type === "ED25519") return PrivateKey.fromStringED25519(value);
  throw new Error("key type must be ECDSA or ED25519");
}

function clientFor(accountNumber = "1") {
  const account = accountConfig(accountNumber);
  // Each selected account gets its own Testnet client and signs its own calls.
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(account.id),
    parsePrivateKey(account.rawKey, account.keyType),
  );
  client.setDefaultMaxTransactionFee(new Hbar(20));
  return { client, account };
}

/** Return the address Solidity is expected to see for a configured account. */
function callerAddress(accountNumber) {
  const account = accountConfig(accountNumber);
  const key = parsePrivateKey(account.rawKey, account.keyType);
  try {
    // ECDSA accounts call contracts through the EVM alias derived from this key.
    return `0x${key.publicKey.toEvmAddress()}`;
  } catch {
    // ED25519 accounts do not have an ECDSA alias; use their long-zero address.
    return `0x${AccountId.fromString(account.id).toSolidityAddress()}`;
  }
}

/** Discover complete numbered ID/key pairs without exposing private keys. */
function discoverAccounts() {
  const accounts = [];
  for (const [name, id] of Object.entries(process.env)) {
    const match = /^HEDERA_OPERATOR_ID(?:_(\d+))?$/.exec(name);
    if (!match || !id) continue;
    const number = match[1] ?? "1";
    const suffix = number === "1" ? "" : `_${number}`;
    const keyName = `HEDERA_OPERATOR_KEY${suffix}`;
    if (!process.env[keyName]) {
      throw new Error(`${name} exists but matching ${keyName} is missing`);
    }
    accounts.push({ number, id });
  }
  return accounts.sort((a, b) => Number(a.number) - Number(b.number));
}

async function query(client, contractId, method, params, gas = 100_000, senderId) {
  // ContractCallQuery reads state and does not create a consensus transaction.
  const request = new ContractCallQuery()
    .setContractId(contractId)
    .setGas(gas)
    .setFunction(method, params);
  if (senderId) request.setSenderAccountId(AccountId.fromString(senderId));
  return request.execute(client);
}

async function execute(client, contractId, method, params) {
  // ContractExecuteTransaction changes state and therefore needs a signature.
  const response = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(250_000)
    .setFunction(method, params)
    .execute(client);
  const receipt = await response.getReceipt(client);
  console.log(`${method}: ${receipt.status}`);
  console.log(`HashScan: https://hashscan.io/testnet/transaction/${response.transactionId}`);
}

async function printResults(client, contractId) {
  // First discover the array length, then query every topic by index.
  const totalResult = await query(client, contractId, "totalVotes");
  const countResult = await query(client, contractId, "topicCount");
  const total = totalResult.getUint256(0).toString();
  const count = Number(countResult.getUint256(0));

  console.log(`\nVoting results - contract ${contractId}`);
  console.log(`  total votes: ${total}\n`);
  for (let i = 0; i < count; i += 1) {
    const result = await query(
      client,
      contractId,
      "getTopic",
      new ContractFunctionParameters().addUint256(i),
    );
    console.log(`  ${i}: ${result.getString(0)} - ${result.getUint256(1)} vote(s)`);
  }

  // winner() returns four ABI values: id, name, vote count, and tie flag.
  const winnerResult = await query(client, contractId, "winner", undefined, 200_000);
  const winningId = winnerResult.getUint256(0).toString();
  const winningName = winnerResult.getString(1);
  const winningVotes = winnerResult.getUint256(2).toString();
  const tied = winnerResult.getBool(3);
  console.log(`\n  Leader: ${winningName} [${winningId}] with ${winningVotes} vote(s)${tied ? " (tie; lowest index shown)" : ""}`);
}

function parseAccountFlag(cliArgs) {
  // Remove --account N before interpreting the remaining action arguments.
  const index = cliArgs.indexOf("--account");
  const number = index === -1 ? "1" : cliArgs[index + 1];
  if (!number || !/^\d+$/.test(number) || number === "0") {
    throw new Error("--account must be a positive number, such as 1, 2, or 3");
  }
  if (index !== -1) cliArgs.splice(index, 2);
  return number;
}

function requireEvmAddress(value) {
  // Numeric 0.0.x IDs are rejected here because an ECDSA alias may differ.
  if (!/^0x[0-9a-fA-F]{40}$/.test(value ?? "")) {
    throw new Error(
      "Use a 20-byte 0x EVM address. For a configured voter, prefer block-account N.",
    );
  }
  return value;
}

async function main() {
  const cliArgs = process.argv.slice(2);

  // The accounts action is local: it never submits a Hedera transaction.
  if (cliArgs[0] === "accounts") {
    const accounts = discoverAccounts();
    if (accounts.length === 0) throw new Error("No complete Hedera accounts found in .env");
    console.log(`Found ${accounts.length} account(s):`);
    for (const account of accounts) {
      console.log(`  ${account.number}: ${account.id}`);
      console.log(`     expected Solidity address: ${callerAddress(account.number)}`);
    }
    return;
  }

  const accountNumber = parseAccountFlag(cliArgs);
  const [action, ...args] = cliArgs;
  // All remaining actions operate on the current deployment stored in .env.
  const contractId = ContractId.fromString(required("VOTING_CONTRACT_ID"));
  const { client, account } = clientFor(accountNumber);
  console.log(`Using account ${account.number}: ${account.id}`);

  try {
    if (action === "vote") {
      // Convert the user's topic index and reject negative/non-integer values.
      const topicId = Number(args[0]);
      if (!Number.isSafeInteger(topicId) || topicId < 0) {
        throw new Error("Usage: node voting.js vote <topic-id> [--account N]");
      }
      await execute(
        client,
        contractId,
        "vote",
        new ContractFunctionParameters().addUint256(topicId),
      );
    } else if (action === "block-account" || action === "unblock-account") {
      // Resolve a configured account to the same EVM address Solidity checks.
      const targetNumber = args[0];
      if (!/^\d+$/.test(targetNumber ?? "")) {
        throw new Error(`Usage: node voting.js ${action} <configured-account-number>`);
      }
      const address = callerAddress(targetNumber);
      console.log(`Target account ${targetNumber}: ${accountConfig(targetNumber).id}`);
      console.log(`Target Solidity address: ${address}`);
      await execute(
        client,
        contractId,
        "setBlocked",
        new ContractFunctionParameters()
          .addAddress(address)
          .addBool(action === "block-account"),
      );
    } else if (action === "block" || action === "unblock") {
      const address = requireEvmAddress(args[0]);
      await execute(
        client,
        contractId,
        "setBlocked",
        new ContractFunctionParameters().addAddress(address).addBool(action === "block"),
      );
    } else if (action === "whoami") {
      // Set the query sender so whoAmI() can report this account's msg.sender.
      const result = await query(client, contractId, "whoAmI", undefined, 100_000, account.id);
      console.log(`Contract sees caller as: 0x${result.getAddress(0)}`);
      console.log(`Locally derived address:  ${callerAddress(accountNumber)}`);
    } else if (action !== "results") {
      throw new Error(
        "Usage: accounts | results | whoami [--account N] | " +
          "vote <topic-id> [--account N] | block-account <N> | unblock-account <N> | " +
          "block <0x-address> | unblock <0x-address>",
      );
    }

    if (["vote", "results"].includes(action)) {
      await printResults(client, contractId);
    }
  } finally {
    // Always release network resources, including after a rejected transaction.
    client.close();
  }
}

main().catch((error) => {
  console.error(`Voting error: ${error.message ?? error}`);
  process.exit(1);
});
