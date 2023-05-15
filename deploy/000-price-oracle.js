const AGGREGATOR_ORACLES = new Map();
AGGREGATOR_ORACLES.set("2001", "0xc531410f61FA22e19048D406EDE3361b3de5c386");
AGGREGATOR_ORACLES.set("200101", "0x47a7d67e89E5714456b9af39703C1dc62203002A");

module.exports = async function({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("SimplePriceOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    contract: "SimplePriceOracle",
  });

  const chainId = await getChainId();
};

module.exports.tags = ["PriceOracle"];

module.exports.skip = async () => {
  const chainId = await getChainId();
  if (!AGGREGATOR_ORACLES.has(chainId)) {
    console.log("AGGREGATOR_ORACLES address missing");
    return true;
  }
};
