module.exports = async function({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("CompoundLens", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    autoMine: true,
  });

  await deploy("InterestRateModelLens", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    autoMine: true,
  });
};

module.exports.tags = ["UnitedXLens"];
