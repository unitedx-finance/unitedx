const { ethers } = require("hardhat");
const { expect } = require("chai");
const {
  loadFixture,
  mine,
  time,
} = require("@nomicfoundation/hardhat-network-helpers");
const ERC20MintableABI = require("./abi/ERC20Mintable.json");

const A3O_WRAPPER = "0x2a16a70E71D2C6f07F02b221B441a2e35E3d0848";
const ERC20Mintable = "0x9EB438C9c4d5F40c3752EE40636eB4076AbcB999";
const USDCDecimals = 6;

const distributionScheduleValues = [
  ethers.utils.parseUnits("106171178500000000000", 0),
  ethers.utils.parseUnits("95554060650000000000", 0),
  ethers.utils.parseUnits("84936942800000000000", 0),
  ethers.utils.parseUnits("76443248550000000000", 0),
  ethers.utils.parseUnits("19907095970000000000", 0),
];

describe("Comptroller", function() {
  ethers.utils.Logger.setLogLevel("error");
  async function deployErc20({
    owner,
    comptroller,
    interestRateModel,
    simplePriceOracle,
    oracleAggregatorV1,
    name,
    symbol,
    decimals = 18,
    price = ethers.utils.parseUnits("0.99", 18),
  }) {
    const xTokenExchangeRate = "0.02";
    const erc20Mintable = await ethers.getContractAt(
      ERC20MintableABI,
      ERC20Mintable
    );
    await erc20Mintable.mint(
      owner.address,
      ethers.utils.parseUnits("1000", decimals)
    );
    const transferAmount =
      decimals - 8 < 0
        ? ethers.BigNumber.from(1)
        : ethers.utils.parseUnits(xTokenExchangeRate, decimals - 8);
    await erc20Mintable.transfer(comptroller.address, transferAmount);

    const CErc20Delegate = await ethers.getContractFactory("CErc20Delegate");
    const xerc20Delegate = await CErc20Delegate.deploy();
    await xerc20Delegate.deployed();
    const CErc20Delegator = await ethers.getContractFactory("CErc20Delegator");

    const xerc20 = await CErc20Delegator.deploy(
      ERC20Mintable,
      comptroller.address,
      interestRateModel.address,
      ethers.utils.parseUnits(xTokenExchangeRate, 18 + decimals - 8),
      name,
      symbol,
      8,
      owner.address,
      xerc20Delegate.address,
      "0x"
    );
    await simplePriceOracle.setUnderlyingPrice(xerc20.address, price);
    let iface = new ethers.utils.Interface([
      "function assetPrices(address asset)",
    ]);
    await oracleAggregatorV1.setAggregators(
      [xerc20.address],
      [simplePriceOracle.address],
      [iface.encodeFunctionData("assetPrices", [await xerc20.underlying()])],
      [ethers.utils.parseUnits("1", decimals)]
    );

    await erc20Mintable.approve(xerc20.address, ethers.constants.MaxUint256);

    return xerc20;
  }
  async function supportMarket({
    comptroller,
    xerc20,
    collateralFactor = ethers.utils.parseEther("0.8"),
    compWeight = ethers.utils.parseEther("1"),
    reserveFactor = ethers.utils.parseEther("0.15"),
  }) {
    await comptroller._supportMarket(xerc20.address);
    await comptroller._setCollateralFactor(xerc20.address, collateralFactor);
    await comptroller._setCompWeight(xerc20.address, compWeight);
    await xerc20._setReserveFactor(reserveFactor);
  }

  async function deployFixture(args) {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const UTDX = await ethers.getContractFactory("Comp");
    const utdx = await UTDX.deploy(owner.address);
    await utdx.deployed();

    const SimplePriceOracle = await ethers.getContractFactory(
      "SimplePriceOracle"
    );
    const simplePriceOracle = await SimplePriceOracle.deploy();
    await simplePriceOracle.deployed();

    const OracleAggregatorV1 = await ethers.getContractFactory(
      "OracleAggregatorV1"
    );
    const oracleAggregatorV1 = await OracleAggregatorV1.deploy(A3O_WRAPPER);
    await oracleAggregatorV1.deployed();

    const Unitroller = await ethers.getContractFactory("Unitroller");
    const unitroller = await Unitroller.deploy();
    await unitroller.deployed();

    const Comptroller = await ethers.getContractFactory("Comptroller");
    const _comptroller = await Comptroller.deploy();
    await _comptroller.deployed();

    await unitroller._setPendingImplementation(_comptroller.address);
    await _comptroller._become(unitroller.address);
    const comptroller = Comptroller.attach(unitroller.address);
    if (!args.dontSetDistributionSchedule) {
      await comptroller._initializeCompParameters(1000, utdx.address);
    }
    await comptroller._setCloseFactor(ethers.utils.parseEther("0.5"));
    await comptroller._setLiquidationIncentive(ethers.utils.parseEther("1.08"));
    await comptroller._setPriceOracle(oracleAggregatorV1.address);

    const JumpRateModel = await ethers.getContractFactory("JumpRateModel");
    const interestRateModel = await JumpRateModel.deploy(
      0,
      "50000000000000000",
      "1090000000000000000",
      "800000000000000000"
    );
    await interestRateModel.deployed();

    const xusdc = await deployErc20({
      owner,
      comptroller,
      interestRateModel,
      simplePriceOracle,
      oracleAggregatorV1,
      name: "UnitedX USD coin",
      symbol: "xUSDC",
      decimals: USDCDecimals,
    });
    await supportMarket({ comptroller, xerc20: xusdc });

    return {
      utdx,
      comptroller,
      owner,
      addr1,
      addr2,
      xusdc,
      interestRateModel,
      simplePriceOracle,
      oracleAggregatorV1,
    };
  }
  async function deployNormalFixture() {
    return await deployFixture({});
  }
  async function deployFixtureNoDistributionSchedule() {
    return await deployFixture({ dontSetDistributionSchedule: true });
  }

  describe("CompWeight related", function() {
    it("Admin can set compWeight", async () => {
      const { comptroller, xusdc } = await loadFixture(deployNormalFixture);

      await comptroller._setCompWeight(
        xusdc.address,
        ethers.utils.parseEther("2")
      );

      expect(
        (await comptroller.markets(xusdc.address)).compWeightMantissa
      ).to.equal(ethers.utils.parseEther("2"));
    });

    it("Non-admin cannot set compWeight", async () => {
      const { comptroller: _comptroller, addr1, xusdc } = await loadFixture(
        deployNormalFixture
      );
      const comptroller = _comptroller.connect(addr1);

      const compWeightBefore = (await comptroller.markets(xusdc.address))
        .compWeightMantissa;

      await comptroller._setCompWeight(
        xusdc.address,
        ethers.utils.parseEther("2")
      );

      expect(
        (await comptroller.markets(xusdc.address)).compWeightMantissa
      ).to.equal(compWeightBefore);
    });

    it("Cannot set compWeight of non-listed market", async () => {
      const { comptroller } = await loadFixture(deployNormalFixture);

      const nonExistingMarket = "0x0000000000000000000000000000000000001234";
      const compWeightBefore = (await comptroller.markets(nonExistingMarket))
        .compWeightMantissa;

      await comptroller._setCompWeight(
        nonExistingMarket,
        ethers.utils.parseEther("2")
      );

      expect(
        (await comptroller.markets(nonExistingMarket)).compWeightMantissa
      ).to.equal(compWeightBefore);
    });

    it("getMarketCompRatio returns 1e18 with one market", async () => {
      const { comptroller, xusdc } = await loadFixture(deployNormalFixture);
      expect(
        (await comptroller.getMarketCompRatio(xusdc.address)).mantissa
      ).to.equal(ethers.utils.parseEther("1"));
    });

    it("getMarketCompRatio returns 0.5e18 with two equal markets", async () => {
      const {
        comptroller,
        owner,
        xusdc,
        interestRateModel,
        simplePriceOracle,
        oracleAggregatorV1,
      } = await loadFixture(deployNormalFixture);

      const xusdt = await deployErc20({
        owner,
        comptroller,
        interestRateModel,
        simplePriceOracle,
        oracleAggregatorV1,
        name: "UnitedX Tether USD",
        symbol: "xUSDT",
      });
      await supportMarket({ comptroller, xerc20: xusdt });

      expect(
        (await comptroller.getMarketCompRatio(xusdc.address)).mantissa
      ).to.equal(ethers.utils.parseEther("0.5"));
      expect(
        (await comptroller.getMarketCompRatio(xusdt.address)).mantissa
      ).to.equal(ethers.utils.parseEther("0.5"));
    });

    it("getMarketCompRatio returns 1/4 and 3/4 ratios for 2 such markets", async () => {
      const {
        comptroller,
        owner,
        xusdc,
        interestRateModel,
        simplePriceOracle,
        oracleAggregatorV1,
      } = await loadFixture(deployNormalFixture);

      const xusdt = await deployErc20({
        owner,
        comptroller,
        interestRateModel,
        simplePriceOracle,
        oracleAggregatorV1,
        name: "UnitedX Tether USD",
        symbol: "xUSDT",
      });
      await supportMarket({
        comptroller,
        xerc20: xusdt,
        compWeight: ethers.utils.parseEther("3"),
      });

      expect(
        (await comptroller.getMarketCompRatio(xusdc.address)).mantissa
      ).to.equal(ethers.utils.parseEther("0.25"));
      expect(
        (await comptroller.getMarketCompRatio(xusdt.address)).mantissa
      ).to.equal(ethers.utils.parseEther("0.75"));
    });

    it("Admin can set compSpeeds", async () => {
      const { comptroller } = await loadFixture(deployNormalFixture);

      const compSpeed = distributionScheduleValues[0];
      await comptroller._setCompSpeeds(compSpeed, compSpeed);

      expect(await comptroller.compSupplySpeed()).to.equal(compSpeed);
      expect(await comptroller.compBorrowSpeed()).to.equal(compSpeed);
    });

    it("Non-admin cannot set compSpeeds", async () => {
      const { comptroller, addr1 } = await loadFixture(deployNormalFixture);

      await expect(
        comptroller
          .connect(addr1)
          ._setCompSpeeds(
            ethers.utils.parseEther("20"),
            ethers.utils.parseEther("20")
          )
      ).to.be.revertedWith("only admin can set comp speed");
    });

    it("Market gets proper amount of UTDX distributed", async () => {
      const { comptroller, owner, xusdc } = await loadFixture(
        deployNormalFixture
      );

      // Comptroller supplied 1 "wei" of USDC, let's supply small as well so we don't get rounding errors.
      const usdcWeiToSupply = 10;
      await xusdc.mint(usdcWeiToSupply);
      const compSpeed = distributionScheduleValues[0];
      await comptroller._setCompSpeeds(compSpeed, compSpeed);
      const blocksToPass = 100000;
      await mine(blocksToPass);
      await comptroller["claimComp(address[],address[],bool,bool)"](
        [owner.address, comptroller.address],
        [xusdc.address],
        true,
        true
      );

      const ownerCompAccrued = await comptroller.compAccrued(owner.address);
      // Comptroller accrues small amount because it deposited smallest unit of usdc when creating market.
      const comptrollerCompAccrued = await comptroller.compAccrued(
        comptroller.address
      );
      const expected = compSpeed.mul(blocksToPass + 1);
      expect(ownerCompAccrued).to.equal(
        expected.mul(usdcWeiToSupply).div(usdcWeiToSupply + 1)
      );
      expect(comptrollerCompAccrued).to.equal(
        expected.mul(1).div(usdcWeiToSupply + 1)
      );
      expect(ownerCompAccrued.add(comptrollerCompAccrued)).to.equal(expected);
    });

    it("Two markets with different compWeights gets proper amount of UTDX distributed", async () => {
      /**
       * In this scenario, there will be two markets.
       * 1) USDC - compWeight 1, comptroller and owner supply to this market (different amounts)
       * 2) USDT - compWeight 3, owner does not supply to this market (only comptroller)
       */
      const {
        comptroller,
        owner,
        xusdc,
        interestRateModel,
        simplePriceOracle,
        oracleAggregatorV1,
      } = await loadFixture(deployNormalFixture);

      const xusdt = await deployErc20({
        owner,
        comptroller,
        interestRateModel,
        simplePriceOracle,
        oracleAggregatorV1,
        name: "UnitedX Tether USD",
        symbol: "xUSDT",
      });
      const xusdcWeight = 1;
      const xusdtWeight = 3;
      await supportMarket({
        comptroller,
        xerc20: xusdt,
        compWeight: ethers.utils.parseEther(xusdtWeight.toString()),
      });

      // Comptroller supplied 1 "wei" of USDC, let's supply small as well so we don't get rounding errors.
      const usdcWeiToSupply = 10;
      await xusdc.mint(usdcWeiToSupply);
      const compSpeed = distributionScheduleValues[0];
      await comptroller._setCompSpeeds(compSpeed, compSpeed);
      const blocksToPass = 100000;
      await mine(blocksToPass);
      await comptroller["claimComp(address[],address[],bool,bool)"](
        [owner.address, comptroller.address],
        [xusdc.address, xusdt.address],
        true,
        true
      );

      const ownerCompAccrued = await comptroller.compAccrued(owner.address);
      // Comptroller accrues small amount because it deposited smallest unit of usdc when creating market.
      const comptrollerCompAccrued = await comptroller.compAccrued(
        comptroller.address
      );
      const expectedCompDistributed = compSpeed.mul(blocksToPass + 1);

      const ownerCompAccruedFromUSDC = expectedCompDistributed
        .mul(xusdcWeight)
        .div(xusdcWeight + xusdtWeight)
        .mul(usdcWeiToSupply)
        .div(usdcWeiToSupply + 1);
      const ownerCompAccruedFromUSDT = ethers.BigNumber.from(0);
      expect(ownerCompAccrued).to.equal(
        ownerCompAccruedFromUSDC.add(ownerCompAccruedFromUSDT)
      );

      const comptrollerCompAccruedFromUSDC = expectedCompDistributed
        .mul(xusdcWeight)
        .div(xusdcWeight + xusdtWeight)
        .mul(1)
        .div(usdcWeiToSupply + 1);
      const comptrollerCompAccruedFromUSDT = expectedCompDistributed
        .mul(xusdtWeight)
        .div(xusdcWeight + xusdtWeight);
      expect(comptrollerCompAccrued).to.equal(
        comptrollerCompAccruedFromUSDC.add(comptrollerCompAccruedFromUSDT)
      );

      expect(ownerCompAccrued.add(comptrollerCompAccrued)).to.equal(
        expectedCompDistributed
      );
    });

    it("Setting comp speed triggers updating comp supply/borrow indexes", async () => {
      const {
        comptroller,
        owner,
        xusdc,
        interestRateModel,
        simplePriceOracle,
        oracleAggregatorV1,
      } = await loadFixture(deployNormalFixture);

      const xusdt = await deployErc20({
        owner,
        comptroller,
        interestRateModel,
        simplePriceOracle,
        oracleAggregatorV1,
        name: "UnitedX Tether USD",
        symbol: "xUSDT",
      });
      await supportMarket({
        comptroller,
        xerc20: xusdt,
      });

      // Borrow index updates only if borrow amount > 0, so we have to borrow some
      const usdcWeiToSupply = 10;
      await xusdc.mint(usdcWeiToSupply);
      await xusdc.borrow(Math.ceil(usdcWeiToSupply / 5));

      const compSpeed = distributionScheduleValues[0];
      await comptroller._setCompSpeeds(compSpeed, compSpeed);
      await time.increase(7 * 24 * 60 * 60);
      const supplyIndexBefore = (
        await comptroller.compSupplyState(xusdc.address)
      ).index;
      const borrowIndexBefore = (
        await comptroller.compBorrowState(xusdc.address)
      ).index;

      await comptroller._setCompSpeeds(
        distributionScheduleValues[1],
        distributionScheduleValues[1]
      );

      const supplyIndexAfter = (
        await comptroller.compSupplyState(xusdc.address)
      ).index;
      const borrowIndexAfter = (
        await comptroller.compBorrowState(xusdc.address)
      ).index;

      expect(supplyIndexAfter).to.be.greaterThan(supplyIndexBefore);
      expect(borrowIndexAfter).to.be.greaterThan(borrowIndexBefore);
    });

    it("Supporting new market triggers updating comp supply/borrow indexes", async () => {
      const {
        comptroller,
        owner,
        xusdc,
        interestRateModel,
        simplePriceOracle,
        oracleAggregatorV1,
      } = await loadFixture(deployNormalFixture);

      // Borrow index updates only if borrow amount > 0, so we have to borrow some
      const usdcWeiToSupply = 10;
      await xusdc.mint(usdcWeiToSupply);
      await xusdc.borrow(Math.ceil(usdcWeiToSupply / 5));

      const compSpeed = distributionScheduleValues[0];
      await comptroller._setCompSpeeds(compSpeed, compSpeed);
      const blocksToPass = 100;
      await mine(blocksToPass);
      const supplyIndexBefore = (
        await comptroller.compSupplyState(xusdc.address)
      ).index;
      const borrowIndexBefore = (
        await comptroller.compBorrowState(xusdc.address)
      ).index;

      const xusdt = await deployErc20({
        owner,
        comptroller,
        interestRateModel,
        simplePriceOracle,
        oracleAggregatorV1,
        name: "UnitedX Tether USD",
        symbol: "xUSDT",
      });
      await supportMarket({
        comptroller,
        xerc20: xusdt,
      });

      const supplyIndexAfter = (
        await comptroller.compSupplyState(xusdc.address)
      ).index;
      const borrowIndexAfter = (
        await comptroller.compBorrowState(xusdc.address)
      ).index;

      expect(supplyIndexAfter).to.be.greaterThan(supplyIndexBefore);
      expect(borrowIndexAfter).to.be.greaterThan(borrowIndexBefore);
    });

    it("Setting comp weight of market to zero when all other markets have comp weight zero is prevented", async () => {
      const {
        comptroller,
        owner,
        xusdc,
        interestRateModel,
        simplePriceOracle,
        oracleAggregatorV1,
      } = await loadFixture(deployNormalFixture);
      const xusdt = await deployErc20({
        owner,
        comptroller,
        interestRateModel,
        simplePriceOracle,
        oracleAggregatorV1,
        name: "UnitedX Tether USD",
        symbol: "xUSDT",
      });
      await supportMarket({
        comptroller,
        xerc20: xusdt,
      });

      expect(
        (await comptroller.markets(xusdc.address)).compWeightMantissa
      ).to.equal(ethers.constants.WeiPerEther);
      await comptroller._setCompWeight(xusdc.address, 0);
      expect(
        (await comptroller.markets(xusdc.address)).compWeightMantissa
      ).to.equal(ethers.constants.Zero);

      expect(
        (await comptroller.markets(xusdt.address)).compWeightMantissa
      ).to.equal(ethers.constants.WeiPerEther);
      await comptroller._setCompWeight(xusdt.address, 0);
      expect(
        (await comptroller.markets(xusdt.address)).compWeightMantissa
      ).to.equal(ethers.constants.WeiPerEther);
    });

    it("Can only set distribution schedule once", async () => {
      const { comptroller, utdx } = await loadFixture(
        deployFixtureNoDistributionSchedule
      );

      expect(await comptroller.compUnlockTimestamp()).to.equal(
        ethers.constants.Zero
      );
      expect(
        await comptroller.callStatic._initializeCompParameters(
          1000,
          utdx.address
        )
      ).to.equal(0);
      await comptroller._initializeCompParameters(1000, utdx.address);
      expect(
        await comptroller.callStatic._initializeCompParameters(
          1000,
          utdx.address
        )
      ).to.equal(14);
    });

    it("Cannot set comp speed if distribution schedule hasn't been set", async () => {
      const { comptroller } = await loadFixture(
        deployFixtureNoDistributionSchedule
      );

      await expect(
        comptroller._setCompSpeeds(
          ethers.utils.parseEther("20"),
          ethers.utils.parseEther("20")
        )
      ).to.be.revertedWith("distribution schedule has not been set");
    });

    it("During first 3 years, you cannot set comp speed to values other than in the distribution schedule", async () => {
      const { comptroller, utdx } = await loadFixture(
        deployFixtureNoDistributionSchedule
      );
      await comptroller._initializeCompParameters(0, utdx.address);

      const compSpeed = ethers.utils.parseEther("20");

      await expect(
        comptroller._setCompSpeeds(compSpeed, compSpeed)
      ).to.be.revertedWith(
        "comp speed must be set according to the distribution schedule during first 3 years"
      );
      await time.increase(7 * 24 * 60 * 60 - 3);
      await expect(
        comptroller._setCompSpeeds(compSpeed, compSpeed)
      ).to.be.revertedWith(
        "comp speed must be set according to the distribution schedule during first 3 years"
      );
      await time.increase(21 * 24 * 60 * 60 - 1);
      await expect(
        comptroller._setCompSpeeds(compSpeed, compSpeed)
      ).to.be.revertedWith(
        "comp speed must be set according to the distribution schedule during first 3 years"
      );
      await time.increase((84 - 28) * 24 * 60 * 60 - 1);
      await expect(
        comptroller._setCompSpeeds(compSpeed, compSpeed)
      ).to.be.revertedWith(
        "comp speed must be set according to the distribution schedule during first 3 years"
      );
      await time.increase((365 - 84) * 24 * 60 * 60 - 1);
      await expect(
        comptroller._setCompSpeeds(compSpeed, compSpeed)
      ).to.be.revertedWith(
        "comp speed must be set according to the distribution schedule during first 3 years"
      );
      await time.increase(365 * 2 * 24 * 60 * 60 - 1);
      await expect(
        comptroller._setCompSpeeds(compSpeed, compSpeed)
      ).to.be.revertedWith(
        "comp speed must be set according to the distribution schedule during first 3 years"
      );
    });

    it("Test all time periods of distribution schedule comp speed setting", async () => {
      const { comptroller, utdx } = await loadFixture(
        deployFixtureNoDistributionSchedule
      );
      await comptroller._initializeCompParameters(0, utdx.address);

      await comptroller._setCompSpeeds(
        distributionScheduleValues[0],
        distributionScheduleValues[0]
      );

      await time.increase(7 * 24 * 60 * 60 - 3);
      await expect(
        comptroller._setCompSpeeds(
          distributionScheduleValues[1],
          distributionScheduleValues[1]
        )
      ).to.be.revertedWith(
        "comp speed must be set according to the distribution schedule during first 3 years"
      );

      await time.increase(1);
      await comptroller._setCompSpeeds(
        distributionScheduleValues[1],
        distributionScheduleValues[1]
      );

      await time.increase(21 * 24 * 60 * 60 - 3);
      await expect(
        comptroller._setCompSpeeds(
          distributionScheduleValues[2],
          distributionScheduleValues[2]
        )
      ).to.be.revertedWith(
        "comp speed must be set according to the distribution schedule during first 3 years"
      );

      await time.increase(1);
      await comptroller._setCompSpeeds(
        distributionScheduleValues[2],
        distributionScheduleValues[2]
      );

      await time.increase((84 - 28) * 24 * 60 * 60 - 3);
      await expect(
        comptroller._setCompSpeeds(
          distributionScheduleValues[3],
          distributionScheduleValues[3]
        )
      ).to.be.revertedWith(
        "comp speed must be set according to the distribution schedule during first 3 years"
      );

      await time.increase(1);
      await comptroller._setCompSpeeds(
        distributionScheduleValues[3],
        distributionScheduleValues[3]
      );

      await time.increase((365 - 84) * 24 * 60 * 60 - 3);
      await expect(
        comptroller._setCompSpeeds(
          distributionScheduleValues[4],
          distributionScheduleValues[4]
        )
      ).to.be.revertedWith(
        "comp speed must be set according to the distribution schedule during first 3 years"
      );

      await time.increase(1);
      await comptroller._setCompSpeeds(
        distributionScheduleValues[4],
        distributionScheduleValues[4]
      );
    });

    it("After 3 years compspeed can be set to anything", async () => {
      const { comptroller } = await loadFixture(deployNormalFixture);

      await time.increase(365 * 3 * 24 * 60 * 60);
      await comptroller._setCompSpeeds(100, 100);
      await comptroller._setCompSpeeds(0, 0);
      await comptroller._setCompSpeeds(25, 75);
    });

    it("Can claim UTDX only after compUnlockTimestamp", async () => {
      const { comptroller, owner, utdx } = await loadFixture(
        deployFixtureNoDistributionSchedule
      );

      const LOCK_TIME_SECONDS = 1000;

      await comptroller._initializeCompParameters(
        LOCK_TIME_SECONDS,
        utdx.address
      );

      await expect(
        comptroller["claimComp(address)"](owner.address)
      ).to.be.revertedWith("comp claiming is locked");

      await time.increase(LOCK_TIME_SECONDS / 2);

      await expect(
        comptroller["claimComp(address)"](owner.address)
      ).to.be.revertedWith("comp claiming is locked");

      await time.increase(LOCK_TIME_SECONDS / 2);

      await comptroller["claimComp(address)"](owner.address);
    });
  });
});
