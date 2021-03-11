import { TonClient } from "@tonclient/core";
import TonContract from "../ton-contract";
import pkgDensRoot from "../../ton-packages/DensRoot.package";
import { trimlog } from "../utils/common";
import { waitForTransaction } from "../utils/net";
import { utf8ToHex } from "../utils/convert";

export default async (
  client: TonClient,
  smcNSEGiver: TonContract,
  smcStore: TonContract
) => {
  const smcDensRoot = new TonContract({
    client,
    name: "DensRoot",
    tonPackage: pkgDensRoot,
    keys: await client.crypto.generate_random_sign_keys(),
  });

  await smcDensRoot.calcAddress();

  trimlog(`DensRoot address: ${smcDensRoot.address},
      DensRoot public: ${smcDensRoot.keys.public},
      DensRoot secret: ${smcDensRoot.keys.secret}`);

  await smcNSEGiver.call({
    functionName: "sendGrams",
    input: {
      dest: smcDensRoot.address,
      amount: 100_000_000_000,
    },
  });

  trimlog(`DensRoot balance: ${await smcDensRoot.getBalance()}`);

  const { transaction } = await smcDensRoot.deploy({
    input: { addrStore: smcStore.address },
  });

  trimlog(`Wait for DensRoot deploy`);

  await waitForTransaction(
    client,
    {
      account_addr: { eq: smcDensRoot.address },
      now: { ge: transaction.now },
      aborted: { eq: false },
    },
    "now aborted"
  );

  trimlog(`DensRoot deployed`);

  return smcDensRoot;
};
