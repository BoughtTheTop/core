import { ethers, waffle } from "hardhat";
import { expect } from "chai";

const REWARD_TOKEN_INITIAL_SUPPLY = ethers.utils.parseUnits("5000000", 18);

async function fixture() {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    const alice = accounts[1];
    const bob = accounts[2];
    const eve = accounts[3];
    const tokenFactory = await ethers.getContractFactory("BoughtTheTopTokenRoot");
    const tokenContract = await tokenFactory.deploy();
    await tokenContract.mint(deployer.address, REWARD_TOKEN_INITIAL_SUPPLY);
    const factory = await ethers.getContractFactory("RewardVesting");
    const contract = await factory.deploy(tokenContract.address, deployer.address);

    return { deployer, alice, bob, eve, contract, tokenContract };
}

// https://stackoverflow.com/questions/48011353/how-to-unwrap-type-of-a-promise
type ThenArgRecursive<T> = T extends PromiseLike<infer U> ? ThenArgRecursive<U> : T

describe("RewardVesting", function () {
    let fix: ThenArgRecursive<ReturnType<typeof fixture>>;

    beforeEach(async function () {
        fix = await waffle.loadFixture(fixture);
    });

    context("caller", async () => {
        it("constructor sets", async () => {
            expect(await fix.contract.caller()).to.eq(fix.deployer.address);
        });
        it("caller can call onMint", async () => {
            await fix.contract.onMint(ethers.constants.AddressZero, ethers.constants.AddressZero, 0, 0);
        });

        it("other addresses cannot call onMint", async () => {
            await expect(fix.contract.connect(fix.alice).onMint(ethers.constants.AddressZero, ethers.constants.AddressZero, 0, 0))
                .to.revertedWith("RewardVesting::onMint: not caller");
        });
    });

    context("rewardParameters", async () => {
        it("owner can set", async () => {
            await fix.contract.setRewardParameters(1, 2, 3, 4, 5, 10);
        });

        it("other accounts cannot set", async () => {
            await expect(fix.contract.connect(fix.alice).setRewardParameters(1, 2, 3, 4, 5, 10))
                .to.revertedWith("Ownable: caller is not the owner");
        });

        it("startBlock must be less than or equal to endBlock", async () => {
            await expect(fix.contract.setRewardParameters(2, 1, 3, 4, 5, 10))
                .to.revertedWith("RewardVesting: startBlock less than endBlock");
        });

        it("eligibleStartBlock must be less than or equal to eligibleEndBlock", async () => {
            await expect(fix.contract.setRewardParameters(1, 2, 4, 3, 5, 10))
                .to.revertedWith("RewardVesting: eligibleEndBlock less than eligibleStartBlock");
        });

        it("vestingDuration must greater than 0", async () => {
            await expect(fix.contract.setRewardParameters(1, 2, 3, 4, 0, 5))
                .to.revertedWith("RewardVesting: duration must be > 0");
        });

        it("vestingDuration must be less than 25 years", async () => {
            await expect(fix.contract.setRewardParameters(1, 2, 3, 4, 25*365 + 1, 6))
                .to.revertedWith("RewardVesting: duration more than 25 years");
        });
    });

    context("rewards", async () => {
        it("vest and claimable", async () => {
            const AVAILABLE_REWARDS = ethers.utils.parseUnits("150", 18);
            const VESTING_DURATION_IN_DAYS = 1;
            const REWARD_AMOUNT = ethers.utils.parseUnits("100", 18);
            const ELIGIBLE_START_BLOCK = 0;
            const ELIGIBLE_END_BLOCK = 10;
            const REWARD_PERIOD_BLOCKS = 10;

            await fix.tokenContract.transfer(fix.contract.address, AVAILABLE_REWARDS);

            let blockNumber = await ethers.provider.getBlockNumber();
            await fix.contract.setRewardParameters(blockNumber + 3, blockNumber + REWARD_PERIOD_BLOCKS + 3, 
                ELIGIBLE_START_BLOCK, ELIGIBLE_END_BLOCK, VESTING_DURATION_IN_DAYS, REWARD_AMOUNT);

            // eligible for rewards, but rewardEarnStartBlock not met
            await fix.contract.onMint(fix.alice.address, fix.alice.address, 0, 1);
            expect((await fix.contract.getTokenGrant(fix.alice.address)).amount).eq(0);

            // rewards started and eligible, but not a self-mint
            await fix.contract.onMint(fix.alice.address, fix.bob.address, 1, 1);
            expect((await fix.contract.getTokenGrant(fix.alice.address)).amount).eq(0);

            // rewards started and eligible
            await fix.contract.onMint(fix.alice.address, fix.alice.address, 1, 1);
            expect((await fix.contract.getTokenGrant(fix.alice.address)).amount).eq(REWARD_AMOUNT);
            expect(await fix.contract.calculateGrantClaim(fix.alice.address)).eq(0);
            expect(await fix.contract.vestedBalance(fix.alice.address)).eq(0);

            // rewards started, but not eligible
            await fix.contract.onMint(fix.bob.address, fix.bob.address, 2, 11);
            expect((await fix.contract.getTokenGrant(fix.bob.address)).amount).eq(0);
            expect(await fix.contract.calculateGrantClaim(fix.bob.address)).eq(0);
            expect(await fix.contract.vestedBalance(fix.bob.address)).eq(0);

            // already started reward
            await fix.contract.onMint(fix.alice.address, fix.alice.address, 3, 3);

            // at this point, alice should be on the second block of her reward
            expect(await fix.contract.vestedBalance(fix.alice.address)).gt(0);
            expect(await fix.contract.calculateGrantClaim(fix.alice.address)).gt(0);
            expect(await fix.contract.claimedBalance(fix.alice.address)).eq(0);

            // rewards can be claimed
            expect(await fix.contract.connect(fix.alice).claimVestedTokens(fix.alice.address));
            expect(await fix.tokenContract.balanceOf(fix.alice.address)).gt(0);
            expect(await fix.contract.claimedBalance(fix.alice.address)).gt(0);
        });
    });

    context("rescue", async () => {
        it("owner can rescue", async () => {
            await fix.tokenContract.transfer(fix.contract.address, REWARD_TOKEN_INITIAL_SUPPLY);
            expect(await fix.tokenContract.balanceOf(fix.deployer.address)).eq(0);
            await fix.contract.rescue(fix.tokenContract.address);
            expect(await fix.tokenContract.balanceOf(fix.deployer.address)).eq(REWARD_TOKEN_INITIAL_SUPPLY);
        });

        it("other accounts cannot rescue", async () => {
            await fix.tokenContract.transfer(fix.contract.address, REWARD_TOKEN_INITIAL_SUPPLY);
            expect(await fix.tokenContract.balanceOf(fix.deployer.address)).eq(0);
            await expect(fix.contract.connect(fix.alice).rescue(fix.tokenContract.address)).revertedWith("Ownable: caller is not the owner");
        });
    });

    context("transferFrom", async () => {
        it("owner has approval of reward token", async () => {
            await fix.tokenContract.transfer(fix.contract.address, REWARD_TOKEN_INITIAL_SUPPLY);
            expect(await fix.tokenContract.balanceOf(fix.deployer.address)).eq(0);
            await fix.tokenContract.transferFrom(fix.contract.address, fix.deployer.address, REWARD_TOKEN_INITIAL_SUPPLY);
            expect(await fix.tokenContract.balanceOf(fix.deployer.address)).eq(REWARD_TOKEN_INITIAL_SUPPLY);
        });

        it("other accounts do not have approval of reward token", async () => {
            await fix.tokenContract.transfer(fix.contract.address, REWARD_TOKEN_INITIAL_SUPPLY);
            expect(await fix.tokenContract.balanceOf(fix.deployer.address)).eq(0);
            await expect(fix.tokenContract.connect(fix.alice).transferFrom(fix.contract.address, fix.deployer.address, REWARD_TOKEN_INITIAL_SUPPLY))
                .revertedWith("ERC20: transfer amount exceeds allowance");
        }) 
    });
});