import { ethers, waffle } from "hardhat";
import { expect } from "chai";
import { getMessage } from "eip-712";
import { makeMintMessage } from "./BoughtTheTopNFTChild";

const REWARD_TOKEN_INITIAL_SUPPLY = ethers.utils.parseUnits("5000000", 18);
const REWARD_AMOUNT = ethers.utils.parseUnits("100", 18);

describe("integration", function () {

    it("deployment, mint, and rewards", async () => {
        const accounts = await ethers.getSigners();
        const deployer = accounts[0];
        const minter = ethers.Wallet.createRandom();
        const minterSigningKey = minter._signingKey();
        const withdrawer = accounts[1];

        // 1_deploy_nft.ts
        const nft = await ethers.getContractFactory("BoughtTheTopNFTChild").then(x => x.deploy());
        const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
        const WITHDRAW_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("WITHDRAW_ROLE"));
        nft.grantRole(MINTER_ROLE, minter.address);
        nft.grantRole(WITHDRAW_ROLE, withdrawer.address);
        expect(await nft.hasRole(MINTER_ROLE, minter.address));
        expect(await nft.hasRole(WITHDRAW_ROLE, withdrawer.address));

        // 2_deploy_token.ts
        const token = await ethers.getContractFactory("BoughtTheTopTokenRoot").then(x => x.deploy());

        // 3_mint_token_supply.ts
        await token.mint(deployer.address, REWARD_TOKEN_INITIAL_SUPPLY);
        expect(await token.balanceOf(deployer.address)).eq(REWARD_TOKEN_INITIAL_SUPPLY);

        // 4_deploy_reward.ts
        const reward = await ethers.getContractFactory("RewardVesting").then(x => x.deploy(token.address, nft.address));
        expect(await reward.rewardToken()).eq(token.address);
        expect(await reward.caller()).eq(nft.address);

        // 5_set_onmint_to_reward.ts
        await nft.setOnMint(reward.address);
        expect(await nft.onMint()).eq(reward.address);

        const chainId = (await ethers.provider.getNetwork()).chainId;
        const mintFee = await nft.mintFee();
        const mint = async (id: number, extra: number, account: any = deployer) => {
            const message = getMessage(makeMintMessage(nft, chainId, account.address, id, extra), true);
            const { r, s, v } = minterSigningKey.signDigest(message);
            await nft.connect(account).mint(id, extra, v, r, s, { value: mintFee  });
        };

        // mint an NFT. rewards are inactive, but mint should will work
        await mint(1337, 0);
        expect((await reward.getTokenGrant(deployer.address)).amount).eq(0);

        // cannot remint an existing NFT
        await expect(mint(1337, 0)).revertedWith("ERC721: token already minted");

        // verify that accounts can't directly call onMint
        await expect(reward.onMint(deployer.address, deployer.address, 1337, 0)).revertedWith("RewardVesting::onMint: not caller");

        // start rewards for nfts with extra [0, 10] lasting for 5 blocks
        const blockNumber = await ethers.provider.getBlockNumber();
        await reward.setRewardParameters(blockNumber + 1, blockNumber + 5, 0, 10, 1, REWARD_AMOUNT);

        // mint an nft ineligible for rewards
        await mint(1338, 11);
        expect((await reward.getTokenGrant(deployer.address)).amount).eq(0);

        // mint nft eligible for rewards
        await mint(1339, 1);
        expect((await reward.getTokenGrant(deployer.address)).amount).eq(REWARD_AMOUNT);

        await ethers.provider.send("evm_mine", []);

        // rewards still vesting after claim ends
        const firstBlockClaimable = await reward.calculateGrantClaim(deployer.address);
        for (let i = 0 ; i < 5 ; ++i)
            await ethers.provider.send("evm_mine", []);
        const laterClaimable = await reward.calculateGrantClaim(deployer.address);
        expect(laterClaimable).gt(firstBlockClaimable);
        for (let i = 0 ; i < 5 ; ++i)
            await ethers.provider.send("evm_mine", []);
        const evenLaterClaimable = await reward.calculateGrantClaim(deployer.address);
        expect(evenLaterClaimable).gt(laterClaimable);

        // claim rewards, but no balance (whoops)
        await expect(reward.claimVestedTokens(deployer.address)).revertedWith("ERC20: transfer amount exceeds balance");

        // top off rewards, then claim
        await token.transfer(reward.address, REWARD_AMOUNT);
        await reward.claimVestedTokens(deployer.address);

        // mint nft eligible for rewards, except that rewards have ended
        await mint(1340, 1, accounts[2]);
        expect((await reward.getTokenGrant(accounts[2].address)).amount).eq(0);
    });
});