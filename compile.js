import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const sourcePath = path.resolve("contracts/SecureTopicVoting.sol");
const source = fs.readFileSync(sourcePath, "utf8");
const input = {
  language: "Solidity",
  sources: { "SecureTopicVoting.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    // Hedera supports Paris bytecode reliably; this avoids newer PUSH0 opcodes.
    evmVersion: "paris",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors ?? []).filter((item) => item.severity === "error");
if (errors.length) {
  for (const error of errors) console.error(error.formattedMessage);
  process.exit(1);
}

const contract = output.contracts["SecureTopicVoting.sol"].SecureTopicVoting;
fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync(
  "artifacts/SecureTopicVoting.json",
  JSON.stringify({ contractName: "SecureTopicVoting", abi: contract.abi, bytecode: contract.evm.bytecode.object }, null, 2),
);
console.log("Compiled artifacts/SecureTopicVoting.json");
