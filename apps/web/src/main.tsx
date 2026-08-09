import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import RootApplication from "./RootApplication.tsx"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <RootApplication />
      <Toaster richColors />
    </TooltipProvider>
  </StrictMode>,
)
