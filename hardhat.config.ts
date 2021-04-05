import { HardhatUserConfig, task } from "hardhat/config";
import * as dotenv from "dotenv";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-abi-exporter";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "hardhat-gas-reporter";

dotenv.config();

const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID;
const MATICVIGIL_PROJECT_ID = process.env.MATICVIGIL_PROJECT_ID;
const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS as string;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY as string;
const MINTER_ADDRESS = process.env.MINTER_ADDRESS as string;
const MINTER_PRIVATE_KEY = process.env.MINTER_PRIVATE_KEY as string;
const WITHDRAWER_ADDRESS = process.env.WITHDRAWER_ADDRESS as string;
const WITHDRAWER_PRIVATE_KEY = process.env.WITHDRAWER_PRIVATE_KEY as string;
const REPORT_GAS = process.env.REPORT_GAS;
const CMC_API_KEY = process.env.CMC_API_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

const mainnetConfig = {
    url: "https://mainnet.infura.io/v3/" + INFURA_PROJECT_ID,
    chainId: 1,
    live: true,
    saveDeployments: true,
    accounts: [] as string[]
};

const ropstenConfig = {
    url: "https://ropsten.infura.io/v3/" + INFURA_PROJECT_ID,
    chainId: 3,
    live: true,
    saveDeployments: true,
    accounts: [] as string[]
};

const rinkebyConfig = {
    url: "https://rinkeby.infura.io/v3/" + INFURA_PROJECT_ID,
    chainId: 4,
    live: true,
    saveDeployments: true,
    accounts: [] as string[]
};

const maticConfig = {
    url: "https://rpc-mainnet.maticvigil.com/v1/" + MATICVIGIL_PROJECT_ID,
    chainId: 137,
    live: true,
    saveDeployments: true,
    accounts: [] as string[]
};

if (DEPLOYER_PRIVATE_KEY) {
    mainnetConfig.accounts.push(DEPLOYER_PRIVATE_KEY);
    ropstenConfig.accounts.push(DEPLOYER_PRIVATE_KEY);
    rinkebyConfig.accounts.push(DEPLOYER_PRIVATE_KEY);
    maticConfig.accounts.push(DEPLOYER_PRIVATE_KEY);
}
if (MINTER_PRIVATE_KEY) {
    mainnetConfig.accounts.push(MINTER_PRIVATE_KEY);
    ropstenConfig.accounts.push(MINTER_PRIVATE_KEY);
    rinkebyConfig.accounts.push(MINTER_PRIVATE_KEY);
    maticConfig.accounts.push(MINTER_PRIVATE_KEY);
}
if (WITHDRAWER_PRIVATE_KEY) {
    mainnetConfig.accounts.push(WITHDRAWER_PRIVATE_KEY);
    ropstenConfig.accounts.push(WITHDRAWER_PRIVATE_KEY);
    rinkebyConfig.accounts.push(WITHDRAWER_PRIVATE_KEY);
    maticConfig.accounts.push(WITHDRAWER_PRIVATE_KEY);
}

// Hardhat tasks
// Documentation: https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args, hre) => {
    const accounts = await hre.ethers.getSigners();
  
    for (const account of accounts) {
        console.log(account.address);
    }
});

task("set-base-token-uri", "set the baseTokenURI of the NFT Contract")
    .addParam("uri", "Base token URI")
    .setAction(async (args, hre) => {
        const account = (await hre.getNamedAccounts())['deployer'];
        const network = await hre.ethers.provider.getNetwork();
        const contractName = network.chainId === 1 ? "BoughtTheTopNFTRoot" : "BoughtTheTopNFTChild";
        const ethers = hre.ethers as any;
        const contract = await ethers.getContract(contractName, account);
        const tx = await contract.setBaseTokenURI(args.uri);
        console.log(tx.hash);
    });


task("set-on-mint", "set the onMint of the NFT Contract")
    .addParam("address", "Address")
    .setAction(async (args, hre) => {
        const account = (await hre.getNamedAccounts())['deployer'];
        const ethers = hre.ethers as any;
        const contract = await ethers.getContract("BoughtTheTopNFTChild", account);
        const tx = await contract.setOnMint(args.address);
        console.log(tx.hash);
    });

task("set-reward-parameters", "set reward parameters")
    .addParam("start", "Start block when rewards can be earned")
    .addParam("end", "End block when rewards can be earned")
    .addParam("eligibleStart", "Start block of NFTs eligible for rewards")
    .addParam("eligibleEnd", "End block of NFTs eligible for rewards")
    .addParam("vestingDays", "Vesting duration of rewards in days")
    .addParam("rewardAmount", "Amount of reward (in decimal tokens)")
    .setAction(async (args, hre) => {
        const account = (await hre.getNamedAccounts())['deployer'];
        const ethers = hre.ethers as any;
        const contract = await ethers.getContract("RewardVesting", account);
        const tokenAmount = hre.ethers.utils.parseUnits(args.rewardAmount, 18);
        const tx = await contract.setRewardParameters(args.start, args.end, args.eligibleStart, args.eligibleEnd, 
            args.vestingDays, tokenAmount);
        console.log(tx.hash);
    });

task("set-mint-fee", "set the mint fee")
    .addParam("fee", "Mint fee")
    .setAction(async (args, hre) => {
        const account = (await hre.getNamedAccounts())['deployer'];
        const ethers = hre.ethers as any;
        const contract = await ethers.getContract("BoughtTheTopNFTChild", account);
        const tx = await contract.setMintFee(args.fee);
        console.log(tx.hash);
    });

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.1",
        settings: {
            optimizer: {
                enabled: true,
                runs: 9999
            }
        }
    },
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            live: false,
            saveDeployments: false,
        },
        mainnet: mainnetConfig,
        rinkeby: rinkebyConfig,
        ropsten: ropstenConfig,
        matic: maticConfig
    },
    namedAccounts: {
        deployer: {
            default: 0,
            1: DEPLOYER_ADDRESS,
            137: DEPLOYER_ADDRESS,
        },
        minter: {
            default: 1,
            1: null,
            137: MINTER_ADDRESS,
        },
        withdrawer: {
            default: 2,
            1: null,
            137: WITHDRAWER_ADDRESS
        },
        childChainManagerProxy: {
            default: 3,
            1: null,
            137: '0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa',
        },
        mintableERC721PredicateProxy: {
            default: 4,
            1: '0x932532aA4c0174b8453839A6E44eE09Cc615F2b7',
            137: null
        }
    },
    abiExporter: {
        path: './abis',
        clear: true,
        flat: true,
        only: [':BoughtTheTop', 'RewardVesting']
    },
    gasReporter: {
        enabled: REPORT_GAS && REPORT_GAS === "true" ? true : false,
        coinmarketcap: CMC_API_KEY,
        currency: 'USD',
        showTimeSpent: true
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY
    }
};

export default config;
