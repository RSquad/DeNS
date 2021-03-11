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
import deployDensDebot from "./parts/deploy-dens-debot";

describe("nic expiring test", () => {
  let client: TonClient;
  let smcNSEGiver: TonContract;
  let smcSafeMultisigWallet: TonContract;
  let smcStore: TonContract;
  let smcDensRoot: TonContract;
  let smcDensDeBot: TonContract;

  before(async () => {
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

  it("deploy DensDeBot", async () => {
    smcDensDeBot = await deployDensDebot(client, smcNSEGiver);
  });
});
