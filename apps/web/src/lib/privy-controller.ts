import {
  useConnectWallet,
  type BaseConnectedEthereumWallet,
} from "@privy-io/react-auth"
import {
  useCallback,
  useRef,
  useState,
} from "react"
import type { EIP1193Provider } from "viem"

import {
  createExternalEvmWallet,
  ExternalWalletConnectionError,
  type ExternalEvmWallet,
  type ExternalWalletController,
} from "@/lib/wallet"

type PendingConnection = {
  resolve: (wallet: ExternalEvmWallet) => void
  reject: (error: Error) => void
}

export function useExternalWalletController(): ExternalWalletController {
  const [wallet, setWallet] = useState<ExternalEvmWallet | null>(null)
  const pendingConnection = useRef<PendingConnection | null>(null)

  const { connectWallet } = useConnectWallet({
    onSuccess({ wallet: connectedWallet }) {
      try {
        if (connectedWallet.type !== "ethereum") {
          throw new ExternalWalletConnectionError("CleanGraph requires an EVM wallet.")
        }
        const adapter = createWalletAdapter(connectedWallet)
        setWallet(adapter)
        pendingConnection.current?.resolve(adapter)
      } catch (error) {
        pendingConnection.current?.reject(asError(error))
      } finally {
        pendingConnection.current = null
      }
    },
    onError(error) {
      pendingConnection.current?.reject(new ExternalWalletConnectionError(error))
      pendingConnection.current = null
    },
  })

  const connect = useCallback(() => new Promise<ExternalEvmWallet>((resolve, reject) => {
    pendingConnection.current?.reject(new ExternalWalletConnectionError("A newer wallet connection was started."))
    pendingConnection.current = { resolve, reject }

    try {
      connectWallet({
        description: "Connect an EVM wallet to create an A-Pass and transfer TRWA.",
        walletChainType: "ethereum-only",
      })
    } catch (error) {
      pendingConnection.current = null
      reject(asError(error))
    }
  }), [connectWallet])

  const disconnect = useCallback(() => {
    pendingConnection.current?.reject(new ExternalWalletConnectionError("Wallet connection was cancelled."))
    pendingConnection.current = null
    wallet?.disconnect()
    setWallet(null)
  }, [wallet])

  return {
    enabled: true,
    wallet,
    connect,
    disconnect,
  }
}

function createWalletAdapter(wallet: BaseConnectedEthereumWallet): ExternalEvmWallet {
  return createExternalEvmWallet({
    address: wallet.address,
    label: wallet.meta.name,
    sign: (message) => wallet.sign(message),
    switchChain: (chainId) => wallet.switchChain(chainId),
    getProvider: async () => await wallet.getEthereumProvider() as EIP1193Provider,
    disconnect: () => wallet.disconnect(),
  })
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new ExternalWalletConnectionError(String(error))
}
