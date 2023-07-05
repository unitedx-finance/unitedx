const { ethers } = require("hardhat");
const A3O_WRAPPER = new Map();
A3O_WRAPPER.set("2001", "0x49484Ae8646C12A8A68DfE2c978E9d4Fa5b01D16");
A3O_WRAPPER.set("200101", "0x2a16a70E71D2C6f07F02b221B441a2e35E3d0848");
A3O_WRAPPER.set("31337", "0x2a16a70E71D2C6f07F02b221B441a2e35E3d0848");
const MADADecimals = 18;

module.exports = async function({ getChainId, getNamedAccounts, deployments }) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  const Comptroller = await ethers.getContract("Comptroller");
  const unitroller = await ethers.getContract("Unitroller");
  const comptroller = Comptroller.attach(unitroller.address);

  const interestRateModel = await ethers.getContract("NativeJumpRateModel");
  const xTokenExchangeRate = "0.02";
  const deployment = await deploy("XMada", {
    from: deployer,
    args: [
      comptroller.address,
      interestRateModel.address,
      ethers.utils.parseUnits(xTokenExchangeRate, 18 + MADADecimals - 8),
      "UnitedX MADA",
      "xMADA",
      8,
      deployer,
    ],
    log: true,
    deterministicDeployment: false,
    contract: "CEther",
  });
  await deployment.receipt;

  const xMada = await ethers.getContract("XMada");
  if (!(await comptroller.markets(xMada.address)).isListed) {
    // Smallest possible MADA amount that would get converted to at least 1 xMADA
    const transferAmount =
      MADADecimals - 8 < 0
        ? 1
        : ethers.utils.parseUnits(xTokenExchangeRate, MADADecimals - 8);
    console.log(
      `Supporting xMada market (with ${ethers.utils.formatEther(
        transferAmount
      )} MADA)...`
    );
    await (
      await comptroller._supportMarket(xMada.address, {
        value: transferAmount,
      })
    ).wait();
  }

  const ABI = ["function readData()"];
  let iface = new ethers.utils.Interface(ABI);

  const oracleAggregatorV1 = await ethers.getContract("OracleAggregatorV1");
  console.log(`Setting aggregator for MilkADA ${xMada.address}...`);
  await (
    await oracleAggregatorV1.setAggregators(
      [xMada.address],
      [A3O_WRAPPER.get(chainId)],
      [iface.encodeFunctionData("readData", [])],
      [ethers.utils.parseUnits("1", MADADecimals)]
    )
  ).wait();

  const collateralFactor = "0.75";
  const collateralFactorBN = ethers.utils.parseEther(collateralFactor);
  const comptrollerMADACollateralFactor = (
    await comptroller.markets(xMada.address)
  ).collateralFactorMantissa;
  if (!collateralFactorBN.eq(comptrollerMADACollateralFactor)) {
    console.log("Setting collateral factor ", collateralFactor);
    await (
      await comptroller._setCollateralFactor(xMada.address, collateralFactorBN)
    ).wait();
  }

  const reserveFactor = "0.20";
  const reserveFactorBN = ethers.utils.parseEther(reserveFactor);
  const xmadaReserveFactor = await xMada.reserveFactorMantissa();
  if (!reserveFactorBN.eq(xmadaReserveFactor)) {
    console.log("Setting reserve factor ", reserveFactor);
    await (await xMada._setReserveFactor(reserveFactorBN)).wait();
  }
};

module.exports.tags = ["xMada"];
module.exports.dependencies = ["Comptroller", "JumpRateModel", "PriceOracle"];

// module.exports.skip = async () => {
//   const chainId = await getChainId();
//   if (!WMADA.has(chainId)) {
//     console.log("WMADA address missing");
//     return true;
//   }
// };
