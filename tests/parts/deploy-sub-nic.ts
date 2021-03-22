import { TonClient } from "@tonclient/core";
import TonContract from "../ton-contract";
import { utf8ToHex } from "../utils/convert";
import pkgNIC from "../../ton-packages/NIC.package";
import { trimlog } from "../utils/common";
import { waitForTransaction } from "../utils/net";
import { expect } from "chai";

export default async (
  client: TonClient,
  smcNic: TonContract,
  name: string,
  resolveName: string,
  smcNSEGiver: TonContract,
  smcDensRoot: TonContract,
  smcSafeMultisigWallet: TonContract
) => {
  await smcNSEGiver.call({
    functionName: "sendGrams",
    input: {
      dest: smcNic.address,
      amount: 2_000_000_000,
    },
  });

  const {
    transaction,
    decoded: {
      output: { addrNic },
    },
  } = await smcNic.call({
    functionName: "registerSub",
    input: {
      name: utf8ToHex(name),
      owner: `0x${smcSafeMultisigWallet.keys.public}`,
    },
    keys: smcSafeMultisigWallet.keys,
  });

  const smcNewNic = new TonContract({
    client,
    name: "NIC3",
    address: addrNic,
    tonPackage: pkgNIC,
  });

  trimlog(`NIC3 address: ${smcNewNic.address},
      NIC3 balance: ${await smcNewNic.getBalance()}`);

  await waitForTransaction(
    client,
    {
      account_addr: { eq: smcNic.address },
      now: { ge: transaction.now },
      aborted: { eq: false },
    },
    "now aborted"
  );

  const whoisOutput = (await smcNewNic.run({ functionName: "whois" })).value;

  trimlog(`NIC3 whois output: ${JSON.stringify(whoisOutput)}`);

  const resolveOutput = (
    await smcDensRoot.run({
      functionName: "resolve",
      input: { name: utf8ToHex(resolveName) },
    })
  ).value;

  expect(resolveOutput.addrNic).to.be.equal(smcNewNic.address);

  trimlog(
    `DensRoot resolve "google/translate/hello" output: ${resolveOutput.addrNic}`
  );

  return smcNewNic;
};
