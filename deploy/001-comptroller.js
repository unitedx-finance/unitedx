module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("Unitroller", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
  });

  const unitroller = await ethers.getContract("Unitroller");

  await deploy("Comptroller", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
  });
  const Comptroller = await ethers.getContract("Comptroller");

  console.log("Setting Comptroller as implementation of Unitroller...");

  const gasLimit = await unitroller.estimateGas._setPendingImplementation(
    Comptroller.address
  );

  const deployment = await unitroller._setPendingImplementation(
    Comptroller.address
  );

  await deployment.receipt;
  await Comptroller._become(unitroller.address);
  await deployment.receipt;

  const comptroller = Comptroller.attach(unitroller.address);

  const closeFactor = "0.5";
  console.log("Setting close factor of ", closeFactor);
  comptroller._setCloseFactor(ethers.utils.parseEther(closeFactor));

  const liquidationIncentive = "1.08";
  console.log("Setting liquidation incentive of ", liquidationIncentive);
  await comptroller._setLiquidationIncentive(
    ethers.utils.parseEther(liquidationIncentive)
  );

  const priceOracle = await ethers.getContract("SimplePriceOracle");
  console.log("Setting price oracle ", priceOracle.address);
  await comptroller._setPriceOracle(priceOracle.address);
};

module.exports.tags = ["Comptroller"];
module.exports.dependencies = ["PriceOracle", "JumpRateModel"];
