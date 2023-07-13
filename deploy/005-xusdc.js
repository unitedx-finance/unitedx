const { ethers } = require("hardhat");
const USDC = new Map();
USDC.set("2001", "");
USDC.set("200101", "0x9EB438C9c4d5F40c3752EE40636eB4076AbcB999");
USDC.set("31337", "0x9EB438C9c4d5F40c3752EE40636eB4076AbcB999");
const USDCDecimals = 6;

module.exports = async function({ getChainId, getNamedAccounts, deployments }) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  const Comptroller = await ethers.getContract("Comptroller");
  const unitroller = await ethers.getContract("Unitroller");
  const comptroller = Comptroller.attach(unitroller.address);

  const interestRateModel = await ethers.getContract("StableJumpRateModel");
  const xUsdcDelegate = await ethers.getContract("CErc20Delegate");

  const xTokenExchangeRate = "0.02";
  const deployment = await deploy("XUsdcDelegator", {
    from: deployer,
    args: [
      USDC.get(chainId),
      comptroller.address,
      interestRateModel.address,
      ethers.utils.parseUnits(xTokenExchangeRate, 18 + USDCDecimals - 8),
      "UnitedX USD coin",
      "xUSDC",
      8,
      deployer,
      xUsdcDelegate.address,
      "0x",
    ],
    log: true,
    deterministicDeployment: false,
    contract: "CErc20Delegator",
  });
  await deployment.receipt;

  // Smallest possible USDC amount that would get converted to at least 1 xUSDC
  const mintAmount =
    USDCDecimals - 8 < 0
      ? ethers.BigNumber.from(1)
      : ethers.utils.parseUnits(xTokenExchangeRate, USDCDecimals - 8);
  const usdc = await ethers.getContractAt("EIP20Interface", USDC.get(chainId));
  const comptrollerUSDCBalance = await usdc.balanceOf(comptroller.address);
  if (mintAmount.gt(comptrollerUSDCBalance)) {
    const transferAmount = mintAmount.sub(comptrollerUSDCBalance);
    console.log(
      `Transferring ${transferAmount} USDC to Comptroller for initial deposit after market creation...`
    );
    await (await usdc.transfer(comptroller.address, transferAmount)).wait();
  }

  const xUsdcDelegator = await ethers.getContract("XUsdcDelegator");
  if (!(await comptroller.markets(xUsdcDelegator.address)).isListed) {
    console.log("Supporting xUSDC market...");
    await (await comptroller._supportMarket(xUsdcDelegator.address)).wait();
  }

  const priceOracle = await ethers.getContract("SimplePriceOracle");
  const simpleOraclePrice = ethers.utils.parseUnits("0.99", 18);
  if (
    !simpleOraclePrice.eq(
      await priceOracle.getUnderlyingPrice(xUsdcDelegator.address)
    )
  ) {
    console.log("Setting price feed source for xUSDC ");
    await (
      await priceOracle.setUnderlyingPrice(
        xUsdcDelegator.address,
        simpleOraclePrice
      )
    ).wait();
  }

  const ABI = ["function assetPrices(address asset)"];
  let iface = new ethers.utils.Interface(ABI);

  const oracleAggregatorV1 = await ethers.getContract("OracleAggregatorV1");
  console.log(`Setting aggregator for USDC ${xUsdcDelegator.address}...`);
  await (
    await oracleAggregatorV1.setAggregators(
      [xUsdcDelegator.address],
      [priceOracle.address],
      [
        iface.encodeFunctionData("assetPrices", [
          await xUsdcDelegator.underlying(),
        ]),
      ],
      [ethers.utils.parseUnits("1", USDCDecimals)]
    )
  ).wait();

  const collateralFactor = "0.80";
  const collateralFactorBN = ethers.utils.parseEther(collateralFactor);
  const comptrollerUSDCCollateralFactor = (
    await comptroller.markets(xUsdcDelegator.address)
  ).collateralFactorMantissa;
  if (!collateralFactorBN.eq(comptrollerUSDCCollateralFactor)) {
    console.log("Setting collateral factor ", collateralFactor);
    await (
      await comptroller._setCollateralFactor(
        xUsdcDelegator.address,
        collateralFactorBN
      )
    ).wait();
  }

  const compWeight = "1";
  const compWeightBN = ethers.utils.parseEther(compWeight);
  const comptrollerUSDCCompWeight = (
    await comptroller.markets(xUsdcDelegator.address)
  ).compWeightMantissa;
  if (!compWeightBN.eq(comptrollerUSDCCompWeight)) {
    console.log("Setting comp weight ", compWeight);
    await (
      await comptroller._setCompWeight(xUsdcDelegator.address, compWeightBN)
    ).wait();
  }

  const reserveFactor = "0.15";
  const reserveFactorBN = ethers.utils.parseEther(reserveFactor);
  const xusdcReserveFactor = await xUsdcDelegator.reserveFactorMantissa();
  if (!reserveFactorBN.eq(xusdcReserveFactor)) {
    console.log("Setting reserve factor ", reserveFactor);
    await (await xUsdcDelegator._setReserveFactor(reserveFactorBN)).wait();
  }
};

module.exports.tags = ["xUSDC"];
module.exports.dependencies = [
  "Comptroller",
  "JumpRateModel",
  "PriceOracle",
  "CErc20Delegate",
];

module.exports.skip = async () => {
  const chainId = await getChainId();
  if (!USDC.has(chainId)) {
    console.log("USDC address missing");
    return true;
  }
};
