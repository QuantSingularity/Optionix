const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const ZERO_ADDRESS = ethers.ZeroAddress;
const OptionType = { CALL: 0, PUT: 1 };
const OptionStyle = { EUROPEAN: 0, AMERICAN: 1 };

describe("EnhancedOptionsContract", function () {
  async function deployFixture() {
    const [admin, writer, buyer, other] = await ethers.getSigners();

    const MockV3Aggregator =
      await ethers.getContractFactory("MockV3Aggregator");
    // 8 decimals, $2,000.00000000
    const priceFeed = await MockV3Aggregator.deploy(8, 2000n * 10n ** 8n);

    const OptionsContract = await ethers.getContractFactory(
      "EnhancedOptionsContract",
    );
    const options = await OptionsContract.deploy(
      10, // maxLeverage (unused directly by options but part of risk params)
      10, // marginRequirement
      ethers.parseEther("1000000"), // maxDailyVolume
    );

    await options.addPriceOracle(
      ZERO_ADDRESS,
      await priceFeed.getAddress(),
      3600,
    );

    for (const user of [writer, buyer, other]) {
      await options.registerUser(
        user.address,
        false,
        10,
        ethers.parseEther("100000"),
      );
    }

    return { options, priceFeed, admin, writer, buyer, other };
  }

  it("compiles and deploys with roles assigned to the admin", async function () {
    const { options, admin } = await loadFixture(deployFixture);
    const DEFAULT_ADMIN_ROLE = await options.DEFAULT_ADMIN_ROLE();
    expect(await options.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
  });

  it("rejects trading from an unregistered (non-compliant) user", async function () {
    const { options, other } = await loadFixture(deployFixture);
    const expiration = (await time.latest()) + 7 * 24 * 3600;

    await expect(
      options
        .connect(other)
        .createOption(
          OptionType.CALL,
          OptionStyle.EUROPEAN,
          ethers.parseEther("2000"),
          ethers.parseEther("0.01"),
          expiration,
          ZERO_ADDRESS,
          ethers.parseEther("1"),
        ),
    ).to.be.reverted;
  });

  it("lets a writer deposit collateral, create an option, and a buyer purchase it", async function () {
    const { options, writer, buyer } = await loadFixture(deployFixture);

    await options
      .connect(writer)
      .depositCollateral(ZERO_ADDRESS, ethers.parseEther("2"), {
        value: ethers.parseEther("2"),
      });

    const expiration = (await time.latest()) + 7 * 24 * 3600;
    const premium = ethers.parseEther("0.05");

    const tx = await options
      .connect(writer)
      .createOption(
        OptionType.CALL,
        OptionStyle.AMERICAN,
        ethers.parseEther("2000"),
        premium,
        expiration,
        ZERO_ADDRESS,
        ethers.parseEther("1"),
      );
    await expect(tx).to.emit(options, "OptionCreated");

    const optionId = 1;
    const writerBalanceBefore = await ethers.provider.getBalance(
      writer.address,
    );

    await expect(
      options.connect(buyer).purchaseOption(optionId, { value: premium }),
    ).to.emit(options, "OptionPurchased");

    const writerBalanceAfter = await ethers.provider.getBalance(writer.address);
    expect(writerBalanceAfter - writerBalanceBefore).to.equal(premium);

    const option = await options.getOption(optionId);
    expect(option.holder).to.equal(buyer.address);
  });

  it("pays out an in-the-money American call on exercise and returns leftover collateral to the writer", async function () {
    const { options, priceFeed, writer, buyer } =
      await loadFixture(deployFixture);

    await options
      .connect(writer)
      .depositCollateral(ZERO_ADDRESS, ethers.parseEther("2"), {
        value: ethers.parseEther("2"),
      });

    const expiration = (await time.latest()) + 7 * 24 * 3600;
    const premium = ethers.parseEther("0.05");
    const strike = 1800n * 10n ** 8n; // priced in oracle units (8 decimals)

    await options
      .connect(writer)
      .createOption(
        OptionType.CALL,
        OptionStyle.AMERICAN,
        strike,
        premium,
        expiration,
        ZERO_ADDRESS,
        ethers.parseEther("1"),
      );

    const optionId = 1;
    await options.connect(buyer).purchaseOption(optionId, { value: premium });

    // Move price up: current price ($2000) > strike ($1800) => in the money
    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

    const tx = await options.connect(buyer).exerciseOption(optionId);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    const option = await options.getOption(optionId);
    expect(option.status).to.equal(1); // EXERCISED

    // Payoff settles into the buyer's collateral balance (in the underlying asset)
    const buyerCollateral = await options.getCollateralBalance(
      buyer.address,
      ZERO_ADDRESS,
    );
    expect(buyerCollateral).to.be.gt(0);

    // Remaining collateral (2 ETH locked - payoff) returns to the writer
    const writerCollateral = await options.getCollateralBalance(
      writer.address,
      ZERO_ADDRESS,
    );
    expect(writerCollateral).to.be.gt(0);
    expect(writerCollateral + buyerCollateral).to.equal(ethers.parseEther("2"));

    // sanity: gas accounted for, no ETH silently lost from buyer beyond gas
    expect(buyerBalanceBefore - gasCost).to.be.lte(
      await ethers.provider.getBalance(buyer.address),
    );
  });

  it("lets the writer reclaim collateral for an unpurchased option after expiration", async function () {
    const { options, writer } = await loadFixture(deployFixture);

    await options
      .connect(writer)
      .depositCollateral(ZERO_ADDRESS, ethers.parseEther("1"), {
        value: ethers.parseEther("1"),
      });

    const expiration = (await time.latest()) + 3600;
    await options
      .connect(writer)
      .createOption(
        OptionType.CALL,
        OptionStyle.EUROPEAN,
        ethers.parseEther("2000"),
        ethers.parseEther("0.01"),
        expiration,
        ZERO_ADDRESS,
        ethers.parseEther("1"),
      );

    const optionId = 1;
    await time.increaseTo(expiration + 1);

    const collateralBefore = await options.getCollateralBalance(
      writer.address,
      ZERO_ADDRESS,
    );
    await expect(options.settleExpiredOption(optionId)).to.emit(
      options,
      "OptionSettled",
    );
    const collateralAfter = await options.getCollateralBalance(
      writer.address,
      ZERO_ADDRESS,
    );

    expect(collateralAfter - collateralBefore).to.equal(ethers.parseEther("1"));
  });

  it("allows depositing and withdrawing ERC20 collateral without losing funds", async function () {
    const { options, writer } = await loadFixture(deployFixture);

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy(
      "Mock USD",
      "mUSD",
      ethers.parseEther("1000000"),
    );
    await token.transfer(writer.address, ethers.parseEther("1000"));

    await options.addPriceOracle(
      await token.getAddress(),
      await (
        await ethers.getContractFactory("MockV3Aggregator")
      )
        .deploy(8, 1n * 10n ** 8n)
        .then((c) => c.getAddress()),
      3600,
    );

    await token
      .connect(writer)
      .approve(await options.getAddress(), ethers.parseEther("500"));
    await options
      .connect(writer)
      .depositCollateral(await token.getAddress(), ethers.parseEther("500"));

    expect(
      await options.getCollateralBalance(
        writer.address,
        await token.getAddress(),
      ),
    ).to.equal(ethers.parseEther("500"));

    await options
      .connect(writer)
      .withdrawCollateral(await token.getAddress(), ethers.parseEther("200"));

    expect(await token.balanceOf(writer.address)).to.equal(
      ethers.parseEther("700"),
    );
  });

  it("blocks trading while the emergency stop is active", async function () {
    const { options, admin, writer } = await loadFixture(deployFixture);

    await options.connect(admin).triggerEmergencyStop();
    expect(await options.emergencyStopActive()).to.be.true;

    await options
      .connect(writer)
      .depositCollateral(ZERO_ADDRESS, ethers.parseEther("1"), {
        value: ethers.parseEther("1"),
      });

    const expiration = (await time.latest()) + 3600;
    await expect(
      options
        .connect(writer)
        .createOption(
          OptionType.CALL,
          OptionStyle.EUROPEAN,
          ethers.parseEther("2000"),
          ethers.parseEther("0.01"),
          expiration,
          ZERO_ADDRESS,
          ethers.parseEther("1"),
        ),
    ).to.be.reverted;

    await options.connect(admin).resumeTrading();
    expect(await options.emergencyStopActive()).to.be.false;
  });
});
