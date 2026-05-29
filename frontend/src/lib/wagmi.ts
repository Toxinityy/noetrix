import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";
import { env } from "@/lib/env";

export const mantleSepolia = defineChain({
  id: env.chainId,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: { default: { http: [env.rpcUrl] } },
  blockExplorers: { default: { name: "Mantlescan", url: env.explorerUrl } },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [mantleSepolia],
  connectors: [injected()],
  transports: { [mantleSepolia.id]: http(env.rpcUrl) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
