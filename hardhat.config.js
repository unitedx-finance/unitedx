require("dotenv").config();
require("@nomiclabs/hardhat-waffle");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-toolbox");
require("hardhat-abi-exporter");
require("hardhat-deploy");
require("hardhat-spdx-license-identifier");
require("hardhat-watcher");
require("hardhat-contract-sizer");
require("hardhat-storage-layout-diff");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});
const DEFAULT_GAS_MUL = 5;
const GWEI = 1000 * 1000 * 1000;
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: {
      default: 0,
    },
    dev: {
      // Default to 1
      default: 0,
    },
  },
  networks: {
    c1_devnet: {
      url: process.env.C1_DEVNET_RPC_URL,
      accounts: [`0x${process.env.PK}`],
      chainId: 200101,
      gasMultiplier: DEFAULT_GAS_MUL,
      gasPrice: 40 * GWEI,
    },
    c1_mainnet: {
      url: process.env.C1_MAINNET_RPC_URL,
      accounts: [`0x${process.env.PK}`],
      chainId: 2001,
      gasMultiplier: DEFAULT_GAS_MUL,
      gasPrice: 40 * GWEI,
    },
    hardhat: {
      forking: {
        enabled: true,
        url: `https://rpc-devnet-cardano-evm.c1.milkomeda.com`,
        blockNumber: 14859999,
      },
      live: false,
      saveDeployments: true,
      tags: ["test", "local"],
    },
    localhost: {
      live: false,
      saveDeployments: true,
      tags: ["local"],
      forking: {
        enabled: true,
        url: `https://rpc-devnet-cardano-evm.c1.milkomeda.com`,
        blockNumber: 14859221,
      },
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
    spdxLicenseIdentifier: {
      overwrite: false,
      runOnCompile: true,
    },
    watcher: {
      compile: {
        tasks: ["compile"],
        files: ["./contracts"],
        verbose: true,
      },
    },
  },
  mocha: {
    timeout: 10000,
  },
  paths: {
    tests: "./test",
  },
};
