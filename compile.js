import fs from "node:fs";
import path from "node:path";
import solc from "solc";

// Resolve the Solidity source relative to the project directory and load it.
const sourcePath = path.resolve("contracts/SecureTopicVoting.sol");
const source = fs.readFileSync(sourcePath, "utf8");

// solc uses the standard JSON compiler input format. We request only the ABI
// (how clients call the contract) and creation bytecode (what Hedera deploys).
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

// Compile in memory. solc returns JSON even when compilation reports errors.
const output = JSON.parse(solc.compile(JSON.stringify(input)));

// Warnings do not prevent deployment; actual compiler errors must stop here.
const errors = (output.errors ?? []).filter((item) => item.severity === "error");
if (errors.length) {
  for (const error of errors) console.error(error.formattedMessage);
  process.exit(1);
}

// Select our named contract from solc's source/contract output hierarchy.
const contract = output.contracts["SecureTopicVoting.sol"].SecureTopicVoting;

// The artifact is generated output consumed by deploy.js; do not edit it by hand.
fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync(
  "artifacts/SecureTopicVoting.json",
  JSON.stringify({ contractName: "SecureTopicVoting", abi: contract.abi, bytecode: contract.evm.bytecode.object }, null, 2),
);
console.log("Compiled artifacts/SecureTopicVoting.json");
