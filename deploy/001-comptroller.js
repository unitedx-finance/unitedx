module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("Unitroller", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    autoMine: true,
  });

  const unitroller = await ethers.getContract("Unitroller");

  await deploy("Comptroller", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    autoMine: true,
  });

  const Comptroller = await ethers.getContract("Comptroller");

  console.log("Setting Comptroller as implementation of Unitroller...");

  const deployment = await unitroller._setPendingImplementation(
    Comptroller.address,
    { gasLimit: 5000000, gasPrice: 70000000000 }
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
  (
    await comptroller._setLiquidationIncentive(
      ethers.utils.parseEther(liquidationIncentive)
    )
  ).wait();

  const oracleAggregatorV1 = await ethers.getContract("OracleAggregatorV1");
  console.log("Setting price oracle aggregator", oracleAggregatorV1.address);
  (await comptroller._setPriceOracle(oracleAggregatorV1.address)).wait();
};

module.exports.tags = ["Comptroller"];
module.exports.dependencies = ["PriceOracle", "JumpRateModel"];
