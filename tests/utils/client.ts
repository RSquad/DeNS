import { TonClient } from "@tonclient/core";
import { libNode } from "@tonclient/lib-node";

const NETWORK_MAP = {
  LOCAL: "http://0.0.0.0",
  DEVNET: "https://net.ton.dev",
};

export const createClient = (url = null) => {
  TonClient.useBinaryLibrary(libNode);
  return new TonClient({
    network: {
      server_address:
        url || NETWORK_MAP[process.env.NETWORK] || "https://net.ton.dev",
      network_retries_count: 10,
      message_retries_count: 10,
      message_processing_timeout: 120000,
      wait_for_timeout: 120000,
    },
  });
};
