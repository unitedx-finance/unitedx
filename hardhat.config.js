require("dotenv").config();
require("@nomiclabs/hardhat-waffle");
require("hardhat-abi-exporter");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require("hardhat-spdx-license-identifier");
require("hardhat-watcher");
require("hardhat-contract-sizer");
require("hardhat-storage-layout-diff");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",
  mocha: {
    timeout: 20000,
  },
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
      gas: "auto",
    },
    c1_mainnet: {
      url: process.env.C1_MAINNET_RPC_URL,
      accounts: [`0x${process.env.PK}`],
      chainId: 2001,
      gas: "auto",
    },
    hardhat: {
      forking: {
        enabled: true,
        url: `https://rpc-devnet-cardano-evm.c1.milkomeda.com`,
        blockNumber: 12787541,
      },
      live: false,
      saveDeployments: true,
      tags: ["test", "local"],
    },
    // localhost: {
    //   url: " http://127.0.0.1:8545/", // Replace with your preferred localhost RPC URL
    // },
    localhost: {
      live: false,
      saveDeployments: true,
      tags: ["local"],
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
