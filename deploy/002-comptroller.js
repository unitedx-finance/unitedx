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

  if ((await unitroller.comptrollerImplementation()) !== Comptroller.address) {
    console.log("Setting Comptroller as implementation of Unitroller...");

    const deployment = await unitroller._setPendingImplementation(
      Comptroller.address,
      { gasLimit: 5000000, gasPrice: 70000000000 }
    );

    await deployment.receipt;

    console.log("Setting Comptroller to become Unitroller...");
    const becoming = await Comptroller._become(unitroller.address, {
      gasLimit: 5000000,
      gasPrice: 70000000000,
    });
    await becoming.receipt;
  }

  const comptroller = Comptroller.attach(unitroller.address);

  const closeFactor = "0.5";
  const closeFactorBN = ethers.utils.parseEther(closeFactor);
  if (!closeFactorBN.eq(await comptroller.closeFactorMantissa())) {
    console.log("Setting close factor of ", closeFactor);
    await (await comptroller._setCloseFactor(closeFactorBN)).wait();
  }

  const liquidationIncentive = "1.08";
  const liquidationIncentiveBN = ethers.utils.parseEther(liquidationIncentive);
  if (
    !liquidationIncentiveBN.eq(await comptroller.liquidationIncentiveMantissa())
  ) {
    console.log("Setting liquidation incentive of ", liquidationIncentive);
    await (
      await comptroller._setLiquidationIncentive(liquidationIncentiveBN)
    ).wait();
  }

  const oracleAggregatorV1 = await ethers.getContract("OracleAggregatorV1");
  if ((await comptroller.oracle()) !== oracleAggregatorV1.address) {
    console.log("Setting price oracle aggregator", oracleAggregatorV1.address);
    await (
      await comptroller._setPriceOracle(oracleAggregatorV1.address)
    ).wait();
  }
};

module.exports.tags = ["Comptroller"];
module.exports.dependencies = ["PriceOracle", "JumpRateModel"];
