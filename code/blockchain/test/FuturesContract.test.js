const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const ZERO_ADDRESS = ethers.ZeroAddress;

describe("EnhancedFuturesContract", function () {
  async function deployFixture() {
    const [admin, insuranceFund, trader, liquidator, other] =
      await ethers.getSigners();

    const MockV3Aggregator =
      await ethers.getContractFactory("MockV3Aggregator");
    const priceFeed = await MockV3Aggregator.deploy(8, 2000n * 10n ** 8n);

    const FuturesContract = await ethers.getContractFactory(
      "EnhancedFuturesContract",
    );
    const futures = await FuturesContract.deploy(
      10, // initialMarginRate (%)
      5, // maintenanceMarginRate (%)
      20, // maxLeverage
      ethers.parseEther("1000000"), // maxDailyVolume
      insuranceFund.address,
    );

    await futures.addPriceOracle(
      ZERO_ADDRESS,
      await priceFeed.getAddress(),
      3600,
      500,
    );

    for (const user of [trader, other]) {
      await futures.registerUser(
        user.address,
        false,
        10,
        ethers.parseEther("1000000"),
      );
    }
    // Liquidator role is separate from the compliance flow; grant it directly.
    const LIQUIDATOR_ROLE = await futures.LIQUIDATOR_ROLE();
    await futures.grantRole(LIQUIDATOR_ROLE, liquidator.address);

    return {
      futures,
      priceFeed,
      admin,
      insuranceFund,
      trader,
      liquidator,
      other,
    };
  }

  it("compiles, deploys, and exposes the emergency-stop admin function without name collisions", async function () {
    const { futures, admin } = await loadFixture(deployFixture);
    expect(await futures.emergencyStopActive()).to.be.false;
    await futures.connect(admin).triggerEmergencyStop();
    expect(await futures.emergencyStopActive()).to.be.true;
    await futures.connect(admin).resumeOperations();
    expect(await futures.emergencyStopActive()).to.be.false;
  });

  it("lets a trader deposit margin, open a long position, close it profitably, and withdraw the profit", async function () {
    // A long trader's gain is backed by a short counterparty's margin still
    // held in the pooled contract balance - this is a two-sided market, so
    // the test models both sides rather than inventing money from nowhere.
    const { futures, priceFeed, trader, other } =
      await loadFixture(deployFixture);

    await futures
      .connect(trader)
      .depositMargin(ZERO_ADDRESS, ethers.parseEther("10"), {
        value: ethers.parseEther("10"),
      });
    await futures
      .connect(other)
      .depositMargin(ZERO_ADDRESS, ethers.parseEther("10"), {
        value: ethers.parseEther("10"),
      });

    await futures.connect(trader).openPosition(
      ZERO_ADDRESS, // underlying
      ZERO_ADDRESS, // margin asset
      ethers.parseEther("1"), // size
      true, // long
      5, // leverage
    );
    await futures.connect(other).openPosition(
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ethers.parseEther("1"),
      false, // short - the long's counterparty
      5,
    );

    // Price moves from $2000 to $2400 (+20%) - profitable long, losing short
    await priceFeed.updateAnswer(2400n * 10n ** 8n);

    const positionId = 1;
    await expect(futures.connect(trader).closePosition(positionId)).to.emit(
      futures,
      "PositionClosed",
    );

    const profile = await futures.userProfiles(trader.address);
    expect(profile.availableMargin).to.be.gt(ethers.parseEther("10"));

    // The realized profit must be withdrawable, not stuck in accounting.
    const withdrawAmount = profile.availableMargin;
    const balanceBefore = await ethers.provider.getBalance(trader.address);
    const tx = await futures
      .connect(trader)
      .withdrawMargin(ZERO_ADDRESS, withdrawAmount);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const balanceAfter = await ethers.provider.getBalance(trader.address);

    expect(balanceAfter - balanceBefore + gasCost).to.equal(withdrawAmount);
  });

  it("liquidates an eligible undercollateralized position and pays the liquidator", async function () {
    const { futures, priceFeed, trader, liquidator } =
      await loadFixture(deployFixture);

    await futures
      .connect(trader)
      .depositMargin(ZERO_ADDRESS, ethers.parseEther("10"), {
        value: ethers.parseEther("10"),
      });

    await futures.connect(trader).openPosition(
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ethers.parseEther("1"),
      true, // long
      10, // leverage
    );

    // Crash the price so the long position is deep underwater.
    await priceFeed.updateAnswer(1000n * 10n ** 8n);

    const positionId = 1;
    const liquidatorMarginBefore = (
      await futures.userProfiles(liquidator.address)
    ).availableMargin;

    await expect(
      futures.connect(liquidator).liquidatePosition(positionId),
    ).to.emit(futures, "PositionLiquidated");

    const position = await futures.positions(positionId);
    expect(position.status).to.equal(2); // LIQUIDATED

    const liquidatorMarginAfter = (
      await futures.userProfiles(liquidator.address)
    ).availableMargin;
    expect(liquidatorMarginAfter).to.be.gt(liquidatorMarginBefore);

    expect(await futures.insuranceFund()).to.be.gt(0);
  });

  it("rejects opening a position with leverage above the configured maximum", async function () {
    const { futures, trader } = await loadFixture(deployFixture);

    await futures
      .connect(trader)
      .depositMargin(ZERO_ADDRESS, ethers.parseEther("10"), {
        value: ethers.parseEther("10"),
      });

    await expect(
      futures.connect(trader).openPosition(
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ethers.parseEther("1"),
        true,
        999, // above maxLeverage of 20
      ),
    ).to.be.reverted;
  });

  it("allows an admin to sweep the insurance fund to the configured address", async function () {
    const { futures, admin, insuranceFund, trader, liquidator, priceFeed } =
      await loadFixture(deployFixture);

    await futures
      .connect(trader)
      .depositMargin(ZERO_ADDRESS, ethers.parseEther("10"), {
        value: ethers.parseEther("10"),
      });
    await futures
      .connect(trader)
      .openPosition(
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ethers.parseEther("1"),
        true,
        10,
      );
    await priceFeed.updateAnswer(1000n * 10n ** 8n);
    await futures.connect(liquidator).liquidatePosition(1);

    const fundAmount = await futures.insuranceFund();
    expect(fundAmount).to.be.gt(0);

    const balanceBefore = await ethers.provider.getBalance(
      insuranceFund.address,
    );
    await futures.connect(admin).withdrawInsuranceFund(fundAmount);
    const balanceAfter = await ethers.provider.getBalance(
      insuranceFund.address,
    );

    expect(balanceAfter - balanceBefore).to.equal(fundAmount);
    expect(await futures.insuranceFund()).to.equal(0);
  });
});
