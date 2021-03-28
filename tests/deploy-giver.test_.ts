import { TonClient } from "@tonclient/core";
import { createClient } from "./utils/client";
import TonContract from "./ton-contract";
import pkgNSEGiver from "../ton-packages/NSEGiver.package";
import pkgSafeMultisigWallet from "../ton-packages/SafeMultisigWallet.package";

describe("base", () => {
  let client: TonClient;
  let smcGiver: TonContract;
  let smcSafeMultisigWallet: TonContract;

  before(async () => {
    client = createClient();
    smcSafeMultisigWallet = new TonContract({
      client,
      name: "SafeMultisigWallet",
      tonPackage: pkgSafeMultisigWallet,
      address: process.env.SAFE_MULTISIG_WALLET_ADDRESS,
      keys: {
        public: process.env.SAFE_MULTISIG_WALLET_PUBLIC,
        secret: process.env.SAFE_MULTISIG_WALLET_SECRET,
      },
    });
  });

  it("deploy Giver", async () => {
    smcGiver = new TonContract({
      client,
      name: "Giver",
      tonPackage: pkgNSEGiver,
      keys: await client.crypto.generate_random_sign_keys(),
    });
    await smcGiver.calcAddress();
    await smcSafeMultisigWallet.call({
      functionName: "sendTransaction",
      input: {
        dest: smcGiver.address,
        value: 2000_000_000_000,
        flags: 1,
        bounce: false,
        payload: "",
      },
    });
    await smcGiver.deploy();
    console.log(smcGiver.keys, smcGiver.address);
  });
});
