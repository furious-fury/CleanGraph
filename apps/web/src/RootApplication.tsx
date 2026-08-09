import { lazy, Suspense } from "react"

import App from "@/App"
import { resolveFrontendConfig } from "@/lib/config"
import { disabledExternalWalletController } from "@/lib/wallet"

const PrivyApplication = lazy(() => import("@/PrivyApplication"))
const frontendConfig = resolveFrontendConfig(import.meta.env)

export default function RootApplication() {
  if (!frontendConfig.ok || !frontendConfig.config.privyAppId) {
    return <App externalWallet={disabledExternalWalletController} />
  }

  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#07100c]" aria-label="Loading wallet connectors" />}>
      <PrivyApplication
        config={{ ...frontendConfig.config, privyAppId: frontendConfig.config.privyAppId }}
      />
    </Suspense>
  )
}
