# Secure Hedera Testnet Voting

This project implements the voting exercise from the course materials as a Solidity smart contract on Hedera Testnet.

It supports:

- topics defined by the constructor;
- one vote per eligible account;
- an admin-managed list of accounts that cannot vote;
- voting from multiple Hedera accounts;
- printable vote totals, leader, and tie status;
- deployment and contract calls through the Hedera JavaScript SDK.

The test brief says "a whitelist with accounts that are not allowed to vote." Because the listed accounts are prohibited, the code treats this as a **blocklist/denylist**.

## How the lectures informed the design

| Course concept | Implementation |
|---|---|
| Public/private keys and wallets | Testnet private keys sign locally; keys are kept in the ignored `.env` file |
| Testnet for application development | All clients use `Client.forTestnet()` |
| EVM smart contracts change ledger state through transactions | Deployment, voting, and blocklist updates are transactions |
| `struct` and array for proposals | Each `Topic` stores a name and vote count in `Topic[]` |
| Constructor-defined proposals | Topic names are supplied to the constructor |
| `msg.sender` identifies a user | Voting state is stored against the calling EVM address |
| Admin is the contract creator | The constructor stores `msg.sender` as immutable `admin` |
| `enum` and `mapping` secure voting | Every address is `Eligible`, `Blocked`, or `Voted` |
| One vote per user | `vote()` changes the caller's state to `Voted` |
| Find the winner by iteration | `winner()` loops through topics and reports ties |
| Hedera contract workflow | Compile, connect, deploy bytecode, call functions, read receipts/results |

This is our own course-based architecture. It deliberately does not add an unrelated multi-phase voting lifecycle.

## Project files

- `contracts/SecureTopicVoting.sol` - Solidity contract
- `compile.js` - compiles the contract to a Hedera-compatible artifact
- `deploy.js` - deploys bytecode and constructor arguments
- `voting.js` - accounts, voting, results, address checking, and blocklist commands
- `artifacts/SecureTopicVoting.json` - generated ABI and bytecode
- `.env.example` - safe configuration template
- `.env` - real local credentials and active contract ID; ignored by Git

## 1. Install dependencies

Open PowerShell in the project directory:

```powershell
cd "C:\Users\lewta\Desktop\OIP\Blockchain\OIP-DLT"
npm install
```

## 2. Configure Testnet accounts

If `.env` does not exist, create it from the template:

```powershell
Copy-Item .env.example .env
```

Do not run that command if `.env` already contains your account details. Edit `.env`, not `.env.example`:

```dotenv
# Account 1: deployer, admin, and voter
HEDERA_OPERATOR_ID=0.0.YOUR_ACCOUNT_1_ID
HEDERA_OPERATOR_KEY=YOUR_ACCOUNT_1_PRIVATE_KEY
HEDERA_OPERATOR_KEY_TYPE=ECDSA

# Account 2: another voter
HEDERA_OPERATOR_ID_2=0.0.YOUR_ACCOUNT_2_ID
HEDERA_OPERATOR_KEY_2=YOUR_ACCOUNT_2_PRIVATE_KEY
HEDERA_OPERATOR_KEY_TYPE_2=ECDSA

# Replace this after deployment
VOTING_CONTRACT_ID=0.0.YOUR_CONTRACT_ID
```

Additional accounts use matching suffixes such as `_3`, `_4`, and so on. The scripts discover them automatically.

Raw hexadecimal private keys default to ECDSA. Set the type to `ED25519` only for an ED25519 account. DER-encoded keys are detected automatically.

The public key does not need to be placed in `.env`. Hedera stores it to verify signatures. The private key signs locally and is not sent to the network.

Never commit or submit `.env`. Confirm that Git ignores it:

```powershell
git check-ignore .env
```

Expected output:

```text
.env
```

## 3. Check configured accounts

```powershell
npm run accounts
```

Example:

```text
Found 2 account(s):
  1: 0.0.10103391
     expected Solidity address: 0x...
  2: 0.0.10142648
     expected Solidity address: 0x...
```

The address is important because Solidity uses `msg.sender`. For an ECDSA Hedera account, its alias EVM address can differ from the long-zero address derived from `0.0.x`. The script derives the expected caller address locally without printing the private key.

## 4. Compile

```powershell
npm run compile
```

Expected output:

```text
Compiled artifacts/SecureTopicVoting.json
```

The compiler uses the Paris EVM target for Hedera compatibility.

## 5. Deploy

Deploy with three topics and no initially blocked addresses:

```powershell
node deploy.js artifacts/SecureTopicVoting.json `
  --gas 3000000 `
  --arg-string-array "Blockchain,Artificial Intelligence,Cybersecurity" `
  --arg-address-array
```

PowerShell rules:

- each backtick must be the final character on its line;
- leave `--arg-address-array` without a value for an empty array;
- do not pass `""` as the empty value.

### Change the voting topics

Edit only the comma-separated value supplied to `--arg-string-array`. For example:

```powershell
node deploy.js artifacts/SecureTopicVoting.json `
  --gas 3000000 `
  --arg-string-array "Bitcoin,Ethereum,Hedera,Solana" `
  --arg-address-array
```

This creates the following indexes:

| Index | Topic |
|---:|---|
| `0` | Bitcoin |
| `1` | Ethereum |
| `2` | Hedera |
| `3` | Solana |

Separate topics with commas and do not put a comma inside a topic name. Topic names cannot be empty. Topics are fixed permanently in each deployed contract, so changing them requires a new deployment and a new `VOTING_CONTRACT_ID`. Changing only the topic names does **not** require recompiling the unchanged Solidity source.

Expected output:

```text
Deploying SecureTopicVoting.json to Hedera Testnet ...
  gas:  3000000

✅ Contract deployed successfully
  Contract ID : 0.0.xxxxxxxx
  EVM address : 0x...
  HashScan    : https://hashscan.io/testnet/contract/0.0.xxxxxxxx
```

Copy the new Contract ID into `.env`:

```dotenv
VOTING_CONTRACT_ID=0.0.xxxxxxxx
```

The earlier contract `0.0.10148185` remains on Testnet but contains the previous code. Deploy a new contract for this revised version.

## 6. Verify `msg.sender`

Check the exact address the contract sees for each account:

```powershell
npm run whoami -- --account 1
npm run whoami -- --account 2
```

Expected format:

```text
Contract sees caller as: 0x...
Locally derived address:  0x...
```

The two addresses should match. This prevents blocking the wrong address form.

## 7. Optional blocklist setup

Account 1 is the admin. Block configured account 2 using its correctly derived EVM alias:

```powershell
node voting.js block-account 2 --account 1
```

Meaning:

- `block-account 2` targets the second configured account in `.env`;
- `--account 1` makes account 1 sign the transaction as contract admin.

Expected successful output resembles:

```text
Using account 1: 0.0.10103391
Target account 2: 0.0.10142648
Target Solidity address: 0x...
setBlocked: SUCCESS
HashScan: https://hashscan.io/testnet/transaction/...
```

Unblock it:

```powershell
node voting.js unblock-account 2 --account 1
```

For an address not configured in `.env`, supply its exact 20-byte EVM address:

```powershell
node voting.js block 0x0123456789abcdef0123456789abcdef01234567 --account 1
```

Do not supply a `0.0.x` ID to `block`; it may convert to a different address from the ECDSA caller alias.

An account whose state is already `Voted` cannot be blocked or changed back to eligible. This preserves the completed vote record.

If account 2 is blocked, this vote must revert with `CONTRACT_REVERT_EXECUTED`, caused by the contract's `AccountBlocked()` error:

```powershell
npm run vote -- 1 --account 2
```

Only the deploying account is the admin. The following command deliberately uses account 2 as the signer and must fail with `OnlyAdmin()`:

```powershell
node voting.js block-account 1 --account 2
```

### Block addresses during deployment

The constructor can also receive initially blocked addresses. Supply exact EVM addresses, not numeric Hedera IDs:

```powershell
node deploy.js artifacts/SecureTopicVoting.json `
  --gas 3000000 `
  --arg-string-array "Blockchain,Artificial Intelligence,Cybersecurity" `
  --arg-address-array "0x0123456789abcdef0123456789abcdef01234567"
```

For configured `.env` accounts, deploying with an empty array and then using `block-account N` is safer because the script derives the correct ECDSA alias automatically.

## 8. Vote from multiple accounts

Topic indexes follow their constructor order:

| Index | Topic |
|---:|---|
| `0` | Blockchain |
| `1` | Artificial Intelligence |
| `2` | Cybersecurity |

Account 1 votes for Blockchain:

```powershell
npm run vote -- 0 --account 1
```

Account 2 votes for Artificial Intelligence:

```powershell
npm run vote -- 1 --account 2
```

Expected successful transaction status:

```text
vote: SUCCESS
HashScan: https://hashscan.io/testnet/transaction/...
```

The script prints the updated results after each successful vote.

## 9. Print results

```powershell
npm run results
```

Example after the two votes above:

```text
Voting results - contract 0.0.xxxxxxxx
  total votes: 2

  0: Blockchain - 1 vote(s)
  1: Artificial Intelligence - 1 vote(s)
  2: Cybersecurity - 0 vote(s)

  Leader: Blockchain [0] with 1 vote(s) (tie; lowest index shown)
```

`winner()` follows the lecture's iteration approach. When multiple topics share the highest count, it returns the lowest-index leader and sets `tied` to `true`.

## 10. Demonstrate security

Use fresh deployments when tests need clean account states.

| Test | Command idea | Expected contract error |
|---|---|---|
| Duplicate vote | Run the same vote account twice | `AlreadyVoted` |
| Blocked voter | Block account 2, then vote as account 2 | `AccountBlocked` |
| Invalid topic | Vote for index `99` | `InvalidTopic` |
| Non-admin block attempt | Add `--account 2` to a block command | `OnlyAdmin` |
| Empty topic list | Deploy without topics | `EmptyTopics` |
| Empty topic name | Include an empty constructor topic | `EmptyTopicName` |

The Hedera SDK may display `CONTRACT_REVERT_EXECUTED` instead of decoding the custom Solidity error name. The attempted test determines which safeguard was triggered.

## Repeat the experiment

Contract state on the ledger is persistent: completed votes cannot be reset. For every clean run:

1. Compile if the Solidity source changed.
2. Deploy a new contract.
3. Replace `VOTING_CONTRACT_ID` in `.env`.
4. Optionally configure the blocklist.
5. Vote with different `--account N` values.
6. Print the results.
7. Save the Contract ID, HashScan links, commands, and output as evidence.

## Suggested submission evidence

- successful compilation;
- successful deployment and HashScan contract link;
- multiple account IDs without private keys;
- `whoami` address verification;
- one successful vote per eligible account;
- printed totals and winner/tie status;
- rejected duplicate vote;
- rejected blocked-account vote;
- rejected non-admin blocklist change.

## Troubleshooting

### `No complete Hedera accounts found in .env`

Each account requires a matching ID and key, such as `HEDERA_OPERATOR_ID_2` and `HEDERA_OPERATOR_KEY_2`.

### `INVALID_SIGNATURE`

The private key does not match the account ID or its configured key type is wrong. Check ECDSA versus ED25519 without sharing the key.

### `Missing value for array argument`

For an empty initial blocklist, end the deployment command with `--arg-address-array` and no value.

### `CONTRACT_REVERT_EXECUTED`

The smart contract intentionally rejected the transaction. Check the caller, voter state, topic index, and whether the caller is the admin.

### Results show an old experiment

Replace `VOTING_CONTRACT_ID` in `.env` with the newest deployed Contract ID.
