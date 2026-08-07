import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  ClipboardTextIcon,
  CopyIcon,
  FileTextIcon,
  FingerprintIcon,
  GlobeHemisphereWestIcon,
  LockKeyIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
  WalletIcon,
} from "@phosphor-icons/react"
import { useState, type FormEvent } from "react"

import heroImage from "@/assets/hero.png"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  connectMeraWallet,
  createMeraWallet,
  disconnectMeraWallet,
  getMeraErrorMessage,
} from "@/lib/mera-wallet"

const policyChecks = [
  {
    icon: LockKeyIcon,
    title: "Sender identity",
    copy: "Confirm an active A-Pass before the transfer can begin.",
  },
  {
    icon: FingerprintIcon,
    title: "Recipient eligibility",
    copy: "Apply the same policy standard to the receiving wallet.",
  },
  {
    icon: GlobeHemisphereWestIcon,
    title: "Asset rules",
    copy: "Read the A-Token country and investor policy before signing.",
  },
]

function BrandMark() {
  return (
    <span className="grid size-8 place-items-center rounded-[10px] bg-[#b8f34a] text-[#13210d] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
      <ShieldCheckIcon className="size-[17px]" weight="fill" aria-hidden="true" />
    </span>
  )
}

function App() {
  const [view, setView] = useState<"landing" | "workspace">("landing")

  if (view === "workspace") {
    return <TransferWorkspace onBack={() => setView("landing")} />
  }

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#07100c] text-[#edf4ee] selection:bg-[#b8f34a] selection:text-[#13210d]">
      <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#07100c]/90 backdrop-blur-xl">
        <nav className="mx-auto flex h-[68px] max-w-[1400px] items-center justify-between px-5 sm:px-8" aria-label="Main navigation">
          <a href="#top" className="flex items-center gap-2.5 font-semibold tracking-[-0.02em]">
            <BrandMark />
            CleanGraph
          </a>

          <div className="hidden items-center gap-8 text-sm text-[#9cad9f] md:flex">
            <a className="transition-colors hover:text-[#edf4ee]" href="#workflow">Workflow</a>
            <a className="transition-colors hover:text-[#edf4ee]" href="#policy">Policy</a>
            <a className="transition-colors hover:text-[#edf4ee]" href="#evidence">Evidence</a>
          </div>

          <Button size="sm" className="rounded-[10px] bg-[#b8f34a] text-[#13210d] hover:bg-[#cbff67] active:translate-y-px" onClick={() => setView("workspace")}>
            Open workspace
            <ArrowRightIcon data-icon="inline-end" weight="bold" aria-hidden="true" />
          </Button>
        </nav>
      </header>

      <main id="top">
        <section className="relative mx-auto grid min-h-[calc(100dvh-68px)] max-w-[1400px] items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[0.96fr_1.04fr] lg:py-20">
          <div className="hero-enter relative max-w-[42rem]">
            <p className="mb-6 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b8f34a]">Compliance before settlement</p>
            <h1 className="max-w-[13ch] text-[clamp(3.35rem,6.2vw,6.15rem)] font-medium leading-[0.91] tracking-[-0.072em] text-[#f3f8f3]">
              Clear transfers before signing.
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-[#a9b8ad]">
              Verify both wallets against A-Token policy before a Monad transaction reaches the signature step.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="rounded-[10px] bg-[#b8f34a] px-6 text-[#13210d] hover:bg-[#cbff67] active:translate-y-px" onClick={() => setView("workspace")}>
                Open workspace
                <ArrowRightIcon data-icon="inline-end" weight="bold" aria-hidden="true" />
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-[10px] border-white/15 bg-white/[0.025] text-[#edf4ee] hover:bg-white/[0.07] hover:text-white active:translate-y-px">
                <a href="#workflow">Explore workflow</a>
              </Button>
            </div>
          </div>

          <div className="hero-visual relative mx-auto flex min-h-[31rem] w-full max-w-[42rem] items-center justify-center lg:min-h-[38rem]">
            <div className="absolute inset-0 rounded-[28px] border border-white/[0.08] bg-[radial-gradient(circle_at_50%_36%,rgba(184,243,74,0.13),transparent_38%),linear-gradient(145deg,rgba(255,255,255,0.045),rgba(255,255,255,0.01))]" />
            <div className="absolute inset-5 rounded-[21px] border border-white/[0.06]" aria-hidden="true" />
            <div className="absolute left-8 top-8 flex items-center gap-3 text-xs text-[#87998b] sm:left-11 sm:top-11">
              <span className="font-mono">PREFLIGHT SEQUENCE</span>
              <span className="h-px w-12 bg-white/15" aria-hidden="true" />
              <span>Monad</span>
            </div>
            <img src={heroImage} alt="Layered asset architecture representing policy-controlled settlement" className="relative w-[64%] max-w-[27rem] hue-rotate-[58deg] saturate-[0.72] drop-shadow-[0_34px_65px_rgba(0,0,0,0.42)]" />
            <div className="absolute bottom-8 left-8 right-8 rounded-[14px] border border-white/[0.1] bg-[#0b1711]/92 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:bottom-11 sm:left-11 sm:right-auto sm:w-[19rem]">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-[#edf4ee]">Preflight complete</span>
                <CheckCircleIcon className="size-5 text-[#b8f34a]" weight="fill" aria-hidden="true" />
              </div>
              <p className="mt-2 text-sm leading-6 text-[#9cad9f]">Every required policy check passed. The wallet can continue.</p>
            </div>
          </div>
        </section>

        <section id="workflow" className="border-y border-white/[0.08] bg-[#0a1510]">
          <div className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 lg:py-28">
            <div className="max-w-2xl">
              <h2 className="text-4xl font-medium tracking-[-0.05em] text-[#f3f8f3] sm:text-5xl">One decision between intent and signature.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#9cad9f]">CleanGraph turns a transfer request into a visible policy decision before settlement begins.</p>
            </div>

            <ol className="mt-14 grid border-y border-white/[0.1] md:grid-cols-3 md:divide-x md:divide-white/[0.1]">
              {[
                ["Connect", "An authorized wallet creates the transfer intent."],
                ["Preflight", "Cleanverse checks both parties and the asset rules."],
                ["Settle", "Only an approved request can reach wallet signing."],
              ].map(([title, copy], index) => (
                <li key={title} className="group border-b border-white/[0.1] py-7 last:border-0 md:border-0 md:px-8 md:first:pl-0 md:last:pr-0">
                  <div className="flex items-start gap-5">
                    <span className="font-mono text-xs text-[#b8f34a]">0{index + 1}</span>
                    <div>
                      <h3 className="text-xl font-medium text-[#edf4ee]">{title}</h3>
                      <p className="mt-3 max-w-xs leading-7 text-[#9cad9f]">{copy}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="policy" className="mx-auto grid max-w-[1400px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.12fr_0.88fr] lg:py-32">
          <article className="relative min-h-[34rem] overflow-hidden rounded-[18px] bg-[#b8f34a] p-7 text-[#13210d] sm:p-10 lg:p-12">
            <div className="absolute -right-20 -top-20 size-72 rounded-full border-[42px] border-[#13210d]/[0.06]" aria-hidden="true" />
            <CheckCircleIcon className="size-9" weight="fill" aria-hidden="true" />
            <div className="absolute bottom-8 left-7 right-7 sm:bottom-10 sm:left-10 sm:right-10 lg:bottom-12 lg:left-12 lg:right-12">
              <h2 className="max-w-[12ch] text-4xl font-medium leading-[0.98] tracking-[-0.055em] sm:text-5xl">Approval should mean more than a successful API call.</h2>
              <p className="mt-6 max-w-lg leading-7 text-[#28401d]">Eligibility must satisfy the A-Token policy. Technical success alone never unlocks signing.</p>
            </div>
          </article>

          <div className="flex flex-col justify-center">
            <h2 className="text-3xl font-medium tracking-[-0.045em] text-[#f3f8f3] sm:text-4xl">Three checks. One clear outcome.</h2>
            <div className="mt-8 border-t border-white/[0.1]">
              {policyChecks.map(({ icon: Icon, title, copy }) => (
                <article key={title} className="grid grid-cols-[2.75rem_1fr] gap-4 border-b border-white/[0.1] py-6">
                  <span className="grid size-11 place-items-center rounded-[12px] bg-white/[0.055] text-[#b8f34a]">
                    <Icon className="size-[21px]" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-medium text-[#edf4ee]">{title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-[#9cad9f]">{copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="evidence" className="px-5 pb-20 sm:px-8 lg:pb-32">
          <div className="mx-auto max-w-[1400px] overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#0a1510]">
            <div className="grid lg:grid-cols-[0.75fr_1.25fr]">
              <div className="flex min-h-56 items-center justify-center border-b border-white/[0.09] bg-[radial-gradient(circle_at_center,rgba(184,243,74,0.12),transparent_58%)] lg:border-b-0 lg:border-r">
                <span className="grid size-24 place-items-center rounded-[18px] border border-[#b8f34a]/20 bg-[#b8f34a]/[0.08] text-[#b8f34a]">
                  <FileTextIcon className="size-10" aria-hidden="true" />
                </span>
              </div>
              <div className="p-7 sm:p-10 lg:p-14">
                <h2 className="max-w-xl text-3xl font-medium tracking-[-0.045em] text-[#f3f8f3] sm:text-4xl">The decision stays understandable after settlement.</h2>
                <p className="mt-5 max-w-xl leading-7 text-[#9cad9f]">Surface the transaction record and a time-limited compliance report when the Cleanverse sandbox supports them.</p>
                <button type="button" onClick={() => setView("workspace")} className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#b8f34a] transition-colors hover:text-[#cbff67] active:translate-y-px">
                  Plan a transfer
                  <ArrowRightIcon className="size-4" weight="bold" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.08]">
          <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-8 px-5 py-16 sm:px-8 md:flex-row md:items-center lg:py-20">
            <div>
              <h2 className="max-w-xl text-3xl font-medium tracking-[-0.045em] text-[#f3f8f3] sm:text-4xl">Make the next transfer explain itself.</h2>
              <p className="mt-3 text-[#9cad9f]">Review eligibility before every settlement request.</p>
            </div>
            <Button size="lg" className="rounded-[10px] bg-[#b8f34a] px-6 text-[#13210d] hover:bg-[#cbff67] active:translate-y-px" onClick={() => setView("workspace")}>
              Open workspace
              <ArrowRightIcon data-icon="inline-end" weight="bold" aria-hidden="true" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-5 py-7 text-sm text-[#7e9183] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-medium text-[#b7c4ba]">CleanGraph</p>
          <p>Compliance orchestration for tokenized real-world assets.</p>
        </div>
      </footer>
    </div>
  )
}

type ComplianceCheck = {
  id: "sender-eligibility" | "recipient-eligibility" | "asset-rules"
  status: "approved" | "denied"
  code: string
  message: string
  checkedAt: string
}

type PreflightResult = {
  requestId: string
  approved?: boolean
  decisionCode?: string
  checks: ComplianceCheck[]
  error?: {
    code: string
    message: string
    fields?: Record<string, string[]>
  }
}

const evmAddressPattern = /^0x[0-9a-fA-F]{40}$/
const tokenAmountPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"

function TransferWorkspace({ onBack }: { onBack: () => void }) {
  const [sender, setSender] = useState("")
  const [recipient, setRecipient] = useState("")
  const [atokenAddress, setATokenAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [result, setResult] = useState<PreflightResult | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isConnectingWallet, setIsConnectingWallet] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)

  const checks = result?.checks ?? []
  const terminalStatus = isSubmitting
    ? "CHECKING"
    : result?.error
      ? "ERROR"
      : result?.approved
        ? "APPROVED"
        : result?.approved === false
          ? "DENIED"
          : "READY"

  async function runPreflight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setResult(null)

    if (!evmAddressPattern.test(sender)) {
      setFormError("Enter a valid sender EVM address.")
      return
    }

    if (!evmAddressPattern.test(recipient)) {
      setFormError("Enter a valid recipient EVM address.")
      return
    }

    if (!evmAddressPattern.test(atokenAddress)) {
      setFormError("Enter a valid A-Token contract address.")
      return
    }

    if (!tokenAmountPattern.test(amount) || !/[1-9]/.test(amount)) {
      setFormError("Enter an amount greater than zero with up to 18 decimal places.")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/compliance/preflight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain: "monad", sender, recipient, atokenAddress, amount }),
      })
      const payload = (await response.json()) as PreflightResult

      if (!response.ok && !payload.error) {
        throw new Error("The compliance service returned an unexpected response.")
      }

      setResult(payload)
    } catch {
      setResult({
        requestId: "Unavailable",
        checks: [],
        error: {
          code: "NETWORK_ERROR",
          message: "CleanGraph could not reach the compliance service. Confirm that the API is running and try again.",
        },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function connectWallet(mode: "create" | "connect") {
    setWalletError(null)
    setIsConnectingWallet(true)

    try {
      const wallet = mode === "create" ? await createMeraWallet() : await connectMeraWallet()
      setSender(wallet.address)
    } catch (error) {
      setWalletError(getMeraErrorMessage(error))
    } finally {
      setIsConnectingWallet(false)
    }
  }

  function disconnectWallet() {
    disconnectMeraWallet()
    setSender("")
    setResult(null)
  }

  return (
    <div className="min-h-[100dvh] bg-[#07100c] text-[#edf4ee] selection:bg-[#b8f34a] selection:text-[#13210d]">
      <header className="border-b border-white/[0.08] bg-[#07100c]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1500px] items-center justify-between px-5 sm:px-8">
          <button type="button" onClick={onBack} className="group flex items-center gap-3 font-semibold tracking-[-0.02em]">
            <BrandMark />
            <span>CleanGraph</span>
            <ArrowLeftIcon className="ml-1 size-4 text-[#718376] transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-3 text-sm text-[#9cad9f]">
            <span className="hidden font-mono text-xs sm:inline">{sender ? shortenAddress(sender) : "NO WALLET"}</span>
            <span className="rounded-[8px] border border-[#b8f34a]/20 bg-[#b8f34a]/[0.08] px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.08em] text-[#b8f34a]">SANDBOX</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:py-10">
        <div className="mb-8 flex flex-col justify-between gap-5 border-b border-white/[0.09] pb-7 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-[#b8f34a]">Transfer preflight</p>
            <h1 className="mt-3 text-3xl font-medium tracking-[-0.045em] text-[#f3f8f3] sm:text-4xl">Check eligibility before settlement.</h1>
          </div>
          <p className="max-w-lg text-sm leading-6 text-[#9cad9f]">Validate the transfer intent, then verify both parties against the selected A-Token policy.</p>
        </div>

        <div className="grid overflow-hidden rounded-[16px] border border-white/[0.09] bg-[#0a1510] lg:grid-cols-[minmax(22rem,0.78fr)_minmax(0,1.22fr)]">
          <form onSubmit={runPreflight} className="border-b border-white/[0.09] p-5 sm:p-7 lg:border-b-0 lg:border-r" noValidate>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium text-[#edf4ee]">Transfer intent</h2>
                <p className="mt-1 text-sm leading-6 text-[#87998b]">Preflight never requests a signature.</p>
              </div>
              <ClipboardTextIcon className="size-5 text-[#b8f34a]" aria-hidden="true" />
            </div>

            <div className="mt-7 space-y-5">
              <div className="rounded-[12px] border border-white/[0.09] bg-white/[0.025] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Label className="text-sm text-[#edf4ee]">Sender wallet</Label>
                    <p className="mt-1 text-xs leading-5 text-[#87998b]">Mera passkey wallet</p>
                  </div>
                  {sender && <Button type="button" variant="outline" size="sm" onClick={disconnectWallet} className="rounded-[8px] border-white/15 bg-transparent text-[#edf4ee] hover:bg-white/[0.06] hover:text-white">Disconnect</Button>}
                </div>

                {sender ? (
                  <p className="mt-4 break-all rounded-[8px] border border-[#b8f34a]/20 bg-[#b8f34a]/[0.07] px-3 py-2.5 font-mono text-xs leading-5 text-[#cef88a]">{sender}</p>
                ) : (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <Button type="button" size="sm" disabled={isConnectingWallet} onClick={() => connectWallet("create")} className="rounded-[8px] bg-[#b8f34a] text-[#13210d] hover:bg-[#cbff67]">
                      {isConnectingWallet ? <CircleNotchIcon className="size-4 animate-spin" aria-hidden="true" /> : <WalletIcon className="size-4" weight="bold" aria-hidden="true" />}
                      Create wallet
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={isConnectingWallet} onClick={() => connectWallet("connect")} className="rounded-[8px] border-white/15 bg-transparent text-[#edf4ee] hover:bg-white/[0.06] hover:text-white">Use existing</Button>
                  </div>
                )}

                {walletError && <p role="alert" className="mt-3 text-sm leading-6 text-[#f5c77c]">{walletError}</p>}
              </div>

              <Field label="Recipient wallet" value={recipient} onChange={setRecipient} placeholder="0x..." helpText="Wallet proposed to receive the asset." />
              <Field label="A-Token contract" value={atokenAddress} onChange={setATokenAddress} placeholder="0x..." helpText="Issued TRWA contract address on Monad." />
              <Field label="Amount" value={amount} onChange={setAmount} placeholder="0.00" helpText="Positive amount, up to 18 decimal places." inputMode="decimal" />
            </div>

            {formError && (
              <div role="alert" className="mt-5 flex gap-3 rounded-[10px] border border-[#f2bd68]/25 bg-[#f2bd68]/[0.08] p-4 text-sm leading-6 text-[#f5c77c]">
                <WarningCircleIcon className="mt-0.5 size-5 shrink-0" weight="fill" aria-hidden="true" />
                {formError}
              </div>
            )}

            <Button type="submit" size="lg" className="mt-7 w-full rounded-[10px] bg-[#b8f34a] text-[#13210d] hover:bg-[#cbff67] active:translate-y-px" disabled={isSubmitting}>
              {isSubmitting ? <CircleNotchIcon className="size-5 animate-spin" aria-hidden="true" /> : <ShieldCheckIcon className="size-5" weight="fill" aria-hidden="true" />}
              {isSubmitting ? "Running checks" : "Run preflight"}
            </Button>
          </form>

          <ComplianceTerminal checks={checks} result={result} status={terminalStatus} />
        </div>
      </main>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, helpText, inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; helpText: string; inputMode?: "decimal" }) {
  const id = label.toLowerCase().replaceAll(" ", "-")

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm text-[#dce6de]">{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} autoComplete="off" spellCheck={false} className="h-11 rounded-[9px] border-white/[0.1] bg-white/[0.035] px-3.5 text-[#edf4ee] placeholder:text-[#607265] focus-visible:border-[#b8f34a]/60 focus-visible:ring-[#b8f34a]/15" />
      <p className="text-xs leading-5 text-[#7e9183]">{helpText}</p>
    </div>
  )
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function ComplianceTerminal({ checks, result, status }: { checks: ComplianceCheck[]; result: PreflightResult | null; status: string }) {
  const terminalItems = [
    { id: "sender-eligibility", label: "Sender A-Pass" },
    { id: "recipient-eligibility", label: "Recipient A-Pass" },
    { id: "asset-rules", label: "A-Token policy" },
  ] as const

  return (
    <section aria-live="polite" className="flex min-h-[46rem] flex-col bg-[#08110d]">
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.09] px-5 py-5 sm:px-7">
        <div>
          <h2 className="font-mono text-xs font-semibold tracking-[0.08em] text-[#b8f34a]">DECISION TRACE</h2>
          <p className="mt-1.5 text-sm text-[#7e9183]">Cleanverse compliance sequence</p>
        </div>
        <span className={`rounded-[8px] border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.08em] ${status === "APPROVED" ? "border-[#b8f34a]/30 bg-[#b8f34a]/[0.08] text-[#b8f34a]" : status === "DENIED" || status === "ERROR" ? "border-[#f2bd68]/30 bg-[#f2bd68]/[0.08] text-[#f5c77c]" : "border-white/[0.1] bg-white/[0.035] text-[#9cad9f]"}`}>{status}</span>
      </div>

      <div className="flex-1">
        {terminalItems.map(({ id, label }, index) => {
          const check = checks.find((item) => item.id === id)
          const isDenied = check?.status === "denied"
          const isApproved = check?.status === "approved"
          const Icon = isDenied ? WarningCircleIcon : isApproved ? CheckCircleIcon : CircleNotchIcon

          return (
            <div key={id} className="border-b border-white/[0.075] px-5 py-6 sm:px-7 sm:py-7">
              <div className="flex gap-4">
                <span className={`grid size-10 shrink-0 place-items-center rounded-[11px] border ${isApproved ? "border-[#b8f34a]/25 bg-[#b8f34a]/[0.08] text-[#b8f34a]" : isDenied ? "border-[#f2bd68]/25 bg-[#f2bd68]/[0.08] text-[#f5c77c]" : "border-white/[0.09] bg-white/[0.03] text-[#607265]"}`}>
                  <Icon className="size-5" weight={isDenied || isApproved ? "fill" : "regular"} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-[#edf4ee]"><span className="mr-2 font-mono text-[10px] text-[#607265]">0{index + 1}</span>{label}</h3>
                    <span className={`font-mono text-[10px] font-semibold tracking-[0.05em] ${isApproved ? "text-[#b8f34a]" : isDenied ? "text-[#f5c77c]" : "text-[#607265]"}`}>{check ? check.status.toUpperCase() : "QUEUED"}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#9cad9f]">{check?.message ?? "Waiting for a transfer intent."}</p>
                  {check && <p className="mt-2 font-mono text-xs text-[#7e9183]">{check.code} {new Date(check.checkedAt).toLocaleTimeString()}</p>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-white/[0.09] bg-white/[0.02] px-5 py-5 sm:px-7">
        {result?.error ? (
          <div className="flex gap-3 text-sm leading-6 text-[#f5c77c]">
            <WarningCircleIcon className="mt-0.5 size-5 shrink-0" weight="fill" aria-hidden="true" />
            <div><span className="font-medium">{result.error.code}</span><p>{result.error.message}</p></div>
          </div>
        ) : result ? (
          <div className="flex items-start gap-3 text-sm leading-6 text-[#9cad9f]">
            <CopyIcon className="mt-0.5 size-5 shrink-0 text-[#b8f34a]" aria-hidden="true" />
            <div><p className="text-[#edf4ee]">{result.approved ? "Transfer can proceed to wallet signing." : "Transfer is blocked before wallet signing."}</p><p className="font-mono text-xs text-[#7e9183]">Request ID: {result.requestId}</p></div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-[#7e9183]">
            <LockKeyIcon className="size-4 text-[#607265]" aria-hidden="true" />
            Enter a transfer intent to begin the eligibility checks.
          </div>
        )}
      </div>
    </section>
  )
}

export default App
