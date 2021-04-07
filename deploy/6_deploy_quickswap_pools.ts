import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const FACTORY_ABI = [
    {
        "type": "function",
        "stateMutability": "nonpayable",
        "payable": false,
        "outputs": [
            {
                "type": "address",
                "name": "pair",
                "internalType": "address"
            }
        ],
        "name": "createPair",
        "inputs": [
            {
                "type": "address",
                "name": "tokenA",
                "internalType": "address"
            },
            {
                "type": "address",
                "name": "tokenB",
                "internalType": "address"
            }
        ],
        "constant": false
    },
    {
        "type": "function",
        "stateMutability": "view",
        "payable": false,
        "outputs": [
            {
                "type": "address",
                "name": "",
                "internalType": "address"
            }
        ],
        "name": "getPair",
        "inputs": [
            {
                "type": "address",
                "name": "",
                "internalType": "address"
            },
            {
                "type": "address",
                "name": "",
                "internalType": "address"
            }
        ],
        "constant": true
    }
];

const FACTORY = '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32';

const BASE_TOKENS = [
    {
        symbol: 'WMATIC',
        address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
    },
    {
        symbol: 'QUICK',
        address: '0x831753DD7087CaC61aB5644b308642cc1c33Dc13'
    }
];

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { log, get } = deployments;

    const { deployer } = await getNamedAccounts();

    const network = await hre.ethers.provider.getNetwork();

    log("6) Deploy QuickSwap pools");

    if (network.chainId == 137) {
        const token = await get("BoughtTheTopTokenChild");
        const ethers = hre.ethers as any;
        const factory = await ethers.getContractAt(FACTORY_ABI, FACTORY, deployer);

        for (const {symbol, address} of BASE_TOKENS) {
            const exisiting = await factory.getPair(token.address, address);
            if (exisiting === hre.ethers.constants.AddressZero) {
                const pair = await factory.createPair(token.address, address);
                log(`- ${symbol}-BTT deployed: ${pair}`);
            }
            else
                log(`- ${symbol}-BTT already deployed: ${exisiting}`);
        }
    }
    else
        log(`- Skipped on this chain`);
};

export default func;
func.tags = ['6', 'DeployQuickSwapPools'];
func.dependencies = ['2'];
