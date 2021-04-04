import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { execute, read, log, get } = deployments;

    const { deployer } = await getNamedAccounts();

    const network = await hre.ethers.provider.getNetwork();

    log("5) Set onMint to reward contract");

    if (network.chainId != 1) {
        const reward = await get("RewardVesting");
        const onMint = await read('BoughtTheTopNFTChild', {}, 'onMint');
        if (onMint == 0)
            await execute('BoughtTheTopNFTChild', { from: deployer, log: true }, 'setOnMint', reward.address);
        else
            log(`- onMint already set: ${onMint}`);
    }
    else
        log(`- Skipped on this chain`);
};

export default func;
func.tags = ['5', 'SetOnMintToReward'];
func.dependencies = ['4'];
