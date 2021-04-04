import { ethers, waffle } from "hardhat";
import { Contract } from "ethers";
import { expect } from "chai";
import {  getMessage, TypedData } from "eip-712";
import mintTypedData from "../types/Mint.json";

const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
const WITHDRAW_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("WITHDRAW_ROLE"));
const DEPOSITOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("DEPOSITOR_ROLE"));

export function makeMintMessage(contract: Contract, chainId: number, to: String, tokenId: number, extra: number) {
    const typedData: TypedData = {
        ...mintTypedData,
        domain: {
            ...mintTypedData.domain,
            chainId,
            verifyingContract: contract.address
        },
        message: {
            to,
            tokenId,
            extra
        }
    };
    return typedData;
}

const BASE_TOKEN_URI = "https://lmgtfy.app/?q=";

async function fixture() {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0];
    const minter = ethers.Wallet.createRandom();
    await accounts[1].sendTransaction({
        to: minter.address,
        value: (await accounts[1].getBalance()).div(2)
    });
    const minterSigningKey = minter._signingKey(); // yeah it's private, I know
    const minterAccount = accounts[2];
    const withdrawer = accounts[3];
    const depositor = accounts[7];
    const alice = accounts[4];
    const aliceAddress = await alice.getAddress();
    const bob = accounts[5];
    const bobAddress = await bob.getAddress();
    const eve = accounts[6];
    const eveAddress = await eve.getAddress();
    const factory = await ethers.getContractFactory("BoughtTheTopNFTChild");
    const contract = await factory.deploy();
    await contract.grantRole(MINTER_ROLE, minter.address);
    await contract.grantRole(MINTER_ROLE, await minterAccount.getAddress());
    await contract.grantRole(WITHDRAW_ROLE, await withdrawer.getAddress());
    await contract.grantRole(DEPOSITOR_ROLE, await depositor.getAddress());
    const onMintMockFactory = await ethers.getContractFactory("OnMintMock");
    const onMintMock = await onMintMockFactory.deploy();
    const onBurnMockFactory = await ethers.getContractFactory("OnBurnMock");
    const onBurnMock = await onBurnMockFactory.deploy();
    const onTransferMockFactory = await ethers.getContractFactory("OnTransferMock");
    const onTransferMock = await onTransferMockFactory.deploy();

    const chainId = (await ethers.provider.getNetwork()).chainId;
    return {
        accounts, deployer, minter, minterSigningKey, minterAccount, withdrawer, depositor,
        alice, aliceAddress, bob, bobAddress, eve, eveAddress, contract,
        onMintMock, onBurnMock, onTransferMock, chainId
    };
}

// https://stackoverflow.com/questions/48011353/how-to-unwrap-type-of-a-promise
type ThenArgRecursive<T> = T extends PromiseLike<infer U> ? ThenArgRecursive<U> : T

describe("BoughtTheTopNFTChild", function () {
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

        it("admin can change the mint fee", async () => {
            const fee = ethers.utils.parseEther("1");
            await fix.contract.setMintFee(fee);
            expect(await fix.contract.mintFee()).to.eq(fee);
        });

        it("other accounts cannot change the mint fee", async () => {
            const fee = ethers.utils.parseEther("1");
            await expect(fix.contract.connect(fix.alice).setMintFee(fee)).to.be.revertedWith("BoughtTheTopNFT: must have admin role");
        });
    });

    context("mint", async () => {
        it("validly signed mint can be claimed by owner", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);

            await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() });
            expect(await fix.contract.ownerOf(1337)).to.eq(fix.aliceAddress);
        });

        it("validly signed mint cannot be claimed by different account", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);

            await expect(fix.contract.connect(fix.bob).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() })).to.be.revertedWith("BoughtTheTopNFT: must have minter role");
        });

        it("invalidly signed mint is rejected", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            message.writeUInt8(message.readUInt8(0) + 1, 0);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);

            await expect(fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() })).to.be.revertedWith("BoughtTheTopNFT: must have minter role");
        });

        it("validly signed mint cannot be claimed by owner if fee underpaid", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);

            await expect(fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: (await fix.contract.mintFee()).sub(1) })).to.be.revertedWith("BoughtTheTopNFT: incorrect mint fee provided");
        });

        it("validly signed mint cannot be claimed by owner if fee overpaid", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);

            await expect(fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: (await fix.contract.mintFee()).add(1) })).to.be.revertedWith("BoughtTheTopNFT: incorrect mint fee provided");
        });

        it("cannot remint an existing NFT", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);

            await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() });
            await expect(fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() })).to.be.revertedWith("ERC721: token already minted");
        });
    });

    context("mintTo", async () => {
        it("validly signed mint can be minted to owner", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);

            await fix.contract.connect(fix.bob).mintTo(fix.aliceAddress, 1337, 0, v, r, s, { value: await fix.contract.mintFee() });
            expect(await fix.contract.ownerOf(1337)).to.eq(fix.aliceAddress);
        });

        it("invalidly signed mint is rejected", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            message.writeUInt8(message.readUInt8(0) + 1, 0);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);

            await expect(fix.contract.connect(fix.bob).mintTo(fix.aliceAddress, 1337, 0, v, r, s, { value: await fix.contract.mintFee() })).to.be.revertedWith("BoughtTheTopNFT: must have minter role");
        });

        it("validly signed mint cannot be minted to owner if fee is underpaid", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);

            await expect(fix.contract.connect(fix.bob).mintTo(fix.aliceAddress, 1337, 0, v, r, s, { value: (await fix.contract.mintFee()).sub(1) })).to.be.revertedWith("BoughtTheTopNFT: incorrect mint fee provided");
        });

        it("validly signed mint cannot be minted to owner if fee is overpaid", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);

            await expect(fix.contract.connect(fix.bob).mintTo(fix.aliceAddress, 1337, 0, v, r, s, { value: (await fix.contract.mintFee()).add(1) })).to.be.revertedWith("BoughtTheTopNFT: incorrect mint fee provided");
        });

        it("validly signed mint can be minted to owner for no fee if sender is minter", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);

            await fix.contract.connect(fix.minterAccount).mintTo(fix.aliceAddress, 1337, 0, v, r, s);
            expect(await fix.contract.ownerOf(1337)).to.eq(fix.aliceAddress);
        });
    });

    context("burn", async () => {
        it("owner can burn NFT", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);
            await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() });
            await fix.contract.connect(fix.alice).burn(1337);
            await expect(fix.contract.ownerOf(1337)).to.be.revertedWith("ERC721: owner query for nonexistent token");
        });

        it("non-owner cannot burn NFT", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);
            await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() });
            await expect(fix.contract.connect(fix.bob).burn(1337)).to.be.revertedWith("ERC721Burnable: caller is not owner nor approved");
        });

        it("owner can remint burned NFT", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);
            await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() });
            await fix.contract.connect(fix.alice).burn(1337);
            await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() });
            expect(await fix.contract.ownerOf(1337)).to.eq(fix.aliceAddress);
        });
    });

    context("withdrawFees", async () => {
        it("fees can be withdrawn by withdraw role", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);
            await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() });
            const balance = await fix.withdrawer.getBalance();
            await fix.contract.connect(fix.withdrawer).withdrawFees();
            const newBalance = await fix.withdrawer.getBalance();
            expect(newBalance).to.be.gt(balance);
        });

        it("fees cannot be withdrawn by account without withdraw role", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);
            await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() });
            await expect(fix.contract.connect(fix.alice).withdrawFees()).to.be.revertedWith("BoughtTheTopNFT: must have withdraw role");
        });
    });

    context("tokenURI", async () => {
        it("NFTs have expected tokenURI", async () => {
            await fix.contract.setBaseTokenURI(BASE_TOKEN_URI);

            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);
            await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() });

            expect(await fix.contract.ownerOf(1337)).to.eq(fix.aliceAddress);
            expect(await fix.contract.tokenURI(1337)).to.eq(BASE_TOKEN_URI + "1337")

            await fix.contract.setBaseTokenURI("/");
            expect(await fix.contract.tokenURI(1337)).to.eq("/1337")

            await fix.contract.setBaseTokenURI("");
            expect(await fix.contract.tokenURI(1337)).to.eq("");
        });

        it("invalid NFTs are rejected", async () => {
            await expect(fix.contract.tokenURI(1337)).to.be.revertedWith("ERC721Metadata: URI query for nonexistent token");
        });
    });

    context("balanceOf", async () => {
        it("accounts with no NFTs have zero balance", async () => {
            expect(await fix.contract.balanceOf(fix.aliceAddress)).to.eq(0);
        });

        it("accounts with NFTs have balance", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);
            await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() });
            expect(await fix.contract.balanceOf(fix.aliceAddress)).to.eq(1);
        });
    });

    context("transferFrom", async () => {
        it("owner can transfer NFTs", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);
            await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() });
            await fix.contract.connect(fix.alice).transferFrom(fix.aliceAddress, fix.bobAddress, 1337);
            expect(await fix.contract.ownerOf(1337)).to.eq(fix.bobAddress);
        });
    });

    context("onMint", async () => {
        it("admin can set onMint", async () => {
            await fix.contract.setOnMint(fix.onMintMock.address);
            expect(await fix.contract.onMint()).to.eq(fix.onMintMock.address);
        });

        it("other accounts cannot set onMint", async () => {
            await expect(fix.contract.connect(fix.alice).setOnMint(fix.onMintMock.address)).to.revertedWith("BoughtTheTopNFT: must have admin role");
        })

        it("called when set and not called when cleared", async () => {
            await fix.contract.setOnMint(fix.onMintMock.address);
            
            {
                const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
                const message = getMessage(typedData, true);
                const { r, s, v } = fix.minterSigningKey.signDigest(message);
                await expect(await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() }))
                    .to.emit(fix.onMintMock, 'MockMintEvent').withArgs(fix.aliceAddress, fix.aliceAddress, 1337, 0);
            }

            await fix.contract.setOnMint(ethers.constants.AddressZero);

            {
                const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1338, 0);
                const message = getMessage(typedData, true);
                const { r, s, v } = fix.minterSigningKey.signDigest(message);
                await expect(await fix.contract.connect(fix.alice).mint(1338, 0, v, r, s, { value: await fix.contract.mintFee() }))
                    .not.to.emit(fix.onMintMock, 'MockMintEvent');
            }
        });
    });

    context("onBurn", async () => {
        it("admin can set", async () => {
            await fix.contract.setOnBurn(fix.onBurnMock.address);
            expect(await fix.contract.onBurn()).to.eq(fix.onBurnMock.address);
        });

        it("other accounts cannot set", async () => {
            await expect(fix.contract.connect(fix.alice).setOnBurn(fix.onBurnMock.address)).to.revertedWith("BoughtTheTopNFT: must have admin role");
        })

        it("called when set and not called when cleared", async () => {
            await fix.contract.setOnBurn(fix.onBurnMock.address);
            
            {
                const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
                const message = getMessage(typedData, true);
                const { r, s, v } = fix.minterSigningKey.signDigest(message);
                await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() });
                await expect(await fix.contract.connect(fix.alice).burn(1337)).to.emit(fix.onBurnMock, 'MockBurnEvent').withArgs(1337);
            }

            await fix.contract.setOnBurn(ethers.constants.AddressZero);

            {
                const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1338, 0);
                const message = getMessage(typedData, true);
                const { r, s, v } = fix.minterSigningKey.signDigest(message);
                await fix.contract.connect(fix.alice).mint(1338, 0, v, r, s, { value: await fix.contract.mintFee() });
                await expect(await fix.contract.connect(fix.alice).burn(1338)).not.to.emit(fix.onBurnMock, 'MockBurnEvent');
            }
        });
    });

    context("onTransfer", async () => {
        it("admin can set", async () => {
            await fix.contract.setOnTransfer(fix.onTransferMock.address);
            expect(await fix.contract.onTransfer()).to.eq(fix.onTransferMock.address);
        });

        it("other accounts cannot set", async () => {
            await expect(fix.contract.connect(fix.alice).setOnTransfer(fix.onTransferMock.address)).to.revertedWith("BoughtTheTopNFT: must have admin role");
        })

        it("called when set and not called when cleared", async () => {
            await fix.contract.setOnTransfer(fix.onTransferMock.address);
            
            {
                const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
                const message = getMessage(typedData, true);
                const { r, s, v } = fix.minterSigningKey.signDigest(message);
                await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() });
                await expect(await fix.contract.connect(fix.alice).transferFrom(fix.aliceAddress, fix.bobAddress, 1337))
                    .to.emit(fix.onTransferMock, 'MockTransferEvent').withArgs(fix.aliceAddress, fix.bobAddress, 1337);
            }

            await fix.contract.setOnTransfer(ethers.constants.AddressZero);

            {
                const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1338, 0);
                const message = getMessage(typedData, true);
                const { r, s, v } = fix.minterSigningKey.signDigest(message);
                await fix.contract.connect(fix.alice).mint(1338, 0, v, r, s, { value: await fix.contract.mintFee() });
                await expect(await fix.contract.connect(fix.alice).transferFrom(fix.aliceAddress, fix.bobAddress, 1338))
                    .not.to.emit(fix.onTransferMock, 'MockTransferEvent');
            }
        });
    });

    context("withdraw", async () => {
        it("owner can withdraw NFT and NFT is not mintable while withdrawn", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);
            await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() });
            await fix.contract.connect(fix.alice).withdraw(1337);
            await expect(fix.contract.ownerOf(1337)).to.be.revertedWith("ERC721: owner query for nonexistent token");
            await expect(fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() }))
                .to.be.revertedWith("BoughtTheTopNFT: token exists on root chain");
        });

        it("non-owner cannot withdraw NFT", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);
            await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() });
            await expect(fix.contract.connect(fix.bob).withdraw(1337)).to.be.revertedWith("BoughtTheTopNFT: invalid token owner");
        });
    });

    context("deposit", async () => {
        it("depositor can deposit withdrawn NFTs", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);
            await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() });
            await fix.contract.connect(fix.alice).withdraw(1337);
            await fix.contract.connect(fix.depositor).deposit(fix.aliceAddress, ethers.utils.defaultAbiCoder.encode(['uint256'], [1337]));
            expect(await fix.contract.ownerOf(1337)).to.eq(fix.aliceAddress);
        });

        it("non-depositor cannot deposit withdrawn NFTs", async () => {
            const typedData = makeMintMessage(fix.contract, fix.chainId, fix.aliceAddress, 1337, 0);
            const message = getMessage(typedData, true);
            const { r, s, v } = fix.minterSigningKey.signDigest(message);
            await fix.contract.connect(fix.alice).mint(1337, 0, v, r, s, { value: await fix.contract.mintFee() });
            await fix.contract.connect(fix.alice).withdraw(1337);
            await expect(fix.contract.connect(fix.alice).deposit(fix.aliceAddress, ethers.utils.defaultAbiCoder.encode(['uint256'], [1337])))
                .to.be.revertedWith("BoughtTheTopNFT: must have depositor role");
        });
    });
});
