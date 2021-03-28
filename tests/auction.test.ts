import { TonClient } from "@tonclient/core";
import { createClient } from "./utils/client";
import TonContract from "./ton-contract";
import pkgNSEGiver from "../ton-packages/NSEGiver.package";
import pkgAuction from "../ton-packages/Auction.package";
import pkgBid from "../ton-packages/Bid.package";
import { trimlog } from "./utils/common";
import deployMultisig from "./parts/deploy-multisig";
import deployStore from "./parts/deploy-store";
import deployDensRoot from "./parts/deploy-dens-root";
import { utf8ToHex, genRandonHex } from "./utils/convert";
import { expect } from "chai";
import SafeMultisigWalletPackage from "../ton-packages/SafeMultisigWallet.package";
import { waitForTransaction } from "./utils/net";

describe("base", () => {
  let client: TonClient;
  let smcNSEGiver: TonContract;
  let smcSafeMultisigWallet: TonContract;
  let smcStore: TonContract;
  let smcDensRoot: TonContract;
  let smcAuction: TonContract;
  let smcBid: TonContract;
  let smcBid2: TonContract;
  let salt: string;
  let hashAmount: string;
  let salt2: string;
  let hashAmount2: string;

  before(async () => {
    // trimlog(`Note that you need to uncomment "forceRegisterNic"
    //   function in DensRoot to complete this test`);

    client = createClient();
    smcNSEGiver = new TonContract({
      client,
      name: "NSEGiver",
      tonPackage: pkgNSEGiver,
      address: process.env.NSE_GIVER_ADDRESS,
    });
  });

  it("deploy SafeMultisigWallet", async () => {
    smcSafeMultisigWallet = await deployMultisig(client, smcNSEGiver);
  });

  it("deploy Store", async () => {
    smcStore = await deployStore(client, smcNSEGiver);
  });

  it("deploy DensRoot", async () => {
    smcDensRoot = await deployDensRoot(client, smcNSEGiver, smcStore);
  });

  it(`register Nic "google"`, async () => {
    salt = `0x${genRandonHex(64)}`;
    hashAmount = (
      await smcDensRoot.run({
        functionName: "hashAmountWithSalt",
        input: { amount: 10e9, salt },
      })
    ).value.hash;

    console.log({
      hashAmount: hashAmount,
      owner: `0x${smcSafeMultisigWallet.keys.public}`,
    });

    const { body } = await client.abi.encode_message_body({
      abi: { type: "Contract", value: smcDensRoot.tonPackage.abi },
      signer: { type: "None" },
      is_internal: true,
      call_set: {
        function_name: "registerNic",
        input: {
          regBid: {
            name: utf8ToHex("google"),
            hashAmount: hashAmount,
            owner: `0x${smcSafeMultisigWallet.keys.public}`,
            duration: 3,
          },
        },
      },
    });
    const { transaction } = await smcSafeMultisigWallet.call({
      functionName: "sendTransaction",
      input: {
        dest: smcDensRoot.address,
        value: 1_500_000_000,
        flags: 3,
        bounce: true,
        payload: body,
      },
    });

    const { addrAuction } = (
      await smcDensRoot.run({
        functionName: "resolveAuction",
        input: { name: utf8ToHex("google") },
      })
    ).value;

    await waitForTransaction(
      client,
      {
        account_addr: { eq: addrAuction },
        now: { ge: transaction.now },
        aborted: { eq: false },
      },
      "now aborted"
    );

    smcAuction = new TonContract({
      client,
      name: "Auction",
      tonPackage: pkgAuction,
      address: addrAuction,
    });

    let { _state } = (
      await smcAuction.run({
        functionName: "_state",
      })
    ).value;

    trimlog(`Auction address: ${addrAuction},
      Auction balance: ${await smcAuction.getBalance()},
      Auction state: ${_state}`);
  });

  it(`register bid2`, async () => {
    salt2 = `0x${genRandonHex(64)}`;
    hashAmount2 = (
      await smcDensRoot.run({
        functionName: "hashAmountWithSalt",
        input: { amount: 5e9, salt: salt2 },
      })
    ).value.hash;

    console.log({
      hashAmount: hashAmount2,
      owner: `0x${(await client.crypto.generate_random_sign_keys()).public}`,
    });

    const { body: body2 } = await client.abi.encode_message_body({
      abi: { type: "Contract", value: smcAuction.tonPackage.abi },
      signer: { type: "None" },
      is_internal: true,
      call_set: {
        function_name: "placeBid",
        input: {
          hashAmount: hashAmount2,
          owner: `0x${
            (await client.crypto.generate_random_sign_keys()).public
          }`,
        },
      },
    });

    const { transaction } = await smcSafeMultisigWallet.call({
      functionName: "sendTransaction",
      input: {
        dest: smcAuction.address,
        value: 1_500_000_000,
        flags: 2,
        bounce: true,
        payload: body2,
      },
    });

    const { addrBid } = (
      await smcAuction.run({
        functionName: "resolveBid",
        input: { hashAmount: hashAmount2 },
      })
    ).value;
    await waitForTransaction(
      client,
      {
        account_addr: { eq: addrBid },
        now: { ge: transaction.now },
        aborted: { eq: false },
      },
      "now aborted"
    );

    smcBid2 = new TonContract({
      client,
      name: "Bid2",
      tonPackage: pkgBid,
      address: addrBid,
    });

    trimlog(`Bid2 address: ${addrBid},
      Bid2 balance: ${await smcBid2.getBalance()}`);
  });

  it(`force reveal state`, async () => {
    let { _state } = (
      await smcAuction.run({
        functionName: "_state",
      })
    ).value;

    trimlog(`Auction address: ${smcAuction.address},
      Auction balance: ${await smcAuction.getBalance()},
      Auction state: ${_state}`);

    const { addrBid } = (
      await smcAuction.run({
        functionName: "resolveBid",
        input: { hashAmount },
      })
    ).value;

    smcBid = new TonContract({
      client,
      name: "Bid",
      tonPackage: pkgBid,
      address: addrBid,
    });

    trimlog(`Bid address: ${addrBid},
      Bid balance: ${await smcBid.getBalance()}`);

    await smcAuction.call({ functionName: "forceRevealState" });

    _state = (
      await smcAuction.run({
        functionName: "_state",
      })
    ).value._state;

    expect(+_state).to.be.equal(1);

    trimlog(`Auction state: ${_state}`);
  });

  it(`reveal Bid with fake salt`, async () => {
    const { body } = await client.abi.encode_message_body({
      abi: { type: "Contract", value: smcBid.tonPackage.abi },
      signer: { type: "None" },
      is_internal: true,
      call_set: {
        function_name: "reveal",
        input: {
          amount: 1e9,
          salt: `0x${genRandonHex(64)}`,
        },
      },
    });
    const { transaction } = await smcSafeMultisigWallet.call({
      functionName: "sendTransaction",
      input: {
        dest: smcBid.address,
        value: 3_000_000_000,
        flags: 1,
        bounce: true,
        payload: body,
      },
    });
    await waitForTransaction(
      client,
      {
        account_addr: { eq: smcBid.address },
        now: { ge: transaction.now },
        aborted: { eq: false },
      },
      "now aborted"
    );

    const _maxAmount = (
      await smcAuction.run({
        functionName: "_maxAmount",
      })
    ).value._maxAmount;

    trimlog(`max amount after fake salt: ${_maxAmount}`);

    expect(+_maxAmount).to.be.equal(0);
  });

  it(`reveal Bids`, async () => {
    const { body } = await client.abi.encode_message_body({
      abi: { type: "Contract", value: smcBid.tonPackage.abi },
      signer: { type: "None" },
      is_internal: true,
      call_set: {
        function_name: "reveal",
        input: {
          amount: 10e9,
          salt,
        },
      },
    });

    const { body: body2 } = await client.abi.encode_message_body({
      abi: { type: "Contract", value: smcBid2.tonPackage.abi },
      signer: { type: "None" },
      is_internal: true,
      call_set: {
        function_name: "reveal",
        input: {
          amount: 5e9,
          salt: salt2,
        },
      },
    });

    const { transaction } = await smcSafeMultisigWallet.call({
      functionName: "sendTransaction",
      input: {
        dest: smcBid2.address,
        value: 7_000_000_000,
        flags: 1,
        bounce: true,
        payload: body2,
      },
    });
    await waitForTransaction(
      client,
      {
        account_addr: { eq: smcBid2.address },
        now: { ge: transaction.now },
        aborted: { eq: false },
      },
      "now aborted"
    );

    const { transaction: transaction2 } = await smcSafeMultisigWallet.call({
      functionName: "sendTransaction",
      input: {
        dest: smcBid.address,
        value: 12_000_000_000,
        flags: 1,
        bounce: true,
        payload: body,
      },
    });
    await waitForTransaction(
      client,
      {
        account_addr: { eq: smcBid.address },
        now: { ge: transaction2.now },
        aborted: { eq: false },
      },
      "now aborted"
    );
    console.log(
      await smcAuction.run({
        functionName: "_maxAmount",
      })
    );
    console.log(
      await smcAuction.run({
        functionName: "_secondAmount",
      })
    );
    console.log(
      await smcAuction.run({
        functionName: "_leader",
      })
    );
  });

  it(`force end state`, async () => {
    let { _state } = (
      await smcAuction.run({
        functionName: "_state",
      })
    ).value;

    trimlog(`Auction address: ${smcAuction.address},
      Auction balance: ${await smcAuction.getBalance()},
      Auction state: ${_state}`);

    try {
      await smcAuction.call({ functionName: "forceEndState" });
    } catch (err) {
      console.log(err);
    }

    _state = (
      await smcAuction.run({
        functionName: "_state",
      })
    ).value._state;

    expect(+_state).to.be.equal(2);

    trimlog(`Auction state: ${_state}`);

    trimlog(
      `SafeMultisigWallet balance: ${await smcSafeMultisigWallet.getBalance()}`
    );

    await smcBid.call({
      functionName: "refund",
      input: { dest: smcSafeMultisigWallet.address },
      keys: smcSafeMultisigWallet.keys,
    });

    trimlog(
      `SafeMultisigWallet balance: ${await smcSafeMultisigWallet.getBalance()}`
    );
  });
});
