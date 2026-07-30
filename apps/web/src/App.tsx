import {
  ArrowRightIcon,
  CheckCircleIcon,
  GlobeHemisphereWestIcon,
  LockKeyIcon,
  ShieldCheckIcon,
  WalletIcon,
} from "@phosphor-icons/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

const complianceSteps = [
  {
    label: "Sender A-Pass",
    detail: "Waiting for a connected wallet",
    icon: LockKeyIcon,
  },
  {
    label: "Recipient A-Pass",
    detail: "Waiting for a recipient",
    icon: ShieldCheckIcon,
  },
  {
    label: "A-Token policy",
    detail: "Tier and country rules will appear here",
    icon: GlobeHemisphereWestIcon,
  },
]

function App() {
  return (
    <div className="dark min-h-svh bg-background text-foreground">
      <header className="border-b border-white/8 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-400 text-emerald-950 shadow-[0_0_28px_rgba(52,211,153,0.28)]">
              <ShieldCheckIcon className="size-5" weight="fill" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">CleanGraph</p>
              <p className="text-xs text-muted-foreground">
                Powered by Cleanverse
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="hidden border-emerald-400/20 bg-emerald-400/8 text-emerald-300 sm:inline-flex"
            >
              Monad sandbox
            </Badge>
            <Button size="sm" variant="outline">
              <WalletIcon data-icon="inline-start" weight="bold" />
              Connect wallet
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-8 max-w-3xl">
          <Badge className="mb-4 bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
            RWA transfer preflight
          </Badge>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Move verified assets between eligible wallets.
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
            CleanGraph checks both counterparties against the A-Token policy
            before a Monad transaction reaches the wallet.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
          <Card className="border-white/8 bg-card/70 shadow-2xl shadow-black/20">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Transfer A-Token</CardTitle>
                  <CardDescription className="mt-1.5">
                    Enter a transaction intent to begin compliance preflight.
                  </CardDescription>
                </div>
                <div className="flex size-10 items-center justify-center rounded-xl border border-white/8 bg-white/4">
                  <ArrowRightIcon className="size-5 text-emerald-300" />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="asset">Asset</Label>
                <Select defaultValue="cg-rwa">
                  <SelectTrigger id="asset" className="w-full">
                    <SelectValue placeholder="Select an A-Token" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cg-rwa">
                      CG-RWA · Institutional Treasury
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient</Label>
                <Input
                  id="recipient"
                  placeholder="0x..."
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <div className="relative">
                  <Input
                    id="amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="pr-24"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
                    CG-RWA
                  </span>
                </div>
              </div>

              <Alert className="border-sky-400/15 bg-sky-400/6">
                <ShieldCheckIcon className="text-sky-300" />
                <AlertTitle>Preflight happens before signing</AlertTitle>
                <AlertDescription>
                  No transaction is broadcast until both A-Pass checks succeed.
                </AlertDescription>
              </Alert>

              <Button className="w-full bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
                Run compliance preflight
                <ArrowRightIcon data-icon="inline-end" weight="bold" />
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-white/8 bg-[#0a0d0c] shadow-2xl shadow-black/30">
            <CardHeader className="border-b border-white/8 bg-white/[0.025]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="font-mono text-sm uppercase tracking-[0.14em] text-emerald-300">
                    Compliance terminal
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    Cleanverse v5.6 orchestration trace
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="border-white/10 bg-white/5 font-mono text-[10px] text-muted-foreground"
                >
                  IDLE
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="space-y-0">
                {complianceSteps.map((step, index) => {
                  const Icon = step.icon

                  return (
                    <div key={step.label}>
                      <div className="flex gap-4 px-5 py-5 sm:px-6">
                        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/4 text-muted-foreground">
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-mono text-xs font-medium text-foreground">
                              {String(index + 1).padStart(2, "0")} · {step.label}
                            </p>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              QUEUED
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                            {step.detail}
                          </p>
                        </div>
                      </div>
                      {index < complianceSteps.length - 1 && (
                        <Separator className="bg-white/6" />
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-white/8 bg-emerald-400/[0.035] px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircleIcon className="size-5" />
                  <p className="font-mono text-xs">
                    Awaiting transaction intent...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default App
