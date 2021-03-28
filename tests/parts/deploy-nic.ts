import { TonClient } from "@tonclient/core";
import TonContract from "../ton-contract";
import { utf8ToHex } from "../utils/convert";
import pkgNIC from "../../ton-packages/NIC.package";
import { trimlog } from "../utils/common";
import { waitForTransaction } from "../utils/net";
import { expect } from "chai";

export default async (
  client: TonClient,
  name: string,
  smcDensRoot: TonContract,
  smcSafeMultisigWallet: TonContract,
  expiresAt: number = Math.round(Date.now() / 1000) + 24 * 60 * 60
) => {
  const {
    transaction,
    decoded: {
      output: { addrNic },
    },
  } = await smcDensRoot.call({
    functionName: "forceRegisterNic",
    input: {
      name: utf8ToHex(name),
      owner: `0x${smcSafeMultisigWallet.keys.public}`,
      expiresAt,
    },
  });

  const smcNic = new TonContract({
    client,
    name: "NIC",
    address: addrNic,
    tonPackage: pkgNIC,
  });

  trimlog(`NIC address: ${smcNic.address},
  NIC balance: ${await smcNic.getBalance()}`);

  await waitForTransaction(
    client,
    {
      account_addr: { eq: smcNic.address },
      now: { ge: transaction.now },
      aborted: { eq: false },
    },
    "now aborted"
  );

  const whoisOutput = (await smcNic.run({ functionName: "whois" })).value;

  trimlog(`NIC whois output: ${JSON.stringify(whoisOutput)}`);

  const resolveOutput = (
    await smcDensRoot.run({
      functionName: "resolve",
      input: { name: utf8ToHex(name) },
    })
  ).value;

  expect(resolveOutput.addrNic).to.be.equal(smcNic.address);

  trimlog(`DensRoot resolve "google" output: ${resolveOutput.addrNic}`);

  return smcNic;
};
