import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { execute, read, log } = deployments;

    const { deployer } = await getNamedAccounts();

    if (process.env.BTT_TOKEN_INITIAL_SUPPLY === undefined)
        throw Error("BTT_TOKEN_INITIAL_SUPPLY not defined");

    const network = await hre.ethers.provider.getNetwork();

    log("3) Mint initial token supply");

    if (network.chainId != 137) {
        const supply = await read('BoughtTheTopTokenRoot', {}, 'totalSupply');
        if (supply == 0)
            await execute('BoughtTheTopTokenRoot', { from: deployer, log: true }, 'mint', deployer, process.env.BTT_TOKEN_INITIAL_SUPPLY);
        else
            log(`- Supply already minted: ${supply}`);
    }
    else
        log(`- Skipped on this chain`);
};

export default func;
func.tags = ['3', 'MintTokenSupply'];
func.dependencies = ['2'];