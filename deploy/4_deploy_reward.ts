import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy, get, log } = deployments;

    const { deployer } = await getNamedAccounts();

    const network = await hre.ethers.provider.getNetwork();

    log("4) Deploy reward contract");

    if (network.chainId !== 1) {
        const nft = await get('BoughtTheTopNFTChild');
        const token = await get(network.chainId === 137 ? 'BoughtTheTopTokenChild' : 'BoughtTheTopTokenRoot');

        const deployResult: any = await deploy('RewardVesting', {
            from: deployer,
            contract: 'RewardVesting',
            args: [token.address, nft.address],
            skipIfAlreadyDeployed: true,
            log: true,
        });

        if (!deployResult.newlyDeployed)
            log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`);
    }
    else
        log(`- Skipped on this chain`);
};

export default func;
func.tags = ['4', 'DeployReward'];
func.dependencies = ['1', '2'];
