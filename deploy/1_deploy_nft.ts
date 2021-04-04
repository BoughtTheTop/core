import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy, execute, log } = deployments;

    const { deployer, minter, withdrawer, childChainManagerProxy, mintableERC721PredicateProxy } = await getNamedAccounts();

    const network = await hre.ethers.provider.getNetwork();
    const contractName = network.chainId === 1 ? 'BoughtTheTopNFTRoot' : 'BoughtTheTopNFTChild';

    log("1) Deploy NFT contract");
    const deployResult: any = await deploy(contractName, {
        from: deployer,
        contract: contractName,
        skipIfAlreadyDeployed: true,
        log: true
    });

    if (deployResult.newlyDeployed) {
        if (minter) {
            const MINTER_ROLE = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("MINTER_ROLE"));
            await execute(contractName, { from: deployer, log: true }, 'grantRole', MINTER_ROLE, minter);
        }

        if (withdrawer) {
            const WITHDRAW_ROLE = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("WITHDRAW_ROLE"));
            await execute(contractName, { from: deployer, log: true }, 'grantRole', WITHDRAW_ROLE, withdrawer);
        }

        if (childChainManagerProxy) {
            const DEPOSITOR_ROLE = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("DEPOSITOR_ROLE"));
            await execute(contractName, { from: deployer, log: true }, 'grantRole', DEPOSITOR_ROLE, childChainManagerProxy);
        }

        if (mintableERC721PredicateProxy) {
            const PREDICATE_ROLE = hre.ethers.utils.keccak256(hre.ethers.utils.toUtf8Bytes("PREDICATE_ROLE"));
            await execute(contractName, { from: deployer, log: true }, 'grantRole', PREDICATE_ROLE, mintableERC721PredicateProxy);
        }
    }
    else
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`);
};

export default func;
func.tags = ['1', 'DeployNFT']
