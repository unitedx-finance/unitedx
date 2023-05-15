// const WMADA = new Map();
// WMADA.set("2001", "");
// WMADA.set("200101", "");

// const MADA_PRICE_FEED = new Map();
// MADA_PRICE_FEED.set("2001", "");
// MADA_PRICE_FEED.set("200101", "");

module.exports = async function ({
  getChainId,
  getNamedAccounts,
  deployments,
}) {
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
    contract: "XMada",
  });
  await deployment.receipt;

  const xMada = await ethers.getContract("XMada");
  console.log("Supporting xMada market...");
  await comptroller._supportMarket(xMada.address, {
    gasLimit: 2000000,
  });

  const priceOracle = await ethers.getContract("SimplePriceOracle");
  console.log("Setting price feed source for xMada ");
  await priceOracle.setUnderlyingPrice(
    xMada.address,
    ethers.utils.parseUnits("0.38", 18)
  );

  const collateralFactor = "0.75";
  console.log("Setting collateral factor ", collateralFactor);
  await comptroller._setCollateralFactor(
    xMada.address,
    ethers.utils.parseEther(collateralFactor)
  );

  const reserveFactor = "0.20";
  console.log("Setting reserve factor ", reserveFactor);
  await xMada._setReserveFactor(ethers.utils.parseEther(reserveFactor));
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
