import App from "@/App"
import type { FrontendConfig } from "@/lib/config"
import {
  CleanGraphPrivyProvider,
} from "@/lib/external-wallet"
import { useExternalWalletController } from "@/lib/privy-controller"

function ConnectedApplication() {
  const externalWallet = useExternalWalletController()
  return <App externalWallet={externalWallet} />
}

export default function PrivyApplication({
  config,
}: {
  config: FrontendConfig & { privyAppId: string }
}) {
  return (
    <CleanGraphPrivyProvider config={config}>
      <ConnectedApplication />
    </CleanGraphPrivyProvider>
  )
}
