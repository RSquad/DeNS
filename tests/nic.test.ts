import { TonClient } from "@tonclient/core";
import { createClient } from "./utils/client";
import TonContract from "./ton-contract";
import pkgNIC from "../ton-packages/NIC.package";
import pkgNSEGiver from "../ton-packages/NSEGiver.package";
import deployMultisig from "./parts/deploy-multisig";
import deployDensRoot from "./parts/deploy-dens-root";
import deployStore from "./parts/deploy-store";
import { trimlog } from "./utils/common";
import deploySubNic from "./parts/deploy-sub-nic";
import deployNic from "./parts/deploy-nic";
import { expect } from "chai";

describe("nic and subnics test", () => {
  let client: TonClient;
  let smcNSEGiver: TonContract;
  let smcSafeMultisigWallet: TonContract;
  let smcStore: TonContract;
  let smcDensRoot: TonContract;
  let smcNic: TonContract;
  let smcNic2: TonContract;
  let smcNic3: TonContract;

  before(async () => {
    trimlog(`Note that you need to uncomment "forceRegisterNic"
      function in DensRoot to complete this test`);

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

  it("deploy Nic, domain - google", async () => {
    smcNic = await deployNic(
      client,
      "google",
      smcDensRoot,
      smcSafeMultisigWallet
    );
  });

  it("deploy Nic2, domain - google/translate", async () => {
    smcNic2 = await deploySubNic(
      client,
      smcNic,
      "translate",
      "google/translate",
      smcNSEGiver,
      smcDensRoot,
      smcSafeMultisigWallet
    );
  });

  it("deploy Nic3, domain - google/translate/hello", async () => {
    smcNic3 = await deploySubNic(
      client,
      smcNic2,
      "hello",
      "google/translate/hello",
      smcNSEGiver,
      smcDensRoot,
      smcSafeMultisigWallet
    );
  });

  it(`Set Nic2 (google/translate) target`, async () => {
    trimlog(
      `Set Nic2 (google/translate) target ${smcSafeMultisigWallet.address}`
    );
    await smcNic2.call({
      functionName: "setTarget",
      input: {
        target: smcSafeMultisigWallet.address,
      },
      keys: smcSafeMultisigWallet.keys,
    });

    const { _whois } = (await smcNic2.run({ functionName: "whois" })).value;

    expect(_whois.target).to.be.equal(smcSafeMultisigWallet.address);

    trimlog(`Nic2 (google/translate) whois output:
      ${JSON.stringify(_whois)}`);
  });
});
