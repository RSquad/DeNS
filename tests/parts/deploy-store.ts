import { TonClient } from "@tonclient/core";
import TonContract from "../ton-contract";
import pkgStore from "../../ton-packages/Store.package";
import pkgNIC from "../../ton-packages/NIC.package";
import pkgBid from "../../ton-packages/Bid.package";
import pkgAuction from "../../ton-packages/Auction.package";
import { trimlog } from "../utils/common";
import { expect } from "chai";

export default async (client: TonClient, smcNSEGiver: TonContract) => {
  const smcStore = new TonContract({
    client,
    name: "Store",
    tonPackage: pkgStore,
    keys: await client.crypto.generate_random_sign_keys(),
  });

  await smcStore.calcAddress();

  trimlog(`Store address: ${smcStore.address},
      Store public: ${smcStore.keys.public},
      Store secret: ${smcStore.keys.secret}`);

  await smcNSEGiver.call({
    functionName: "sendGrams",
    input: {
      dest: smcStore.address,
      amount: 10_000_000_000,
    },
  });

  trimlog(`Store balance: ${await smcStore.getBalance()}`);

  await smcStore.deploy();

  trimlog(`Set Auction image to Store`);

  await smcStore.call({
    functionName: "setAuctionImage",
    input: { image: pkgAuction.image },
  });

  trimlog(`Set Bid image to Store`);

  await smcStore.call({
    functionName: "setBidImage",
    input: { image: pkgBid.image },
  });

  trimlog(`Set Nic image to Store`);

  await smcStore.call({
    functionName: "setNicImage",
    input: { image: pkgNIC.image },
  });

  const storeImagesCount = Object.keys(
    (await smcStore.run({ functionName: "images" })).value.images
  ).length;

  expect(storeImagesCount).to.be.equal(3);

  trimlog(
    `Total Store images count: ${
      Object.keys((await smcStore.run({ functionName: "images" })).value.images)
        .length
    }`
  );

  return smcStore;
};
