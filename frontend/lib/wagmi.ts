import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain, type Transport } from "viem";

const IS_MAINNET = process.env.NEXT_PUBLIC_MAINNET === "1";

export const activeChain = IS_MAINNET
  ? defineChain({
      id: 4663,
      name: "Robinhood Chain",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
    })
  : defineChain({
      id: 46630,
      name: "Robinhood Testnet",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
      testnet: true,
    });

export const wagmiConfig = createConfig({
  chains: [activeChain],
  connectors: [injected()],
  transports: { [activeChain.id]: http() } as unknown as Record<typeof activeChain.id, Transport>,
});
