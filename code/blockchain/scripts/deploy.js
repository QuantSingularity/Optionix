const { ethers } = require("hardhat");

/**
 * Deploys EnhancedOptionsContract and EnhancedFuturesContract.
 *
 * Configure via environment variables (all optional, sane defaults below):
 *   OPTIONS_MAX_LEVERAGE, OPTIONS_MARGIN_REQUIREMENT, OPTIONS_MAX_DAILY_VOLUME
 *   FUTURES_INITIAL_MARGIN_RATE, FUTURES_MAINTENANCE_MARGIN_RATE,
 *   FUTURES_MAX_LEVERAGE, FUTURES_MAX_DAILY_VOLUME, INSURANCE_FUND_ADDRESS
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network <network>
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const OptionsContract = await ethers.getContractFactory(
    "EnhancedOptionsContract",
  );
  const options = await OptionsContract.deploy(
    process.env.OPTIONS_MAX_LEVERAGE || 10,
    process.env.OPTIONS_MARGIN_REQUIREMENT || 10,
    ethers.parseEther(process.env.OPTIONS_MAX_DAILY_VOLUME || "1000000"),
  );
  await options.waitForDeployment();
  console.log(
    "EnhancedOptionsContract deployed to:",
    await options.getAddress(),
  );

  const insuranceFundAddress =
    process.env.INSURANCE_FUND_ADDRESS || deployer.address;

  const FuturesContract = await ethers.getContractFactory(
    "EnhancedFuturesContract",
  );
  const futures = await FuturesContract.deploy(
    process.env.FUTURES_INITIAL_MARGIN_RATE || 10,
    process.env.FUTURES_MAINTENANCE_MARGIN_RATE || 5,
    process.env.FUTURES_MAX_LEVERAGE || 20,
    ethers.parseEther(process.env.FUTURES_MAX_DAILY_VOLUME || "1000000"),
    insuranceFundAddress,
  );
  await futures.waitForDeployment();
  console.log(
    "EnhancedFuturesContract deployed to:",
    await futures.getAddress(),
  );

  console.log("\nNext steps:");
  console.log(
    "  - Call addPriceOracle(asset, chainlinkFeed, heartbeat) on both contracts for each asset you support.",
  );
  console.log(
    "  - Call registerUser(...) to KYC-approve trading accounts before they can deposit or trade.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
