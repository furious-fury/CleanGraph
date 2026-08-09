import {
  PrivyProvider,
} from "@privy-io/react-auth"
import {
  type ReactNode,
} from "react"

import { createMonadChain } from "@cleangraph/contracts"

import type { FrontendConfig } from "@/lib/config"

export function CleanGraphPrivyProvider({
  config,
  children,
}: {
  config: FrontendConfig & { privyAppId: string }
  children: ReactNode
}) {
  const chain = createMonadChain({
    chainId: config.chainId,
    rpcUrl: config.rpcUrl,
    explorerUrl: config.explorerUrl,
    name: "Monad Testnet",
  })

  return (
    <PrivyProvider
      appId={config.privyAppId}
      config={{
        defaultChain: chain,
        supportedChains: [chain],
        loginMethods: ["wallet"],
        appearance: {
          walletChainType: "ethereum-only",
          showWalletLoginFirst: true,
          walletList: [
            "metamask",
            "coinbase_wallet",
            "rainbow",
            "detected_ethereum_wallets",
            "wallet_connect_qr",
          ],
        },
      }}
    >
      {children}
    </PrivyProvider>
  )
}
