import { ethers, waffle } from "hardhat";
import { expect } from "chai";

const PREDICATE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PREDICATE_ROLE"));

const BASE_TOKEN_URI = "https://lmgtfy.app/?q=";

async function fixture() {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    const predicate = accounts[1];
    const alice = accounts[2];
    const aliceAddress = await alice.getAddress();
    const factory = await ethers.getContractFactory("BoughtTheTopNFTRoot");
    const contract = await factory.deploy();
    await contract.grantRole(PREDICATE_ROLE, await predicate.getAddress());

    const chainId = (await ethers.provider.getNetwork()).chainId;
    return {
        accounts, deployer, predicate,
        alice, aliceAddress, contract,
        chainId
    };
}

// https://stackoverflow.com/questions/48011353/how-to-unwrap-type-of-a-promise
type ThenArgRecursive<T> = T extends PromiseLike<infer U> ? ThenArgRecursive<U> : T

describe("BoughtTheTopNFTRoot", function () {
    let fix: ThenArgRecursive<ReturnType<typeof fixture>>;

    beforeEach(async function () {
        fix = await waffle.loadFixture(fixture);
    });

    context("settings", async () => {
        it("admin can change the base token URI", async () => {
            await fix.contract.setBaseTokenURI(BASE_TOKEN_URI);
            expect(await fix.contract.baseTokenURI()).to.equal(BASE_TOKEN_URI);
        });

        it("other accounts cannot change the base token URI", async () => {
            await expect(fix.contract.connect(fix.alice).setBaseTokenURI(BASE_TOKEN_URI)).to.revertedWith("BoughtTheTopNFT: must have admin role");
        });
    });

    context("mint", async() => {
        it("predicate can perform low-level mint", async () => {
            await fix.contract.connect(fix.predicate)["mint(address,uint256)"](fix.aliceAddress, 1337);
            expect(await fix.contract.ownerOf(1337)).to.eq(fix.aliceAddress);
        });

        it("predicate can perform low-level mint (metadata)", async () => {
            await fix.contract.connect(fix.predicate)["mint(address,uint256,bytes)"](fix.aliceAddress, 1337, [0xab]);
            expect(await fix.contract.ownerOf(1337)).to.eq(fix.aliceAddress);
        });

        it("non-predicate cannot perform low-level mint", async () => {
            await expect(fix.contract.connect(fix.alice)["mint(address,uint256)"](fix.aliceAddress, 1337))
                .to.be.revertedWith("BoughtTheTopNFT: must have predicate role");
        });

        it("non-predicate cannot perform low-level mint (metadata)", async () => {
            await expect(fix.contract.connect(fix.alice)["mint(address,uint256,bytes)"](fix.aliceAddress, 1337, [0xab]))
                .to.be.revertedWith("BoughtTheTopNFT: must have predicate role");
        });
    });
});
