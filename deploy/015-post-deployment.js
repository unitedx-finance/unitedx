const { ethers } = require("hardhat");

const MULTISIG_WALLET_ADDRESS = "0x";
const xTokens = ["xUSDCDelegator", "XMada"];

module.exports = async function({ getNamedAccounts, deployments }) {
  const comp = await ethers.getContract("Comp");
  const reservoir = await ethers.getContract("Reservoir");
  const complock = await ethers.getContract("CompLock");
  const unitroller = await ethers.getContract("Unitroller");
  const oracleAggregatorV1 = await ethers.getContract("OracleAggregatorV1");
  const timelock = await ethers.getContract("Timelock");
  const GovernorBravoDelegator = await ethers.getContract(
    "GovernorBravoDelegator"
  );
  const GovernorBravoDelegate = await ethers.getContract(
    "GovernorBravoDelegate"
  );
  const governorBravoDelegator = GovernorBravoDelegate.attach(
    GovernorBravoDelegator.address
  );

  console.log("Transferring 3.75B UTDX to Reservoir...");
  await (
    await comp.transfer(
      reservoir.address,
      ethers.utils.parseEther("3750000000")
    )
  ).wait();

  console.log("Transferring 1.25B UTDX to CompLock...");
  await (
    await comp.transfer(complock.address, ethers.utils.parseEther("1250000000"))
  ).wait();

  console.log(
    `Setting pending admin of Unitroller to ${MULTISIG_WALLET_ADDRESS}...`
  );
  await (await unitroller._setPendingAdmin(MULTISIG_WALLET_ADDRESS)).wait();

  console.log(
    `Setting pending admin of OracleAggregatorV1 to ${MULTISIG_WALLET_ADDRESS}...`
  );
  await (
    await oracleAggregatorV1.setPendingAdmin(MULTISIG_WALLET_ADDRESS)
  ).wait();

  for (const xTokenDelegatorDeploymentName of xTokens) {
    const xTokenDelegator = await ethers.getContract(
      xTokenDelegatorDeploymentName
    );
    console.log(
      `Setting pending admin of ${xTokenDelegatorDeploymentName} to ${MULTISIG_WALLET_ADDRESS}...`
    );
    await (
      await xTokenDelegator._setPendingAdmin(MULTISIG_WALLET_ADDRESS)
    ).wait();
  }

  console.log(
    `Setting pending admin of GovernorBravoDelegator to ${MULTISIG_WALLET_ADDRESS}...`
  );
  await (
    await governorBravoDelegator._setPendingAdmin(MULTISIG_WALLET_ADDRESS)
  ).wait();
};

module.exports.tags = ["PostDeployment"];
