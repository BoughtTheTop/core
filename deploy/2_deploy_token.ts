import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy, log, execute } = deployments;

    const { deployer, childChainManagerProxy } = await getNamedAccounts();

    const network = await hre.ethers.provider.getNetwork();
    const contractName = network.chainId === 137 ? 'BoughtTheTopTokenChild' : 'BoughtTheTopTokenRoot';

    log("2) Deploy token contract");
    const deployResult: any = await deploy(contractName, {
        from: deployer,
        contract: contractName,
        skipIfAlreadyDeployed: true,
        log: true
    });

    if (deployResult.newlyDeployed) {
        if (childChainManagerProxy) {
            const DEPOSITOR_ROLE = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("DEPOSITOR_ROLE"));
            await execute(contractName, { from: deployer, log: true }, 'grantRole', DEPOSITOR_ROLE, childChainManagerProxy);
        }
    }
    else
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`);
};

export default func;
func.tags = ['2', 'DeployToken']
