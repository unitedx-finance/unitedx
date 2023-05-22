module.exports = async function({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const comp = await ethers.getContract("Comp");
  const comptroller = await ethers.getContract("Comptroller");
  const dripRate = "0.5";

  await deploy("Reservoir", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [
      ethers.utils.parseEther(dripRate),
      comp.address,
      comptroller.address,
    ],
  });
};

module.exports.tags = ["Reservoir"];
