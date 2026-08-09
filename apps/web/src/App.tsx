import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowSquareOutIcon,
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
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react"
import {
  transactionIntentSchema,
  type ComplianceCheck,
} from "@cleangraph/shared"
import { getExplorerTransactionUrl } from "@cleangraph/contracts"
import { getAddress, type Hash } from "viem"

import heroImage from "@/assets/hero.png"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  requestPreflight,
  requestReadiness,
  type PreflightResult,
} from "@/lib/api"
import {
  DemoAPassActivationTimeoutError,
  DemoAPassApiError,
  getDemoAPassErrorMessage,
  requestDemoAPassChallenge,
  requestDemoAPassEnrollment,
  waitForDemoAPassActivation,
  type DemoAPassEnrollment,
  type DemoAPassProfile,
} from "@/lib/apass"
import {
  getBalanceErrorMessage,
  requestTrwaBalance,
} from "@/lib/balance"
import { resolveFrontendConfig } from "@/lib/config"
import {
  connectMeraWallet,
  createMeraWallet,
  disconnectMeraWallet,
  getMeraErrorMessage,
  signMeraMessage,
} from "@/lib/mera-wallet"
import {
  executeApprovedTransfer,
  getTransferErrorMessage,
  type ApprovedTransfer,
  type ConfirmedTransfer,
  type TransferPhase,
} from "@/lib/transfer"

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
    title: "TRWA policy",
    copy: "Apply CleanGraph's local group, subgroup, and country policy before signing.",
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
              Connect a passkey wallet, create or confirm its A-Pass, then verify both parties before a Monad transaction reaches signing.
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
              <h2 className="text-4xl font-medium tracking-[-0.05em] text-[#f3f8f3] sm:text-5xl">From wallet to A-Pass to a clear decision.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#9cad9f]">CleanGraph makes identity setup and transfer eligibility visible before settlement begins.</p>
            </div>

            <ol className="mt-14 grid border-y border-white/[0.1] md:grid-cols-3 md:divide-x md:divide-white/[0.1]">
              {[
                ["Connect", "Create or unlock a Mera passkey wallet."],
                ["Get an A-Pass", "Issue a fictional sandbox profile or use an existing credential."],
                ["Check and settle", "Only a compliant transfer can reach wallet signing."],
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
              <p className="mt-6 max-w-lg leading-7 text-[#28401d]">Eligibility must satisfy the local TRWA policy. Technical success alone never unlocks signing.</p>
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

type ClientPreflightError = {
  requestId: string
  checks: ComplianceCheck[]
  error: {
    code: string
    message: string
  }
}

type WorkspacePreflightResult = PreflightResult | ClientPreflightError
type ServiceState = "checking" | "ready" | "unavailable"
type BalanceState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; formatted: string }
  | { status: "error"; message: string }
type APassBusyStatus = "requesting" | "authorizing" | "issuing" | "pending"
type APassSetupState =
  | { status: "needed" }
  | { status: APassBusyStatus }
  | { status: "active"; enrollment: DemoAPassEnrollment }
  | { status: "existing" }
  | { status: "error"; message: string; requestId?: string }
type SettlementState =
  | { status: "idle" }
  | { status: TransferPhase; transactionHash?: Hash }
  | { status: "confirmed"; transfer: ConfirmedTransfer }
  | { status: "error"; message: string }

const frontendConfigResult = resolveFrontendConfig(import.meta.env)

function TransferWorkspace({ onBack }: { onBack: () => void }) {
  const [sender, setSender] = useState("")
  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  const [result, setResult] = useState<WorkspacePreflightResult | null>(null)
  const [approvedIntent, setApprovedIntent] = useState<ApprovedTransfer | null>(null)
  const [settlement, setSettlement] = useState<SettlementState>({ status: "idle" })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isConnectingWallet, setIsConnectingWallet] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [balance, setBalance] = useState<BalanceState>({ status: "idle" })
  const [apassProfile, setAPassProfile] = useState<DemoAPassProfile>("ELIGIBLE_GB")
  const [apassSetup, setAPassSetup] = useState<APassSetupState>({ status: "needed" })
  const [serviceState, setServiceState] = useState<ServiceState>("checking")
  const [serviceMessage, setServiceMessage] = useState("Checking compliance service readiness.")
  const preflightLock = useRef(false)
  const settlementLock = useRef(false)
  const balanceRequest = useRef(0)
  const apassRequest = useRef<AbortController | null>(null)

  const config = frontendConfigResult.ok ? frontendConfigResult.config : undefined
  const isSettling = ["authorizing", "simulating", "signing", "confirming"].includes(settlement.status)
  const isSettingUpAPass = ["requesting", "authorizing", "issuing", "pending"].includes(apassSetup.status)
  const hasAPass = apassSetup.status === "active" || apassSetup.status === "existing"
  const canEnterTransfer = sender !== "" && hasAPass

  const checks = result?.checks ?? []
  const terminalStatus = isSubmitting
    ? "CHECKING"
    : isPreflightError(result)
      ? "ERROR"
      : result && "approved" in result && result.approved
        ? "APPROVED"
        : result && "approved" in result && result.approved === false
          ? "DENIED"
          : "READY"

  const refreshBalance = useCallback(async (address: string) => {
    const request = ++balanceRequest.current

    if (!config) {
      setBalance({ status: "error", message: frontendConfigResult.ok ? "Monad configuration is unavailable." : frontendConfigResult.message })
      return
    }

    setBalance({ status: "loading" })

    try {
      const currentBalance = await requestTrwaBalance(config, getAddress(address))
      if (balanceRequest.current === request) {
        setBalance({ status: "ready", formatted: currentBalance.formatted })
      }
    } catch (error) {
      if (balanceRequest.current === request) {
        setBalance({ status: "error", message: getBalanceErrorMessage(error) })
      }
    }
  }, [config])

  const checkService = useCallback(async (signal?: AbortSignal) => {
    if (!frontendConfigResult.ok) {
      setServiceState("unavailable")
      setServiceMessage(frontendConfigResult.message)
      return
    }

    setServiceState("checking")
    setServiceMessage("Checking compliance service readiness.")

    try {
      const readiness = await requestReadiness(frontendConfigResult.config, signal)

      if (readiness.ready) {
        setServiceState("ready")
        setServiceMessage("Compliance service ready on Monad Testnet.")
      } else {
        setServiceState("unavailable")
        setServiceMessage("Compliance policy is not configured. Transfers remain disabled.")
      }
    } catch (error) {
      if (signal?.aborted) return
      setServiceState("unavailable")
      setServiceMessage(error instanceof Error
        ? "CleanGraph could not reach the API. Start it on port 3000, then retry."
        : "The compliance service is unavailable.")
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void checkService(controller.signal)
    return () => controller.abort()
  }, [checkService])

  useEffect(() => () => apassRequest.current?.abort(), [])

  useEffect(() => {
    if (sender) {
      void refreshBalance(sender)
      return
    }

    balanceRequest.current += 1
    setBalance({ status: "idle" })
  }, [refreshBalance, sender])

  function invalidateApproval() {
    setResult(null)
    setApprovedIntent(null)
    setSettlement({ status: "idle" })
    setFormError(null)
  }

  function changeRecipient(value: string) {
    setRecipient(value)
    invalidateApproval()
  }

  function changeAmount(value: string) {
    setAmount(value)
    invalidateApproval()
  }

  async function runPreflight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (preflightLock.current) return
    setFormError(null)
    setResult(null)
    setApprovedIntent(null)
    setSettlement({ status: "idle" })

    if (!config || serviceState !== "ready") {
      setFormError("The compliance service must be ready before preflight can run.")
      return
    }

    if (!hasAPass) {
      setFormError("Create a demo A-Pass or confirm that this wallet already has one before preflight.")
      return
    }

    let normalizedSender: string
    let normalizedRecipient: string

    try {
      normalizedSender = getAddress(sender)
      normalizedRecipient = getAddress(recipient)
    } catch {
      setFormError("Enter valid sender and recipient EVM addresses.")
      return
    }

    const parsedIntent = transactionIntentSchema.safeParse({
      chain: "monad",
      sender: normalizedSender,
      recipient: normalizedRecipient,
      tokenAddress: config.tokenAddress,
      amount,
    })

    if (!parsedIntent.success) {
      const fields = parsedIntent.error.flatten().fieldErrors
      setFormError(
        fields.sender?.[0] ??
        fields.recipient?.[0] ??
        fields.amount?.[0] ??
        "Enter a valid transfer intent.",
      )
      return
    }

    preflightLock.current = true
    setIsSubmitting(true)

    try {
      const payload = await requestPreflight(config, parsedIntent.data)
      setResult(payload)

      if ("approved" in payload && payload.approved) {
        setApprovedIntent({
          sender: getAddress(parsedIntent.data.sender),
          recipient: getAddress(parsedIntent.data.recipient),
          amount: parsedIntent.data.amount,
        })
      } else if ("error" in payload && payload.error.code === "SERVICE_NOT_CONFIGURED") {
        setServiceState("unavailable")
        setServiceMessage("Compliance policy is not configured. Transfers remain disabled.")
      }
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
      preflightLock.current = false
      setIsSubmitting(false)
    }
  }

  async function settleApprovedTransfer() {
    if (settlementLock.current || !config || !approvedIntent || !result || !("approved" in result) || !result.approved) return

    settlementLock.current = true
    setSettlement({ status: "authorizing" })
    try {
      const confirmed = await executeApprovedTransfer(
        config,
        approvedIntent,
        (phase, transactionHash) => {
          setSettlement({
            status: phase,
            ...(transactionHash === undefined ? {} : { transactionHash }),
          })
        },
      )
      setSettlement({ status: "confirmed", transfer: confirmed })
      void refreshBalance(approvedIntent.sender)
    } catch (error) {
      setSettlement({ status: "error", message: getTransferErrorMessage(error) })
      setApprovedIntent(null)
    } finally {
      settlementLock.current = false
    }
  }

  async function connectWallet(mode: "create" | "connect") {
    setWalletError(null)
    setIsConnectingWallet(true)

    try {
      const wallet = mode === "create" ? await createMeraWallet() : await connectMeraWallet()
      apassRequest.current?.abort()
      setSender(wallet.address)
      setAPassSetup({ status: "needed" })
      invalidateApproval()
    } catch (error) {
      setWalletError(getMeraErrorMessage(error))
    } finally {
      setIsConnectingWallet(false)
    }
  }

  function disconnectWallet() {
    apassRequest.current?.abort()
    apassRequest.current = null
    disconnectMeraWallet()
    setSender("")
    setAPassSetup({ status: "needed" })
    setResult(null)
    setApprovedIntent(null)
    setSettlement({ status: "idle" })
  }

  function useExistingAPass() {
    apassRequest.current?.abort()
    apassRequest.current = null
    invalidateApproval()
    setAPassSetup({ status: "existing" })
  }

  function resetAPassSetup() {
    apassRequest.current?.abort()
    apassRequest.current = null
    invalidateApproval()
    setAPassSetup({ status: "needed" })
  }

  async function createDemoAPass() {
    if (!config || serviceState !== "ready" || sender === "" || isSettingUpAPass) return

    let walletAddress: ReturnType<typeof getAddress>
    try {
      walletAddress = getAddress(sender)
    } catch {
      setAPassSetup({ status: "error", message: "Reconnect a valid sender wallet before creating an A-Pass." })
      return
    }

    apassRequest.current?.abort()
    const controller = new AbortController()
    apassRequest.current = controller
    invalidateApproval()
    setAPassSetup({ status: "requesting" })

    try {
      const challenge = await requestDemoAPassChallenge(config, walletAddress, controller.signal)
      setAPassSetup({ status: "authorizing" })
      const signature = await signMeraMessage(walletAddress, challenge.message)

      if (controller.signal.aborted) return
      setAPassSetup({ status: "issuing" })
      const enrollment = await requestDemoAPassEnrollment(config, {
        walletAddress,
        challengeId: challenge.challengeId,
        signature,
        profile: apassProfile,
      }, controller.signal)

      if (enrollment.state === "ACTIVE") {
        setAPassSetup({ status: "active", enrollment })
        return
      }

      setAPassSetup({ status: "pending" })
      const activeEnrollment = await waitForDemoAPassActivation(config, enrollment, {
        signal: controller.signal,
      })
      setAPassSetup({ status: "active", enrollment: activeEnrollment })
    } catch (error) {
      if (controller.signal.aborted) return

      if (error instanceof DemoAPassApiError || error instanceof DemoAPassActivationTimeoutError) {
        setAPassSetup({
          status: "error",
          message: getDemoAPassErrorMessage(error),
          ...(error instanceof DemoAPassApiError && error.requestId !== undefined
            ? { requestId: error.requestId }
            : {}),
        })
      } else {
        setAPassSetup({ status: "error", message: getMeraErrorMessage(error) })
      }
    } finally {
      if (apassRequest.current === controller) apassRequest.current = null
    }
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
            <span className={`rounded-[8px] border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.08em] ${serviceState === "ready" ? "border-[#b8f34a]/20 bg-[#b8f34a]/[0.08] text-[#b8f34a]" : serviceState === "checking" ? "border-white/[0.1] bg-white/[0.035] text-[#9cad9f]" : "border-[#f2bd68]/25 bg-[#f2bd68]/[0.08] text-[#f5c77c]"}`}>
              {serviceState === "ready" ? "SERVICE READY" : serviceState === "checking" ? "CHECKING" : "UNAVAILABLE"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:py-10">
        <div className="mb-8 flex flex-col justify-between gap-5 border-b border-white/[0.09] pb-7 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-[#b8f34a]">Compliant transfer workspace</p>
            <h1 className="mt-3 text-3xl font-medium tracking-[-0.045em] text-[#f3f8f3] sm:text-4xl">Connect, qualify, then settle.</h1>
          </div>
          <p className="max-w-lg text-sm leading-6 text-[#9cad9f]">Create or confirm an A-Pass for the sender, then verify both wallets against CleanGraph's TRWA policy.</p>
        </div>

        <div role="status" className={`mb-5 flex flex-col gap-3 rounded-[12px] border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${serviceState === "ready" ? "border-[#b8f34a]/20 bg-[#b8f34a]/[0.06] text-[#c9e6a3]" : serviceState === "checking" ? "border-white/[0.09] bg-white/[0.025] text-[#9cad9f]" : "border-[#f2bd68]/25 bg-[#f2bd68]/[0.07] text-[#f5c77c]"}`}>
          <div className="flex items-center gap-3">
            {serviceState === "ready" ? <CheckCircleIcon className="size-5 shrink-0 text-[#b8f34a]" weight="fill" aria-hidden="true" /> : serviceState === "checking" ? <CircleNotchIcon className="size-5 shrink-0 animate-spin" aria-hidden="true" /> : <WarningCircleIcon className="size-5 shrink-0" weight="fill" aria-hidden="true" />}
            <span>{serviceMessage}</span>
          </div>
          {serviceState === "unavailable" && frontendConfigResult.ok && (
            <Button type="button" size="sm" variant="outline" onClick={() => void checkService()} className="rounded-[8px] border-[#f2bd68]/25 bg-transparent text-[#f5c77c] hover:bg-[#f2bd68]/10 hover:text-[#f9d79f]">
              Retry readiness
            </Button>
          )}
        </div>

        <FlowRail
          walletConnected={sender !== ""}
          apassReady={hasAPass}
          transferConfirmed={settlement.status === "confirmed"}
        />

        <div className="mt-5 grid overflow-hidden rounded-[16px] border border-white/[0.09] bg-[#0a1510] lg:grid-cols-[minmax(22rem,0.78fr)_minmax(0,1.22fr)]">
          <form onSubmit={runPreflight} className="border-b border-white/[0.09] p-5 sm:p-7 lg:border-b-0 lg:border-r" noValidate>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium text-[#edf4ee]">Wallet and transfer</h2>
                <p className="mt-1 text-sm leading-6 text-[#87998b]">A-Pass setup signs a wallet challenge. Preflight does not.</p>
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
                  {sender && <Button type="button" variant="outline" size="sm" onClick={disconnectWallet} disabled={isSubmitting || isSettling} className="rounded-[8px] border-white/15 bg-transparent text-[#edf4ee] hover:bg-white/[0.06] hover:text-white">Disconnect</Button>}
                </div>

                {sender ? (
                  <>
                    <p className="mt-4 break-all rounded-[8px] border border-[#b8f34a]/20 bg-[#b8f34a]/[0.07] px-3 py-2.5 font-mono text-xs leading-5 text-[#cef88a]">{sender}</p>
                    <div aria-live="polite" className="mt-3 rounded-[10px] border border-white/[0.09] bg-[#07100c]/70 p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7e9183]">TRWA balance</p>
                          <p className={`mt-1 break-all font-mono text-sm tabular-nums ${balance.status === "error" ? "text-[#f5c77c]" : "text-[#edf4ee]"}`}>
                            {balance.status === "ready" ? `${balance.formatted} TRWA` : balance.status === "loading" ? "Reading balance..." : balance.status === "error" ? "Unavailable" : "Not loaded"}
                          </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => void refreshBalance(sender)} disabled={balance.status === "loading" || isSettling} className="rounded-[8px] border-white/15 bg-transparent text-[#b7c4ba] hover:bg-white/[0.06] hover:text-white">
                          {balance.status === "loading" && <CircleNotchIcon className="size-3.5 animate-spin" aria-hidden="true" />}
                          Refresh
                        </Button>
                      </div>
                      {balance.status === "error" && <p role="alert" className="mt-2 text-xs leading-5 text-[#d8a962]">{balance.message}</p>}
                    </div>
                  </>
                ) : (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <Button type="button" size="sm" disabled={isConnectingWallet || isSubmitting || isSettling} onClick={() => connectWallet("create")} className="rounded-[8px] bg-[#b8f34a] text-[#13210d] hover:bg-[#cbff67]">
                      {isConnectingWallet ? <CircleNotchIcon className="size-4 animate-spin" aria-hidden="true" /> : <WalletIcon className="size-4" weight="bold" aria-hidden="true" />}
                      Create wallet
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={isConnectingWallet || isSubmitting || isSettling} onClick={() => connectWallet("connect")} className="rounded-[8px] border-white/15 bg-transparent text-[#edf4ee] hover:bg-white/[0.06] hover:text-white">Use existing</Button>
                  </div>
                )}

                {walletError && <p role="alert" className="mt-3 text-sm leading-6 text-[#f5c77c]">{walletError}</p>}
              </div>

              {sender && (
                <APassSetup
                  state={apassSetup}
                  profile={apassProfile}
                  explorerUrl={config?.explorerUrl}
                  disabled={isSubmitting || isSettling || serviceState !== "ready"}
                  onProfileChange={setAPassProfile}
                  onCreate={() => void createDemoAPass()}
                  onUseExisting={useExistingAPass}
                  onReset={resetAPassSetup}
                />
              )}

              <div className={!canEnterTransfer ? "pointer-events-none opacity-45" : undefined} aria-disabled={!canEnterTransfer}>
                <div className="space-y-5">
                  <Field label="Recipient wallet" value={recipient} onChange={changeRecipient} placeholder="0x..." helpText="The recipient must already have an active A-Pass." disabled={!canEnterTransfer || isSubmitting || isSettling} />
                  <Field label="Amount" value={amount} onChange={changeAmount} placeholder="0.00" helpText="Positive amount, up to 18 decimal places." inputMode="decimal" disabled={!canEnterTransfer || isSubmitting || isSettling} />
                </div>
              </div>

              {!canEnterTransfer && (
                <div className="flex items-center gap-2.5 rounded-[9px] border border-white/[0.08] bg-[#07100c]/60 px-3.5 py-3 text-xs leading-5 text-[#7e9183]">
                  <LockKeyIcon className="size-4 shrink-0" aria-hidden="true" />
                  {sender ? "Complete A-Pass setup to unlock the transfer intent." : "Connect a sender wallet to begin."}
                </div>
              )}
            </div>

            {formError && (
              <div role="alert" className="mt-5 flex gap-3 rounded-[10px] border border-[#f2bd68]/25 bg-[#f2bd68]/[0.08] p-4 text-sm leading-6 text-[#f5c77c]">
                <WarningCircleIcon className="mt-0.5 size-5 shrink-0" weight="fill" aria-hidden="true" />
                {formError}
              </div>
            )}

            <Button type="submit" size="lg" className="mt-7 w-full rounded-[10px] bg-[#b8f34a] text-[#13210d] hover:bg-[#cbff67] active:translate-y-px" disabled={!canEnterTransfer || isSubmitting || isSettling || serviceState !== "ready"}>
              {isSubmitting ? <CircleNotchIcon className="size-5 animate-spin" aria-hidden="true" /> : <ShieldCheckIcon className="size-5" weight="fill" aria-hidden="true" />}
              {isSubmitting ? "Running checks" : "Run preflight"}
            </Button>

            {approvedIntent && result && "approved" in result && result.approved && settlement.status !== "confirmed" && (
              <Button type="button" size="lg" variant="outline" className="mt-3 w-full rounded-[10px] border-[#b8f34a]/30 bg-[#b8f34a]/[0.07] text-[#d8f5aa] hover:bg-[#b8f34a]/[0.12] hover:text-[#efffda] active:translate-y-px" disabled={isSettling} onClick={() => void settleApprovedTransfer()}>
                {isSettling ? <CircleNotchIcon className="size-5 animate-spin" aria-hidden="true" /> : <WalletIcon className="size-5" weight="bold" aria-hidden="true" />}
                {settlementButtonLabel(settlement)}
              </Button>
            )}
          </form>

          <ComplianceTerminal checks={checks} result={result} status={terminalStatus} settlement={settlement} />
        </div>
      </main>
    </div>
  )
}

function FlowRail({ walletConnected, apassReady, transferConfirmed }: { walletConnected: boolean; apassReady: boolean; transferConfirmed: boolean }) {
  const items = [
    {
      label: "Wallet",
      copy: walletConnected ? "Connected" : "Connect sender",
      state: walletConnected ? "complete" : "current",
    },
    {
      label: "A-Pass",
      copy: apassReady ? "Ready" : walletConnected ? "Set up identity" : "Waiting for wallet",
      state: apassReady ? "complete" : walletConnected ? "current" : "locked",
    },
    {
      label: "Transfer",
      copy: transferConfirmed ? "Confirmed" : apassReady ? "Check and send" : "Waiting for A-Pass",
      state: transferConfirmed ? "complete" : apassReady ? "current" : "locked",
    },
  ] as const

  return (
    <ol aria-label="Transfer progress" className="grid overflow-hidden rounded-[12px] border border-white/[0.09] bg-white/[0.02] sm:grid-cols-3 sm:divide-x sm:divide-white/[0.09]">
      {items.map((item, index) => (
        <li key={item.label} aria-current={item.state === "current" ? "step" : undefined} className="flex items-center gap-3 border-b border-white/[0.09] px-4 py-3.5 last:border-0 sm:border-b-0 sm:px-5">
          <span className={`grid size-7 shrink-0 place-items-center rounded-full border font-mono text-[10px] font-semibold ${item.state === "complete" ? "border-[#b8f34a]/30 bg-[#b8f34a]/[0.1] text-[#b8f34a]" : item.state === "current" ? "border-white/20 bg-white/[0.07] text-[#edf4ee]" : "border-white/[0.08] bg-white/[0.02] text-[#607265]"}`}>
            {item.state === "complete" ? <CheckCircleIcon className="size-4" weight="fill" aria-hidden="true" /> : index + 1}
          </span>
          <span className="min-w-0">
            <span className={`block text-sm font-medium ${item.state === "locked" ? "text-[#718376]" : "text-[#edf4ee]"}`}>{item.label}</span>
            <span className="mt-0.5 block truncate text-xs text-[#7e9183]">{item.copy}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function APassSetup({
  state,
  profile,
  explorerUrl,
  disabled,
  onProfileChange,
  onCreate,
  onUseExisting,
  onReset,
}: {
  state: APassSetupState
  profile: DemoAPassProfile
  explorerUrl?: string
  disabled: boolean
  onProfileChange: (profile: DemoAPassProfile) => void
  onCreate: () => void
  onUseExisting: () => void
  onReset: () => void
}) {
  const busyStatus = isAPassBusyStatus(state.status) ? state.status : undefined
  const isBusy = busyStatus !== undefined
  const isReady = state.status === "active" || state.status === "existing"

  return (
    <section className={`rounded-[12px] border p-4 ${isReady ? "border-[#b8f34a]/25 bg-[#b8f34a]/[0.055]" : state.status === "error" ? "border-[#f2bd68]/25 bg-[#f2bd68]/[0.045]" : "border-white/[0.09] bg-white/[0.025]"}`} aria-labelledby="apass-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FingerprintIcon className={`size-[18px] ${isReady ? "text-[#b8f34a]" : "text-[#9cad9f]"}`} aria-hidden="true" />
            <h3 id="apass-heading" className="text-sm font-medium text-[#edf4ee]">Sender A-Pass</h3>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-[#87998b]">Identity credential checked again during preflight.</p>
        </div>
        <span className={`rounded-[7px] border px-2 py-1 font-mono text-[9px] font-semibold tracking-[0.08em] ${isReady ? "border-[#b8f34a]/25 bg-[#b8f34a]/[0.08] text-[#b8f34a]" : isBusy ? "border-white/[0.1] bg-white/[0.04] text-[#b7c4ba]" : "border-white/[0.09] bg-white/[0.025] text-[#718376]"}`}>
          {isReady ? "READY" : isBusy ? "IN PROGRESS" : "REQUIRED"}
        </span>
      </div>

      {(state.status === "needed" || state.status === "error") && (
        <div className="mt-4">
          <p className="text-sm leading-6 text-[#b7c4ba]">Create a fictional sandbox profile for this wallet, or continue with an A-Pass you already issued.</p>

          <fieldset className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <legend className="sr-only">Demo A-Pass profile</legend>
            <ProfileOption
              title="Eligible profile"
              detail="GB · expected approval"
              selected={profile === "ELIGIBLE_GB"}
              disabled={disabled || isBusy}
              onClick={() => onProfileChange("ELIGIBLE_GB")}
            />
            <ProfileOption
              title="Restricted profile"
              detail="BR · expected denial"
              selected={profile === "RESTRICTED_BR"}
              disabled={disabled || isBusy}
              onClick={() => onProfileChange("RESTRICTED_BR")}
            />
          </fieldset>

          <p className="mt-3 text-xs leading-5 text-[#7e9183]">Demo only. These fixed profiles are fictional and do not perform real KYC.</p>

          {state.status === "error" && (
            <div role="alert" className="mt-3 flex gap-2.5 rounded-[9px] border border-[#f2bd68]/20 bg-[#f2bd68]/[0.06] p-3 text-xs leading-5 text-[#f5c77c]">
              <WarningCircleIcon className="mt-0.5 size-4 shrink-0" weight="fill" aria-hidden="true" />
              <div>
                <p>{state.message}</p>
                {state.requestId && <p className="mt-1 font-mono text-[10px] text-[#c69e61]">Request ID: {state.requestId}</p>}
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Button type="button" size="sm" onClick={onCreate} disabled={disabled || isBusy} className="rounded-[8px] bg-[#b8f34a] text-[#13210d] hover:bg-[#cbff67]">
              <FingerprintIcon className="size-4" weight="bold" aria-hidden="true" />
              Create demo A-Pass
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onUseExisting} disabled={disabled || isBusy} className="rounded-[8px] border-white/15 bg-transparent text-[#edf4ee] hover:bg-white/[0.06] hover:text-white">
              Use existing A-Pass
            </Button>
          </div>
        </div>
      )}

      {busyStatus && (
        <div role="status" className="mt-4 flex items-start gap-3 rounded-[9px] border border-white/[0.08] bg-[#07100c]/65 p-3.5">
          <CircleNotchIcon className="mt-0.5 size-4 shrink-0 animate-spin text-[#b8f34a]" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-[#edf4ee]">{apassPhaseTitle(busyStatus)}</p>
            <p className="mt-1 text-xs leading-5 text-[#87998b]">{apassPhaseCopy(busyStatus)}</p>
          </div>
        </div>
      )}

      {state.status === "active" && (
        <div className="mt-4 flex items-start gap-3">
          <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-[#b8f34a]" weight="fill" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#edf4ee]">Demo A-Pass is active.</p>
            <p className="mt-1 text-xs leading-5 text-[#9cad9f]">This sender can now move to the compliance preflight.</p>
            <p className="mt-2 break-all font-mono text-[10px] text-[#718376]">{state.enrollment.transactionHash}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {explorerUrl && (
                <a href={getExplorerTransactionUrl(explorerUrl, state.enrollment.transactionHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-[#b8f34a] hover:text-[#cbff67]">
                  View registration
                  <ArrowSquareOutIcon className="size-3.5" aria-hidden="true" />
                </a>
              )}
              <button type="button" onClick={onReset} className="text-xs font-medium text-[#9cad9f] hover:text-[#edf4ee]">Change setup</button>
            </div>
          </div>
        </div>
      )}

      {state.status === "existing" && (
        <div className="mt-4 flex items-start gap-3">
          <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-[#b8f34a]" weight="fill" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-[#edf4ee]">Existing A-Pass selected.</p>
            <p className="mt-1 text-xs leading-5 text-[#9cad9f]">Preflight will ask Cleanverse to verify it before signing is unlocked.</p>
            <button type="button" onClick={onReset} className="mt-3 text-xs font-medium text-[#9cad9f] hover:text-[#edf4ee]">Create a demo A-Pass instead</button>
          </div>
        </div>
      )}
    </section>
  )
}

function ProfileOption({ title, detail, selected, disabled, onClick }: { title: string; detail: string; selected: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={selected} disabled={disabled} onClick={onClick} className={`rounded-[9px] border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "border-[#b8f34a]/35 bg-[#b8f34a]/[0.08]" : "border-white/[0.09] bg-[#07100c]/45 hover:border-white/[0.16]"}`}>
      <span className={`block text-xs font-medium ${selected ? "text-[#dfffb0]" : "text-[#dce6de]"}`}>{title}</span>
      <span className="mt-1 block font-mono text-[10px] text-[#718376]">{detail}</span>
    </button>
  )
}

function Field({ label, value, onChange, placeholder, helpText, inputMode, disabled = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; helpText: string; inputMode?: "decimal"; disabled?: boolean }) {
  const id = label.toLowerCase().replaceAll(" ", "-")

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm text-[#dce6de]">{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} autoComplete="off" spellCheck={false} disabled={disabled} className="h-11 rounded-[9px] border-white/[0.1] bg-white/[0.035] px-3.5 text-[#edf4ee] placeholder:text-[#607265] focus-visible:border-[#b8f34a]/60 focus-visible:ring-[#b8f34a]/15" />
      <p className="text-xs leading-5 text-[#7e9183]">{helpText}</p>
    </div>
  )
}

function isAPassBusyStatus(status: APassSetupState["status"]): status is APassBusyStatus {
  return status === "requesting" || status === "authorizing" || status === "issuing" || status === "pending"
}

function apassPhaseTitle(status: APassBusyStatus): string {
  switch (status) {
    case "requesting":
      return "Preparing wallet challenge"
    case "authorizing":
      return "Confirm your passkey"
    case "issuing":
      return "Registering the A-Pass"
    case "pending":
      return "Waiting for Monad"
  }
}

function apassPhaseCopy(status: APassBusyStatus): string {
  switch (status) {
    case "requesting":
      return "CleanGraph is requesting a short-lived challenge from the API."
    case "authorizing":
      return "Sign the challenge to prove that you control this wallet."
    case "issuing":
      return "The API is sending the selected fictional profile to Cleanverse."
    case "pending":
      return "Registration was submitted and is waiting for confirmation."
  }
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function ComplianceTerminal({ checks, result, status, settlement }: { checks: ComplianceCheck[]; result: WorkspacePreflightResult | null; status: string; settlement: SettlementState }) {
  const terminalItems = [
    { id: "sender-eligibility", label: "Sender A-Pass" },
    { id: "recipient-eligibility", label: "Recipient A-Pass" },
    { id: "asset-policy", label: "TRWA policy" },
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
        {isPreflightError(result) ? (
          <div className="flex gap-3 text-sm leading-6 text-[#f5c77c]">
            <WarningCircleIcon className="mt-0.5 size-5 shrink-0" weight="fill" aria-hidden="true" />
            <div><span className="font-medium">{result.error.code}</span><p>{result.error.message}</p></div>
          </div>
        ) : result && "approved" in result ? (
          <div className="flex items-start gap-3 text-sm leading-6 text-[#9cad9f]">
            <CopyIcon className="mt-0.5 size-5 shrink-0 text-[#b8f34a]" aria-hidden="true" />
            <div><p className="text-[#edf4ee]">{result.approved ? "Transfer can proceed to wallet signing." : "Transfer is blocked before wallet signing."}</p><p className="font-mono text-xs text-[#7e9183]">Request ID: {result.requestId}</p></div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-[#7e9183]">
            <LockKeyIcon className="size-4 text-[#607265]" aria-hidden="true" />
            Complete wallet and A-Pass setup, then enter a transfer intent.
          </div>
        )}
      </div>

      {settlement.status !== "idle" && (
        <div className={`border-t px-5 py-5 sm:px-7 ${settlement.status === "confirmed" ? "border-[#b8f34a]/20 bg-[#b8f34a]/[0.06]" : settlement.status === "error" ? "border-[#f2bd68]/20 bg-[#f2bd68]/[0.06]" : "border-white/[0.09] bg-white/[0.025]"}`}>
          {settlement.status === "confirmed" ? (
            <div className="flex items-start gap-3 text-sm leading-6">
              <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-[#b8f34a]" weight="fill" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium text-[#edf4ee]">TRWA transfer confirmed on Monad.</p>
                <p className="mt-1 break-all font-mono text-xs text-[#9cad9f]">{settlement.transfer.transactionHash}</p>
                <a href={settlement.transfer.explorerUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 font-medium text-[#b8f34a] hover:text-[#cbff67]">
                  View transaction
                  <ArrowSquareOutIcon className="size-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          ) : settlement.status === "error" ? (
            <div className="flex items-start gap-3 text-sm leading-6 text-[#f5c77c]">
              <WarningCircleIcon className="mt-0.5 size-5 shrink-0" weight="fill" aria-hidden="true" />
              <div><p className="font-medium">Transfer not completed</p><p>{settlement.message}</p></div>
            </div>
          ) : (
            <div className="flex items-start gap-3 text-sm leading-6 text-[#9cad9f]">
              <CircleNotchIcon className="mt-0.5 size-5 shrink-0 animate-spin text-[#b8f34a]" aria-hidden="true" />
              <div>
                <p className="font-medium text-[#edf4ee]">{settlementPhaseMessage(settlement.status)}</p>
                {settlement.transactionHash && <p className="mt-1 break-all font-mono text-xs text-[#7e9183]">{settlement.transactionHash}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function isPreflightError(result: WorkspacePreflightResult | null): result is ClientPreflightError {
  return result !== null && "error" in result
}

function settlementButtonLabel(settlement: SettlementState): string {
  switch (settlement.status) {
    case "authorizing":
      return "Authorize passkey"
    case "simulating":
      return "Simulating transfer"
    case "signing":
      return "Submitting transfer"
    case "confirming":
      return "Waiting for confirmation"
    default:
      return "Sign and transfer"
  }
}

function settlementPhaseMessage(status: TransferPhase): string {
  switch (status) {
    case "authorizing":
      return "Authorize the sender passkey to continue."
    case "simulating":
      return "Checking the TRWA contract call before submission."
    case "signing":
      return "Signing and broadcasting the TRWA transfer."
    case "confirming":
      return "Transaction submitted. Waiting for Monad confirmation."
  }
}

export default App
