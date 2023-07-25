const { ethers } = require("hardhat");
const UnderlyingTokenAddress = new Map();
UnderlyingTokenAddress.set("2001", "");
UnderlyingTokenAddress.set(
  "200101",
  "0x9EB438C9c4d5F40c3752EE40636eB4076AbcB999"
);
UnderlyingTokenAddress.set(
  "31337",
  "0x9EB438C9c4d5F40c3752EE40636eB4076AbcB999"
);
const UnderlyingTokenDecimals = 6;
const xTokenName = "UnitedX USD coin";
const xTokenSymbol = "xUSDC";

module.exports = async function({ getChainId, getNamedAccounts, deployments }) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  const Comptroller = await ethers.getContract("Comptroller");
  const unitroller = await ethers.getContract("Unitroller");
  const comptroller = Comptroller.attach(unitroller.address);

  const interestRateModel = await ethers.getContract("StableJumpRateModel");
  const xTokenDelegate = await ethers.getContract("CErc20Delegate");

  const xTokenDelegatorDeploymentName = `${xTokenSymbol}Delegator`;
  const xTokenExchangeRate = "0.02";
  const deployment = await deploy(xTokenDelegatorDeploymentName, {
    from: deployer,
    args: [
      UnderlyingTokenAddress.get(chainId),
      comptroller.address,
      interestRateModel.address,
      ethers.utils.parseUnits(
        xTokenExchangeRate,
        18 + UnderlyingTokenDecimals - 8
      ),
      xTokenName,
      xTokenSymbol,
      8,
      deployer,
      xTokenDelegate.address,
      "0x",
    ],
    log: true,
    deterministicDeployment: false,
    contract: "CErc20Delegator",
  });
  await deployment.receipt;

  const xTokenDelegator = await ethers.getContract(
    xTokenDelegatorDeploymentName
  );
  if (!(await comptroller.markets(xTokenDelegator.address)).isListed) {
    // Smallest possible underlyingToken amount that would get converted to at least 1 xToken
    const mintAmount =
      UnderlyingTokenDecimals - 8 < 0
        ? ethers.BigNumber.from(1)
        : ethers.utils.parseUnits(
            xTokenExchangeRate,
            UnderlyingTokenDecimals - 8
          );
    const underlyingToken = await ethers.getContractAt(
      "EIP20Interface",
      UnderlyingTokenAddress.get(chainId)
    );
    const comptrollerUnderlyingTokenBalance = await underlyingToken.balanceOf(
      comptroller.address
    );
    if (mintAmount.gt(comptrollerUnderlyingTokenBalance)) {
      const transferAmount = mintAmount.sub(comptrollerUnderlyingTokenBalance);
      console.log(
        `Transferring ${transferAmount} of underlying token to Comptroller for initial deposit after market creation...`
      );
      await (
        await underlyingToken.transfer(comptroller.address, transferAmount)
      ).wait();
    }

    console.log(`Supporting ${xTokenSymbol} market...`);
    await (await comptroller._supportMarket(xTokenDelegator.address)).wait();
  }

  const priceOracle = await ethers.getContract("SimplePriceOracle");
  const simpleOraclePrice = ethers.utils.parseUnits("0.99", 18);
  if (
    !simpleOraclePrice.eq(
      await priceOracle.getUnderlyingPrice(xTokenDelegator.address)
    )
  ) {
    console.log(`Setting price feed source for ${xTokenSymbol}...`);
    await (
      await priceOracle.setUnderlyingPrice(
        xTokenDelegator.address,
        simpleOraclePrice
      )
    ).wait();
  }

  const ABI = ["function assetPrices(address asset)"];
  let iface = new ethers.utils.Interface(ABI);

  const oracleAggregatorV1 = await ethers.getContract("OracleAggregatorV1");
  console.log(
    `Setting aggregator for ${xTokenSymbol} ${xTokenDelegator.address}...`
  );
  await (
    await oracleAggregatorV1.setAggregators(
      [xTokenDelegator.address],
      [priceOracle.address],
      [
        iface.encodeFunctionData("assetPrices", [
          await xTokenDelegator.underlying(),
        ]),
      ],
      [ethers.utils.parseUnits("1", UnderlyingTokenDecimals)]
    )
  ).wait();

  const collateralFactor = "0.80";
  const collateralFactorBN = ethers.utils.parseEther(collateralFactor);
  const comptrollerXTokenCollateralFactor = (
    await comptroller.markets(xTokenDelegator.address)
  ).collateralFactorMantissa;
  if (!collateralFactorBN.eq(comptrollerXTokenCollateralFactor)) {
    console.log("Setting collateral factor ", collateralFactor);
    await (
      await comptroller._setCollateralFactor(
        xTokenDelegator.address,
        collateralFactorBN
      )
    ).wait();
  }

  const compWeight = "1";
  const compWeightBN = ethers.utils.parseEther(compWeight);
  const comptrollerXTokenCompWeight = (
    await comptroller.markets(xTokenDelegator.address)
  ).compWeightMantissa;
  if (!compWeightBN.eq(comptrollerXTokenCompWeight)) {
    console.log("Setting comp weight ", compWeight);
    await (
      await comptroller._setCompWeight(xTokenDelegator.address, compWeightBN)
    ).wait();
  }

  const reserveFactor = "0.15";
  const reserveFactorBN = ethers.utils.parseEther(reserveFactor);
  const xTokenReserveFactor = await xTokenDelegator.reserveFactorMantissa();
  if (!reserveFactorBN.eq(xTokenReserveFactor)) {
    console.log("Setting reserve factor ", reserveFactor);
    await (await xTokenDelegator._setReserveFactor(reserveFactorBN)).wait();
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
  if (!UnderlyingTokenAddress.has(chainId)) {
    console.log("Underlying token address missing");
    return true;
  }
};
