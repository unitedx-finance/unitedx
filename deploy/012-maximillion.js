module.exports = async function({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const xMada = await ethers.getContract("XMada");

  await deploy("Maximillion", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [xMada.address],
  });
};

module.exports.tags = ["Maximillion"];
