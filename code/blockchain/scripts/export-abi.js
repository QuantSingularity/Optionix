const fs = require("fs");
const path = require("path");

/**
 * Extracts the ABI for each primary contract from Hardhat's build artifacts
 * into a flat, frontend-friendly ./abi directory. Run after `npm run compile`.
 */
const CONTRACTS = [
  { source: "OptionsContract.sol", name: "EnhancedOptionsContract" },
  { source: "FuturesContract.sol", name: "EnhancedFuturesContract" },
];

const artifactsDir = path.join(__dirname, "..", "artifacts", "contracts");
const outDir = path.join(__dirname, "..", "abi");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

for (const { source, name } of CONTRACTS) {
  const artifactPath = path.join(artifactsDir, source, `${name}.json`);
  if (!fs.existsSync(artifactPath)) {
    console.error(`Missing artifact for ${name}. Run "npm run compile" first.`);
    process.exitCode = 1;
    continue;
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const outPath = path.join(outDir, `${name}.abi.json`);
  fs.writeFileSync(outPath, JSON.stringify(artifact.abi, null, 2));
  console.log(`Wrote ${outPath}`);
}
