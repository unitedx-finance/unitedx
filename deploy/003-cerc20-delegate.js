module.exports = async function({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("CErc20Delegate", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    gasLimit: 5000000,
    gasPrice: 60000000000
  });
};

module.exports.tags = ["CErc20Delegate"];
