const A3O_WRAPPER = new Map();
A3O_WRAPPER.set("2001", "0x49484Ae8646C12A8A68DfE2c978E9d4Fa5b01D16");
A3O_WRAPPER.set("200101", "0x2a16a70E71D2C6f07F02b221B441a2e35E3d0848");

module.exports = async function({ getChainId, getNamedAccounts, deployments }) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  const Comptroller = await ethers.getContract("Comptroller");
  const unitroller = await ethers.getContract("Unitroller");
  const comptroller = Comptroller.attach(unitroller.address);

  const interestRateModel = await ethers.getContract("NativeJumpRateModel");
  const deployment = await deploy("XMada", {
    from: deployer,
    args: [
      comptroller.address,
      interestRateModel.address,
      ethers.utils.parseUnits("0.38", 18),
      "UnitedX MADA",
      "xMADA",
      18,
      deployer,
    ],
    log: true,
    deterministicDeployment: false,
    contract: "CEther",
  });
  await deployment.receipt;

  const xMada = await ethers.getContract("XMada");
  console.log("Supporting xMada market...");
  await comptroller._supportMarket(xMada.address, {
    gasLimit: 2000000,
  });

  const ABI = ["function readData()"];
  let iface = new ethers.utils.Interface(ABI);

  const oracleAggregatorV1 = await ethers.getContract("OracleAggregatorV1");
  console.log(`Setting aggregator for MilkADA ${xMada.address}...`);
  await oracleAggregatorV1.setAggregators(
    [xMada.address],
    [A3O_WRAPPER.get(chainId)],
    [iface.encodeFunctionData("readData", [])]
  );

  const collateralFactor = "0.75";
  console.log("Setting collateral factor ", collateralFactor);
  await comptroller._setCollateralFactor(
    xMada.address,
    ethers.utils.parseEther(collateralFactor),
    {
      gasLimit: 200000,
    }
  );

  const reserveFactor = "0.20";
  console.log("Setting reserve factor ", reserveFactor);
  await xMada._setReserveFactor(ethers.utils.parseEther(reserveFactor), {
    gasLimit: 200000,
  });
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
