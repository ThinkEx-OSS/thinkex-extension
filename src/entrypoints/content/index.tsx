import { createRoot } from "react-dom/client"
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root"
import { ExtensionSidebar } from "@/components/ExtensionSidebar"
import { PortalProvider } from "@/lib/portal-context"
import "@/assets/tailwind.css"

const STORAGE_KEY = "canvas_domains"
const BANNER_KEY = "banner_enabled"

// ── Canvas detection ──────────────────────────────────────────────────────────

async function getSavedDomains(): Promise<string[]> {
  const result = await browser.storage.sync.get(STORAGE_KEY)
  return (result[STORAGE_KEY] as string[] | undefined) ?? []
}

async function saveDomain(domain: string): Promise<void> {
  const existing = await getSavedDomains()
  if (!existing.includes(domain)) {
    await browser.storage.sync.set({ [STORAGE_KEY]: [...existing, domain] })
  }
}

async function probeForCanvas(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`${domain}/api/v1/courses?per_page=1`)
    if (!res.ok) return false
    const data = await res.json()
    return Array.isArray(data) && data.length > 0
  } catch {
    return false
  }
}

// ── Entrypoint ────────────────────────────────────────────────────────────────

export default defineContentScript({
  matches: ["https://*/*"],
  cssInjectionMode: "ui",

  async main(ctx) {
    const enabled = await browser.storage.sync.get(BANNER_KEY)
    if (enabled[BANNER_KEY] === false) return

    const domain = `${location.protocol}//${location.hostname}`
    const savedDomains = await getSavedDomains()

    let isCanvas = savedDomains.some((d) => domain.includes(d))
    if (!isCanvas) {
      isCanvas = await probeForCanvas(domain)
      if (isCanvas) await saveDomain(location.hostname)
    }

    if (!isCanvas) return

    const ui = await createShadowRootUi(ctx, {
      name: "thinkex-sidebar",
      position: "overlay",
      append: "last",
      onMount(container) {
        const root = createRoot(container)
        root.render(
          <PortalProvider container={container}>
            <ExtensionSidebar />
          </PortalProvider>
        )
        return root
      },
      onRemove(root) {
        root?.unmount()
      },
    })

    ui.mount()
  },
})
