const { ethers } = require("hardhat");
module.exports = async ({ getNamedAccounts, deployments }) => {
  // 1 day in seconds
  const UTDX_CLAIM_UNLOCK_TIME = 24 * 60 * 60;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const utdx = await ethers.getContract("Comp");

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

    await (
      await unitroller._setPendingImplementation(Comptroller.address)
    ).wait();

    console.log("Setting Comptroller to become Unitroller...");
    await (await Comptroller._become(unitroller.address)).wait();
  }

  const comptroller = Comptroller.attach(unitroller.address);

  const dripRate = "250";
  await deploy("Reservoir", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      ethers.utils.parseEther(dripRate),
      utdx.address,
      comptroller.address,
    ],
  });
  const reservoir = await ethers.getContract("Reservoir");

  if (ethers.constants.Zero.eq(await comptroller.compUnlockTimestamp())) {
    console.log("Initializing UTDX parameters...");
    await (
      await comptroller._initializeCompParameters(
        UTDX_CLAIM_UNLOCK_TIME,
        utdx.address,
        reservoir.address
      )
    ).wait();
  }

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
