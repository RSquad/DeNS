import { TonClient } from "@tonclient/core";
const { exec } = require("child_process");
import TonContract from "../ton-contract";
import pkgDensDebot from "../../ton-packages/DensDebot.package";
import pkgDebot from "../../ton-packages/Debot.package";
import { trimlog } from "../utils/common";
import { utf8ToHex } from "../utils/convert";
const fs = require("fs");

export default async (client: TonClient, smcNSEGiver: TonContract) => {
  const smcDensDebot = new TonContract({
    client,
    name: "DensDebot",
    tonPackage: pkgDensDebot,
    keys: await client.crypto.generate_random_sign_keys(),
  });

  await smcDensDebot.calcAddress();

  trimlog(`DensDebot address: ${smcDensDebot.address},
      DensDebot public: ${smcDensDebot.keys.public},
      DensDebot secret: ${smcDensDebot.keys.secret}`);

  await smcNSEGiver.call({
    functionName: "sendGrams",
    input: {
      dest: smcDensDebot.address,
      amount: 100_000_000_000,
    },
  });

  trimlog(`DensDebot balance: ${await smcDensDebot.getBalance()}`);

  await smcDensDebot.deploy({});

  // console.log(pkgDebot.abi, utf8ToHex(JSON.stringify(pkgDebot.abi)));

  await new Promise<void>((resolve) => {
    fs.readFile("./sbin/DensDebot.abi.json", "utf8", async function(err, data) {
      if (err) {
        return console.log({ err });
      }
      const buf = Buffer.from(data, "ascii");
      var hexvalue = buf.toString("hex");

      await smcDensDebot.call({
        functionName: "setAbi",
        input: {
          debotAbi: hexvalue,
        },
      });

      resolve();
    });
  });

  console.log(
    `./bin/tonos-cli --url http://0.0.0.0 debot fetch ${smcDensDebot.address}`
  );

  return smcDensDebot;
};
