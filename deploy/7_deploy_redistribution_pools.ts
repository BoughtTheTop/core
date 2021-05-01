import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const REWARD_TOKENS = [
    {
        symbol: 'WMATIC-BTT-QLP',
        address: '0x395A32Dee341D69ac846D379d02e76aABbA95060'
    },
    {
        symbol: 'WMATIC',
        address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
    },
    {
        symbol: 'WETH',
        address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
    },
    {
        symbol: 'WBTC',
        address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6'
    },
    {
        symbol: 'USDC',
        address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
    },
    {
        symbol: 'USDT',
        address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
    },
    {
        symbol: 'DAI',
        address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
    },
];

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy, log, get } = deployments;

    const { deployer } = await getNamedAccounts();

    const network = await hre.ethers.provider.getNetwork();

    log("7) Deploy redistribution pools");

    if (network.chainId == 137) {
        const token = await get("BoughtTheTopTokenChild");

        for (const {symbol, address} of REWARD_TOKENS) {
            const deployResult: any = await deploy(`${symbol}RedistributionPool`, {
                from: deployer,
                contract: 'RedistributionPool',
                args: [deployer, deployer, token.address, address],
                skipIfAlreadyDeployed: true,
                log: true,
            });
    
            if (!deployResult.newlyDeployed)
                log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`);
        }
    }
    else
        log(`- Skipped on this chain`);
};

export default func;
func.tags = ['8', 'DeployRedistributionPools'];
func.dependencies = ['2'];
