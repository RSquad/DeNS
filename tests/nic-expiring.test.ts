import { TonClient } from "@tonclient/core";
import { createClient } from "./utils/client";
import TonContract from "./ton-contract";
import pkgNSEGiver from "../ton-packages/NSEGiver.package";
import deployMultisig from "./parts/deploy-multisig";
import deployDensRoot from "./parts/deploy-dens-root";
import deployStore from "./parts/deploy-store";
import { trimlog } from "./utils/common";
import deploySubNic from "./parts/deploy-sub-nic";
import deployNic from "./parts/deploy-nic";
import { expect } from "chai";

describe("nic expiring test", () => {
  let client: TonClient;
  let smcNSEGiver: TonContract;
  let smcSafeMultisigWallet: TonContract;
  let smcStore: TonContract;
  let smcDensRoot: TonContract;
  let smcNic: TonContract;

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
      smcSafeMultisigWallet,
      Math.round(Date.now() / 1000) + 30
    );
  });

  it(`Set Nic (google) target`, async () => {
    trimlog(`Set Nic (google) target ${smcSafeMultisigWallet.address}`);
    try {
      await smcNic.call({
        functionName: "setTarget",
        input: {
          target: smcSafeMultisigWallet.address,
        },
        keys: smcSafeMultisigWallet.keys,
      });
    } catch (err) {
      console.log(err);
    }

    const { _whois } = (await smcNic.run({ functionName: "whois" })).value;

    expect(_whois.target).to.be.equal(smcSafeMultisigWallet.address);

    trimlog(`Nic (google) whois output:
      ${JSON.stringify(_whois)}`);
  });

  it(`Destruct Nic before expired`, async () => {
    try {
      await smcNic.call({ functionName: "destruct" });
    } catch (err) {
      trimlog(
        `Nic (google) destruction error (it shows that Nic haven't expired yet): ${JSON.stringify(
          err
        )}`
      );
    }
  });

  it(`Destruct Nic after expired`, async () => {
    const densRootBalance = await smcDensRoot.getBalance();
    trimlog(`DensRoot balance: ${densRootBalance}`);

    await new Promise((resolve) => setTimeout(resolve, 30000));

    const { _whois } = (await smcNic.run({ functionName: "whois" })).value;

    trimlog(`Nic (google) whois output: ${JSON.stringify(_whois)}`);

    await smcNic.call({ functionName: "destruct" });

    trimlog(`Nic destructed`);

    try {
      const { _whois } = (await smcNic.run({ functionName: "whois" })).value;
      trimlog(`Nic (google) whois output: ${JSON.stringify(_whois)}`);
    } catch (err) {
      trimlog(
        `Nic (google) whois error (it shows that Nic has been destructed): ${JSON.stringify(
          err
        )}`
      );
    }

    expect(densRootBalance).to.be.lessThan(
      (await smcDensRoot.getBalance()) as number
    );

    trimlog(`DensRoot balance: ${await smcDensRoot.getBalance()}`);
  });

  it("deploy new Nic, domain - google", async () => {
    smcNic = await deployNic(
      client,
      "google",
      smcDensRoot,
      smcSafeMultisigWallet,
      Math.round(Date.now() / 1000) + 30
    );

    const { _whois } = (await smcNic.run({ functionName: "whois" })).value;

    trimlog(`Nic (google) whois output:
      ${JSON.stringify(_whois)}`);
  });
});
