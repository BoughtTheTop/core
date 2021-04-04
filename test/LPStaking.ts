import { ethers, waffle } from "hardhat";
import { expect } from "chai";

const REWARD_TOKEN_INITIAL_SUPPLY = ethers.utils.parseUnits("5000000", 18);
const REWARD_TOKEN_PER_BLOCK = ethers.utils.parseUnits(".2", 18);
const BONUS_REWARD_BLOCKS = 100;

async function fixture() {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    const alice = accounts[1];
    const bob = accounts[2];
    const eve = accounts[3];
    const tokenFactory = await ethers.getContractFactory("BoughtTheTopTokenRoot");
    const tokenContract = await tokenFactory.deploy();
    await tokenContract.mint(deployer.address, REWARD_TOKEN_INITIAL_SUPPLY);
    const factory = await ethers.getContractFactory("LPStaking");
    const blockNumber = await ethers.provider.getBlockNumber();
    const contract = await factory.deploy(tokenContract.address, deployer.address, REWARD_TOKEN_PER_BLOCK,
        blockNumber, blockNumber + BONUS_REWARD_BLOCKS);

    return { deployer, alice, bob, eve, contract, tokenContract };
}

// https://stackoverflow.com/questions/48011353/how-to-unwrap-type-of-a-promise
type ThenArgRecursive<T> = T extends PromiseLike<infer U> ? ThenArgRecursive<U> : T

describe("LPStaking", function () {
    let fix: ThenArgRecursive<ReturnType<typeof fixture>>;

    beforeEach(async function () {
        fix = await waffle.loadFixture(fixture);
    });

    context("add", async () => {
        it("constructor sets", async () => {
        });
    });
});
