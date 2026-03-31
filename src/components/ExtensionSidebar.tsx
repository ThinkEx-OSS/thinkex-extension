import * as React from "react"
import * as Collapsible from "@radix-ui/react-collapsible"
import { ChevronRight, Folder as FolderIcon, FolderOpen, LogOut, Settings, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { IconRenderer } from "@/lib/icon-renderer"
import { getAppBaseUrl } from "@/utils/app-url"
import {
  SidebarProvider,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Workspace {
  id: string
  name: string
  color: string | null
  icon: string | null
  slug: string
}

interface FolderItem {
  id: string
  name: string
  folderId?: string // parent folder id; undefined = root level
  color?: string
}

interface FolderTreeItem {
  id: string
  name: string
  color?: string
  children?: FolderTreeItem[]
}

interface SessionData {
  user: { email: string; name?: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BANNER_KEY = "banner_enabled"
const SUPPORTED_DOC_RE = /\.(pdf|docx?|pptx?)$/i
const SIGN_IN_POLL_TIMEOUT_MS = 2 * 60 * 1000
const APP_BASE_URL = getAppBaseUrl()

function buildFolderTree(folders: FolderItem[], parentId?: string): FolderTreeItem[] {
  return folders
    .filter((f) => (f.folderId ?? undefined) === parentId)
    .map((f) => {
      const children = buildFolderTree(folders, f.id)
      return { id: f.id, name: f.name, color: f.color, ...(children.length > 0 && { children }) }
    })
}

function getSupportedFilename(rawName?: string | null): string | null {
  const name = rawName?.trim()
  return name && SUPPORTED_DOC_RE.test(name) ? name : null
}

function getAnchorFilename(anchor: HTMLAnchorElement | null): string | null {
  if (!anchor) return null

  return (
    getSupportedFilename(anchor.textContent) ??
    getSupportedFilename(anchor.getAttribute("aria-label")) ??
    getSupportedFilename(anchor.getAttribute("title"))
  )
}

function getSelectedDocumentCount(): number {
  // Old Canvas UI (Ember-based)
  const oldCount = document.querySelectorAll(
    ".ef-item-row[aria-selected=\"true\"]"
  )

  const oldSelectedCount = Array.from(oldCount).filter((row) => {
    const anchor = row.querySelector<HTMLAnchorElement>(".ef-name-col__link")
    return Boolean(getAnchorFilename(anchor))
  }).length

  // New Canvas UI (React-based) — selection shown by IconCheckMark SVG presence
  const newCount = Array.from(
    document.querySelectorAll<HTMLElement>("tr")
  ).filter((row) => {
    if (!row.querySelector('svg[name="IconCheckMark"]')) return false
    const anchor = row.querySelector<HTMLAnchorElement>('a[href*="preview="]')
    return Boolean(getAnchorFilename(anchor))
  }).length

  return oldSelectedCount + newCount
}

function getSelectedFiles(): Array<{ url: string; name: string }> {
  // Old Canvas UI (Ember-based)
  const oldFiles = Array.from(
    document.querySelectorAll<HTMLElement>('.ef-item-row[aria-selected="true"]')
  ).flatMap((row) => {
    const url = row.querySelector<HTMLAnchorElement>('.ef-name-col__link')?.getAttribute('href')
    const name = getAnchorFilename(row.querySelector<HTMLAnchorElement>(".ef-name-col__link"))
    if (!url || !name) return []
    return [{ url, name }]
  })

  // New Canvas UI (React-based) — selection shown by IconCheckMark SVG presence
  const newFiles = Array.from(
    document.querySelectorAll<HTMLElement>("tr")
  ).flatMap((row) => {
    if (!row.querySelector('svg[name="IconCheckMark"]')) return []
    const anchor = row.querySelector<HTMLAnchorElement>('a[href*="preview="]')
    if (!anchor) return []
    const name = getAnchorFilename(anchor)
    const href = anchor.getAttribute('href')
    if (!name || !href) return []
    const previewMatch = href.match(/[?&]preview=(\d+)/)
    if (!previewMatch) return []
    const url = `${window.location.origin}/files/${previewMatch[1]}/download?download_frd=1`
    return [{ url, name }]
  })

  return [...oldFiles, ...newFiles]
}

function mimeTypeFromFilename(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.pdf'))  return 'application/pdf'
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lower.endsWith('.doc'))  return 'application/msword'
  if (lower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  if (lower.endsWith('.ppt'))  return 'application/vnd.ms-powerpoint'
  return 'application/octet-stream'
}

function isOfficeFile(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.docx') || lower.endsWith('.doc') ||
         lower.endsWith('.pptx') || lower.endsWith('.ppt')
}

function toPdfName(name: string): string {
  const dot = name.lastIndexOf('.')
  return (dot !== -1 ? name.slice(0, dot) : name) + '.pdf'
}

const MAX_CONCURRENT_FILE_SENDS = 3

async function sendMessage<T>(msg: Record<string, unknown>): Promise<T> {
  return await browser.runtime.sendMessage(msg) as T
}

// ── Folder tree component ─────────────────────────────────────────────────────

interface FolderTreeProps {
  folders: FolderTreeItem[]
  depth: number
  selectedFolderId: string | null
  openIds: Set<string>
  onSelect: (id: string) => void
  onToggleOpen: (id: string) => void
}

function FolderTree({
  folders,
  depth,
  selectedFolderId,
  openIds,
  onSelect,
  onToggleOpen,
}: FolderTreeProps) {
  return (
    <>
      {folders.map((folder) => {
        const isOpen = openIds.has(folder.id)
        const isSelected = selectedFolderId === folder.id
        const hasChildren = !!folder.children?.length

        return (
          <SidebarMenuSubItem key={folder.id}>
            <div
              className={cn(
                "rounded-md transition-colors",
                isSelected && "border border-sidebar-primary bg-sidebar-primary/15"
              )}
            >
              {/* Folder row */}
              <div
                className="flex items-center"
                style={{ paddingLeft: `${8 + depth * 12}px` }}
              >
                {/* Chevron — toggles children only */}
                <button
                  className="flex items-center justify-center w-5 h-6 shrink-0 text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors"
                  onClick={() => hasChildren && onToggleOpen(folder.id)}
                >
                  <ChevronRight
                    className={cn(
                      "size-3 transition-transform duration-150",
                      hasChildren ? "opacity-100" : "opacity-0",
                      isOpen && "rotate-90"
                    )}
                  />
                </button>

                {/* Name — selects folder as destination */}
                <button
                  className="flex items-center gap-1.5 flex-1 min-w-0 pr-2 py-1 hover:bg-sidebar-accent/50 rounded-md transition-colors"
                  onClick={() => onSelect(folder.id)}
                >
                  {isSelected ? (
                    <FolderOpen className="size-3.5 shrink-0" style={{ color: "#3B82F6" }} />
                  ) : (
                    <FolderIcon className="size-3.5 shrink-0" style={{ color: folder.color || "#F59E0B" }} />
                  )}
                  <span className="truncate text-xs text-sidebar-foreground">{folder.name}</span>
                </button>
              </div>

              {/* Children — inside the same highlighted container */}
              {isOpen && folder.children?.length ? (
                <FolderTree
                  folders={folder.children}
                  depth={depth + 1}
                  selectedFolderId={selectedFolderId}
                  openIds={openIds}
                  onSelect={onSelect}
                  onToggleOpen={onToggleOpen}
                />
              ) : null}
            </div>
          </SidebarMenuSubItem>
        )
      })}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ExtensionSidebar() {
  // Session state
  const [session, setSession] = React.useState<SessionData | null>(null)
  const [sessionLoading, setSessionLoading] = React.useState(true)
  const [signingIn, setSigningIn] = React.useState(false)
  const [signingOut, setSigningOut] = React.useState(false)
  const pollRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Extension state
  const [enabled, setEnabled] = React.useState(true)
  const [count, setCount] = React.useState(0)
  const [expanded, setExpanded] = React.useState(false)
  const [tabTop, setTabTop] = React.useState<number | null>(null)

  // Send state
  const [sending, setSending] = React.useState(false)
  const [sendError, setSendError] = React.useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = React.useState(false)
  const [sendProgress, setSendProgress] = React.useState<{ current: number; total: number } | null>(null)

  // Search
  const [searchQuery, setSearchQuery] = React.useState("")
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [settingsError, setSettingsError] = React.useState<string | null>(null)

  // Workspace + folder data
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([])
  const [workspacesLoading, setWorkspacesLoading] = React.useState(true)
  const [foldersByWorkspace, setFoldersByWorkspace] = React.useState<
    Record<string, FolderItem[]>
  >({})
  const [loadingFolderIds, setLoadingFolderIds] = React.useState<Set<string>>(new Set())

  // Selection state
  const [openWorkspaceIds, setOpenWorkspaceIds] = React.useState<Set<string>>(new Set())
  const [openFolderIds, setOpenFolderIds] = React.useState<Set<string>>(new Set())
  const [selectedFolderId, setSelectedFolderId] = React.useState<string | null>(null)

  const widgetRef = React.useRef<HTMLDivElement>(null)
  const tabRef = React.useRef<HTMLDivElement>(null)
  const settingsRef = React.useRef<HTMLDivElement>(null)
  const settingsButtonRef = React.useRef<HTMLButtonElement>(null)
  const foldersByWorkspaceRef = React.useRef(foldersByWorkspace)
  const loadingFolderIdsRef = React.useRef(loadingFolderIds)

  React.useEffect(() => {
    foldersByWorkspaceRef.current = foldersByWorkspace
  }, [foldersByWorkspace])

  React.useEffect(() => {
    loadingFolderIdsRef.current = loadingFolderIds
  }, [loadingFolderIds])

  // ── banner_enabled toggle ───────────────────────────────────────────────
  React.useEffect(() => {
    browser.storage.sync.get(BANNER_KEY).then((result) => {
      setEnabled(result[BANNER_KEY] !== false)
    })
    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      if (BANNER_KEY in changes) setEnabled(changes[BANNER_KEY].newValue !== false)
    }
    browser.storage.onChanged.addListener(listener)
    return () => browser.storage.onChanged.removeListener(listener)
  }, [])

  // ── Session check ───────────────────────────────────────────────────────
  React.useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const response = await sendMessage<{ session?: SessionData | null }>({
          type: "GET_SESSION",
        })
        if (!cancelled) setSession(response?.session?.user ? response.session : null)
      } catch {
        if (!cancelled) setSession(null)
      } finally {
        if (!cancelled) setSessionLoading(false)
      }
    })()

    return () => {
      cancelled = true
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [])

  React.useEffect(() => {
    if (settingsOpen) return
    setSettingsError(null)
  }, [settingsOpen])

  React.useEffect(() => {
    if (!settingsOpen) return

    const onPointerDown = (event: PointerEvent) => {
      const path = event.composedPath()
      const clickedInsideMenu = settingsRef.current ? path.includes(settingsRef.current) : false
      const clickedSettingsButton = settingsButtonRef.current ? path.includes(settingsButtonRef.current) : false

      if (!clickedInsideMenu && !clickedSettingsButton) {
        setSettingsOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false)
    }

    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [settingsOpen])

  // ── Fetch workspace list ────────────────────────────────────────────────
  React.useEffect(() => {
    if (!session) {
      setWorkspaces([])
      setFoldersByWorkspace({})
      setLoadingFolderIds(new Set())
      loadingFolderIdsRef.current = new Set()
      setOpenWorkspaceIds(new Set())
      setOpenFolderIds(new Set())
      setSelectedFolderId(null)
      setWorkspacesLoading(false)
      setSearchQuery("")
      return
    }

    let cancelled = false
    setWorkspacesLoading(true)

    void (async () => {
      try {
        const response = await sendMessage<{ workspaces?: Workspace[] }>({ type: "FETCH_WORKSPACES" })
        if (!cancelled) setWorkspaces(response?.workspaces ?? [])
      } catch {
        if (!cancelled) setWorkspaces([])
      } finally {
        if (!cancelled) setWorkspacesLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [session])

  const loadFolders = React.useCallback(async (wsId: string) => {
    if (foldersByWorkspaceRef.current[wsId] || loadingFolderIdsRef.current.has(wsId)) return

    const nextLoadingIds = new Set(loadingFolderIdsRef.current)
    nextLoadingIds.add(wsId)
    loadingFolderIdsRef.current = nextLoadingIds
    setLoadingFolderIds(nextLoadingIds)

    try {
      const response = await sendMessage<{ folders?: Array<{ id: string; name: string; folderId?: string; color?: string }> }>({
        type: "FETCH_WORKSPACE_FOLDERS",
        id: wsId,
      })
      const folders: Array<{ id: string; name: string; folderId?: string; color?: string }> =
        response?.folders ?? []
      setFoldersByWorkspace((prev) => ({ ...prev, [wsId]: folders }))
    } catch {
      setFoldersByWorkspace((prev) => ({ ...prev, [wsId]: [] }))
    } finally {
      const remainingLoadingIds = new Set(loadingFolderIdsRef.current)
      remainingLoadingIds.delete(wsId)
      loadingFolderIdsRef.current = remainingLoadingIds
      setLoadingFolderIds(remainingLoadingIds)
    }
  }, [])

  // ── Prefetch folders as soon as workspaces load (if banner is enabled) ──
  React.useEffect(() => {
    if (!enabled || workspaces.length === 0) return

    workspaces.forEach((ws) => {
      void loadFolders(ws.id)
    })
  }, [enabled, workspaces, loadFolders])

  // ── Watch Canvas file list for selection changes (old + new UI) ─────────
  React.useEffect(() => {
    let selectionObserver: MutationObserver | null = null

    function setupObserverOld(container: Element) {
      selectionObserver?.disconnect()
      selectionObserver = new MutationObserver(() => setCount(getSelectedDocumentCount()))
      selectionObserver.observe(container, {
        attributes: true,
        attributeFilter: ["aria-selected"],
        subtree: true,
      })
      setCount(getSelectedDocumentCount())
    }

    function setupObserverNew(container: Element) {
      selectionObserver?.disconnect()
      selectionObserver = new MutationObserver(() => setCount(getSelectedDocumentCount()))
      // childList: true to detect svg[name="IconCheckMark"] being inserted/removed by React
      selectionObserver.observe(container, { childList: true, subtree: true })
      setCount(getSelectedDocumentCount())
    }

    // Old UI: .ef-directory with aria-selected
    const existingOld = document.querySelector(".ef-directory")
    if (existingOld) setupObserverOld(existingOld)

    // New UI: files-table — detect checkmark SVG insertion/removal (React doesn't reflect "checked" to DOM)
    const existingNew = document.querySelector('table[data-testid="files-table"]')
      ?? document.querySelector('tr[data-testid="table-row"]')?.closest('table')
    if (existingNew && !existingOld) setupObserverNew(existingNew)

    const directoryObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue
          const oldDir = node.classList.contains("ef-directory")
            ? node
            : node.querySelector(".ef-directory")
          if (oldDir) { setupObserverOld(oldDir); continue }
          const newTable = node.getAttribute?.("data-testid") === "files-table"
            ? node
            : node.querySelector?.('table[data-testid="files-table"]')
          if (newTable) setupObserverNew(newTable)
        }
        for (const node of mutation.removedNodes) {
          if (!(node instanceof Element)) continue
          if (
            node.classList.contains("ef-directory") ||
            node.querySelector?.(".ef-directory") ||
            node.getAttribute?.("data-testid") === "files-table" ||
            node.querySelector?.('table[data-testid="files-table"]')
          ) {
            selectionObserver?.disconnect()
            selectionObserver = null
            setCount(0)
          }
        }
      }
    })

    directoryObserver.observe(document.body, { childList: true, subtree: true })

    return () => {
      selectionObserver?.disconnect()
      directoryObserver.disconnect()
    }
  }, [])

  // ── Tab drag ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (expanded) return
    const tab = tabRef.current
    const widget = widgetRef.current
    if (!tab || !widget) return

    let dragging = false
    let startY = 0
    let startTop = 0

    const onMouseDown = (e: MouseEvent) => {
      dragging = true
      startY = e.clientY
      startTop = widget.getBoundingClientRect().top
      tab.style.cursor = "grabbing"
      e.preventDefault()
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return
      const delta = e.clientY - startY
      const newTop = Math.max(
        0,
        Math.min(startTop + delta, window.innerHeight - widget.offsetHeight)
      )
      setTabTop(newTop)
      widget.style.top = `${newTop}px`
      widget.style.transform = "none"
    }
    const onMouseUp = () => {
      if (!dragging) return
      dragging = false
      tab.style.cursor = "grab"
    }

    tab.addEventListener("mousedown", onMouseDown)
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)

    return () => {
      tab.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }
  }, [expanded])

  // ── Sign in ─────────────────────────────────────────────────────────────
  const handleSignIn = React.useCallback(() => {
    setSettingsOpen(false)
    setSettingsError(null)
    setSigningIn(true)
    const startedAt = Date.now()

    if (pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }

    void (async () => {
      try {
        const response = await sendMessage<{ url?: string }>({
          type: "SIGN_IN_SOCIAL",
          callbackURL: browser.runtime.getURL("/callback.html" as any),
        })
        const url = response?.url
        if (!url) {
          setSigningIn(false)
          return
        }

        const authWindow = window.open(url, "_blank")
        if (!authWindow) {
          setSigningIn(false)
          return
        }

        // Poll until session appears
        const poll = async () => {
          if (pollRef.current) {
            clearTimeout(pollRef.current)
            pollRef.current = null
          }

          if (authWindow.closed || Date.now() - startedAt >= SIGN_IN_POLL_TIMEOUT_MS) {
            setSigningIn(false)
            return
          }

          try {
            const res = await sendMessage<{ session?: SessionData | null }>({
              type: "GET_SESSION",
            })
            if (res?.session?.user) {
              setSession(res.session)
              setSigningIn(false)
            } else {
              pollRef.current = setTimeout(poll, 1500)
            }
          } catch {
            setSigningIn(false)
          }
        }

        pollRef.current = setTimeout(poll, 1500)
      } catch {
        if (pollRef.current) {
          clearTimeout(pollRef.current)
          pollRef.current = null
        }
        setSigningIn(false)
      }
    })()
  }, [])

  const handleSignOut = React.useCallback(() => {
    setSigningOut(true)
    setSettingsError(null)

    void (async () => {
      try {
        const response = await sendMessage<{ ok?: boolean; error?: string }>({
          type: "SIGN_OUT",
        })

        if (!response?.ok) {
          setSettingsError(response?.error ?? "Sign out failed")
          return
        }

        if (pollRef.current) {
          clearTimeout(pollRef.current)
          pollRef.current = null
        }

        setSession(null)
        setSettingsOpen(false)
        setSendError(null)
        setSendSuccess(false)
        setSendProgress(null)
      } catch {
        setSettingsError("Sign out failed")
      } finally {
        setSigningOut(false)
      }
    })()
  }, [])

  // ── Select workspace as destination ────────────────────────────────────
  const selectWorkspace = React.useCallback((wsId: string) => {
    setSelectedFolderId((prev) => (prev === wsId ? null : wsId))
  }, [])

  // ── Expand/collapse workspace folder tree ───────────────────────────────
  const toggleWorkspaceOpen = React.useCallback(
    (wsId: string) => {
      const isCurrentlyOpen = openWorkspaceIds.has(wsId)

      setOpenWorkspaceIds((prev) => {
        const next = new Set(prev)
        if (next.has(wsId)) next.delete(wsId)
        else next.add(wsId)
        return next
      })

      // Lazy-load folders on first expand
      if (!isCurrentlyOpen) {
        void loadFolders(wsId)
      }
    },
    [openWorkspaceIds, loadFolders]
  )

  const selectFolder = React.useCallback((id: string) => {
    setSelectedFolderId((prev) => (prev === id ? null : id))
  }, [])

  const toggleFolderOpen = React.useCallback((id: string) => {
    setOpenFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allOpenIds = React.useMemo(
    () => new Set([...openWorkspaceIds, ...openFolderIds]),
    [openWorkspaceIds, openFolderIds]
  )

  const filteredWorkspaces = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return workspaces
    return workspaces.filter((ws) => ws.name.toLowerCase().includes(q))
  }, [searchQuery, workspaces])

  const canSend = !!selectedFolderId && count > 0 && !sending

  // ── Send handler ────────────────────────────────────────────────────────
  const handleSend = React.useCallback(async () => {
    if (!selectedFolderId) return

    // Resolve workspaceId + folderId from selectedFolderId
    let destWorkspaceId: string | null = null
    let destFolderId: string | undefined = undefined

    const selectedWs = workspaces.find((ws) => ws.id === selectedFolderId)
    if (selectedWs) {
      destWorkspaceId = selectedWs.id
    } else {
      for (const [wsId, folders] of Object.entries(foldersByWorkspace)) {
        if (folders.some((f) => f.id === selectedFolderId)) {
          destWorkspaceId = wsId
          destFolderId = selectedFolderId
          break
        }
      }
    }

    if (!destWorkspaceId) return

    const selectedFiles = getSelectedFiles()
    if (selectedFiles.length === 0) return

    setSending(true)
    setSendError(null)
    setSendSuccess(false)
    setSendProgress({ current: 0, total: selectedFiles.length })

    try {
      type UploadUrlResponse = { ok: boolean; data: any; error?: string }
      type ImportFile = {
        storagePath: string; publicUrl: string
        displayName: string; mimeType: string; folderId?: string
      }
      const abortController = new AbortController()
      let failed = false

      const processFile = async (file: { url: string; name: string }): Promise<ImportFile> => {
        if (failed) throw new Error('Send cancelled')

        const mimeType = mimeTypeFromFilename(file.name)

        try {
          // Download from Canvas and request the upload URL at the same time.
          const [canvasResp, urlResult] = await Promise.all([
            fetch(file.url, { credentials: 'include', signal: abortController.signal }),
            sendMessage<UploadUrlResponse>({
              type: 'GET_UPLOAD_URL', filename: file.name, contentType: mimeType,
            }),
          ])

          if (failed) throw new Error('Send cancelled')
          if (!canvasResp.ok) throw new Error(`Failed to download "${file.name}" from Canvas`)
          const blob = await canvasResp.blob()

          if (failed) throw new Error('Send cancelled')
          if (!urlResult.ok) throw new Error(`Upload URL error for "${file.name}": ${urlResult.error}`)

          const { signedUrl, publicUrl, path } = urlResult.data

          // PUT directly to Supabase — pre-signed, no auth needed.
          const putResp = await fetch(signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': mimeType },
            body: blob,
            signal: abortController.signal,
          })
          if (failed) throw new Error('Send cancelled')
          if (!putResp.ok) throw new Error(`Storage upload failed for "${file.name}"`)
          const storagePath = path
          const storageUrl = publicUrl

          // 4. Convert office files to PDF via ThinkEx engine
          let finalPath = storagePath
          let finalUrl = storageUrl
          let finalMime = mimeType
          let finalName = file.name

          if (isOfficeFile(file.name)) {
            const convResult = await sendMessage<UploadUrlResponse>({
              type: 'CONVERT_TO_PDF', filePath: storagePath, fileUrl: storageUrl,
            })
            if (failed) throw new Error('Send cancelled')
            if (!convResult.ok) throw new Error(`Conversion failed for "${file.name}": ${convResult.error}`)
            finalPath = convResult.data.pdf_path
            finalUrl = convResult.data.pdf_url
            finalMime = 'application/pdf'
            finalName = toPdfName(file.name)
          }

          return {
            storagePath: finalPath,
            publicUrl: finalUrl,
            displayName: finalName,
            mimeType: finalMime,
            folderId: destFolderId,
          }
        } catch (err) {
          if (abortController.signal.aborted || failed) throw new Error('Send cancelled')
          throw err
        }
      }

      const importFiles: ImportFile[] = new Array(selectedFiles.length)
      let nextFileIdx = 0
      let completedFiles = 0

      const workerCount = Math.min(MAX_CONCURRENT_FILE_SENDS, selectedFiles.length)
      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (!failed && nextFileIdx < selectedFiles.length) {
            const fileIdx = nextFileIdx++
            if (failed) return

            try {
              importFiles[fileIdx] = await processFile(selectedFiles[fileIdx])
              if (failed) return
              completedFiles += 1
              setSendProgress({ current: completedFiles, total: selectedFiles.length })
            } catch (err) {
              if (!failed) {
                failed = true
                abortController.abort()
                throw err
              }
              return
            }
          }
        }),
      )

      // 4. Import all files into ThinkEx workspace
      setSendProgress(null)
      const importResult = await sendMessage<UploadUrlResponse>({
        type: 'IMPORT_FILES', workspaceId: destWorkspaceId, files: importFiles,
      })
      if (!importResult.ok) throw new Error(`Import failed: ${importResult.error}`)

      setSendSuccess(true)
      setTimeout(() => setSendSuccess(false), 3000)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
      setSendProgress(null)
    }
  }, [selectedFolderId, workspaces, foldersByWorkspace])

  if (!enabled) return null

  // ── Collapsed tab ───────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <div
        ref={widgetRef}
        className="group"
        style={{
          position: "fixed",
          ...(tabTop !== null
            ? { top: `${tabTop}px`, transform: "none" }
            : { top: "50%", transform: "translateY(-50%)" }),
          right: 0,
          zIndex: 2147483647,
          pointerEvents: "auto",
          display: "flex",
          height: "56px",
        }}
      >
        {/* Logo card — slides left on hover to reveal drag handle */}
        <button
          onClick={() => setExpanded(true)}
          className="relative flex h-14 w-14 items-center justify-center rounded-l-md bg-black shadow-md transition-all duration-150 group-hover:-translate-x-6 hover:bg-neutral-800 active:scale-95 cursor-pointer"
          style={{ zIndex: 1 }}
        >
          {/* PDF count badge */}
          <span className="absolute -top-2 -left-2 flex min-w-5 h-5 items-center justify-center rounded-full bg-sidebar border border-sidebar-border text-sidebar-foreground text-[10px] font-bold px-1 leading-none shadow-sm">
            {count}
          </span>
          <img
            src={browser.runtime.getURL("ThinkExLogo.svg" as any)}
            width={36}
            height={36}
            alt="ThinkEx"
          />
        </button>

        {/* Drag handle strip — hidden behind logo card, revealed on hover */}
        <div
          ref={tabRef}
          className="flex h-14 w-6 items-center justify-center bg-black/80 text-white transition duration-150 hover:bg-black"
          style={{ cursor: "grab", marginLeft: "-24px" }}
        >
          <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="56" width="24" xmlns="http://www.w3.org/2000/svg">
            <path fill="none" d="M0 0h24v24H0V0z" />
            <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </div>
      </div>
    )
  }

  // ── Expanded panel ──────────────────────────────────────────────────────
  return (
    <SidebarProvider
      open={true}
      className="!min-h-0"
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        height: "calc(100vh - 32px)",
        width: "300px",
        "--sidebar-width": "300px",
        zIndex: 2147483647,
        pointerEvents: "auto",
      } as React.CSSProperties}
    >
      <div className="flex flex-col h-full w-full bg-sidebar border border-sidebar-border rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.45)] overflow-hidden">

        {/* Header — sticky, single row */}
        <div className="relative flex items-center gap-2 px-4 h-12 border-b border-sidebar-border shrink-0">
          <button
            className="flex items-center gap-2 min-w-0 hover:opacity-75 transition-opacity cursor-pointer"
            onClick={() => {
              window.open(APP_BASE_URL, "_blank", "noopener,noreferrer")
            }}
          >
            <img
              src={browser.runtime.getURL("ThinkExLogo.svg" as any)}
              width={22}
              height={22}
              alt="ThinkEx"
            />
            <h2 className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              ThinkEx
            </h2>
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <div ref={settingsRef}>
              <button
                ref={settingsButtonRef}
                className="text-sidebar-foreground/35 hover:text-sidebar-foreground/70 transition-colors cursor-pointer p-1 rounded"
                aria-label="Settings"
                aria-expanded={settingsOpen}
                aria-haspopup="menu"
                type="button"
                onClick={() => {
                  setSettingsError(null)
                  setSettingsOpen((prev) => !prev)
                }}
              >
                <Settings className="size-4" />
              </button>
              {settingsOpen ? (
                <div
                  className="absolute right-4 top-10 z-10 w-36 overflow-hidden rounded-lg border border-sidebar-border bg-sidebar shadow-[0_14px_32px_rgba(0,0,0,0.42)]"
                  role="menu"
                >
                  <div className="p-1.5">
                    {session ? (
                      <button
                        className="w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleSignOut}
                        disabled={signingOut}
                        type="button"
                        role="menuitem"
                      >
                        <LogOut className="size-3.5 shrink-0" />
                        {signingOut ? "Signing out…" : "Sign out"}
                      </button>
                    ) : (
                      <button
                        className="w-full flex items-center justify-center rounded-md px-2.5 py-2 text-xs text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleSignIn}
                        disabled={signingIn}
                        type="button"
                        role="menuitem"
                      >
                        {signingIn ? "Waiting for sign in…" : "Sign in"}
                      </button>
                    )}
                  </div>
                  {settingsError ? (
                    <p className="border-t border-sidebar-border/80 px-3 py-2 text-[11px] leading-tight text-red-400 bg-red-500/5">
                      {settingsError}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <button
              className="text-sidebar-foreground/35 hover:text-sidebar-foreground/70 transition-colors cursor-pointer p-1 rounded"
              onClick={() => setExpanded(false)}
              aria-label="Close sidebar"
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Search bar — fixed between header and list */}
        {session && (
          <div className="px-3 py-2 border-b border-sidebar-border shrink-0">
            <input
              type="text"
              placeholder="Search workspaces…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-sidebar-accent/40 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/30 rounded-md px-3 py-1.5 outline-none focus:ring-1 focus:ring-sidebar-primary border border-sidebar-border"
            />
          </div>
        )}

        {/* Workspace + folder tree — scrollable */}
        <div
          className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-2"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "hsl(240 3.7% 25%) transparent",
          }}
        >
          {sessionLoading ? (
            <p className="px-1 py-2 text-[12px] text-sidebar-foreground/40">Loading…</p>
          ) : !session ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 py-8 px-2">
              <img
                src={browser.runtime.getURL("ThinkExLogo.svg" as any)}
                width={40}
                height={40}
                alt="ThinkEx"
              />
              <p className="text-xs text-sidebar-foreground/50 text-center">
                Sign in to send documents to ThinkEx
              </p>
              <button
                disabled={signingIn}
                onClick={handleSignIn}
                className="w-full flex items-center justify-center gap-2 bg-white text-black text-xs font-semibold rounded-lg px-3 py-2 hover:bg-neutral-100 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {signingIn ? (
                  "Waiting for sign in…"
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.85l6.09-6.09C34.46 3.19 29.53 1 24 1 14.82 1 7.07 6.48 3.64 14.18l7.09 5.51C12.44 13.61 17.76 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.52 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.7c-.55 2.96-2.2 5.47-4.68 7.15l7.18 5.57C43.35 37.28 46.52 31.36 46.52 24.5z"/>
                      <path fill="#FBBC05" d="M10.73 28.31A14.6 14.6 0 0 1 9.5 24c0-1.49.26-2.93.73-4.31l-7.09-5.51A23.93 23.93 0 0 0 0 24c0 3.86.92 7.51 2.54 10.73l8.19-6.42z"/>
                      <path fill="#34A853" d="M24 47c5.53 0 10.17-1.83 13.56-4.97l-7.18-5.57C28.6 37.92 26.43 38.5 24 38.5c-6.24 0-11.56-4.11-13.27-9.69l-8.19 6.42C6.07 43.52 14.45 47 24 47z"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>
            </div>
          ) : workspacesLoading ? (
            <p className="px-1 py-2 text-[12px] text-sidebar-foreground/40">Loading…</p>
          ) : filteredWorkspaces.length === 0 ? (
            <p className="px-1 py-2 text-[12px] text-sidebar-foreground/40 italic">
              {searchQuery.trim() ? "No workspaces match your search" : "No workspaces found"}
            </p>
          ) : (
            <SidebarMenu>
              {filteredWorkspaces.map((ws) => {
                const isOpen = openWorkspaceIds.has(ws.id)
                const rawFolders = foldersByWorkspace[ws.id]
                const folders = rawFolders ? buildFolderTree(rawFolders) : null
                const isLoadingFolders = loadingFolderIds.has(ws.id)

                return (
                  <Collapsible.Root
                    key={ws.id}
                    open={isOpen}
                    onOpenChange={() => toggleWorkspaceOpen(ws.id)}
                    asChild
                  >
                    {/* Workspace card */}
                    <SidebarMenuItem className={cn(
                      "rounded-lg border overflow-hidden transition-colors",
                      selectedFolderId === ws.id
                        ? "border-sidebar-primary bg-sidebar-primary/15"
                        : "border-sidebar-border bg-sidebar-accent/30"
                    )}>
                      <div className="flex items-center">
                        {/* Chevron — expands/collapses folder tree only */}
                        <Collapsible.Trigger asChild>
                          <button className="flex items-center justify-center w-7 h-8 shrink-0 text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors">
                            <ChevronRight
                              className={cn(
                                "size-3.5 transition-transform duration-150",
                                isOpen && "rotate-90"
                              )}
                            />
                          </button>
                        </Collapsible.Trigger>

                        {/* Row — selects workspace as destination */}
                        <button
                          className="flex items-center gap-2 flex-1 min-w-0 pr-3 py-2 hover:bg-sidebar-accent/40 transition-colors"
                          onClick={() => selectWorkspace(ws.id)}
                        >
                          <IconRenderer
                            icon={ws.icon}
                            className="size-4 shrink-0"
                            style={{ color: ws.color || undefined }}
                          />
                          <span className="truncate text-xs font-medium text-sidebar-foreground">{ws.name}</span>
                        </button>
                      </div>

                      <Collapsible.Content>
                        <div className="border-t border-sidebar-border/60 pt-1 pb-1">
                          <SidebarMenuSub>
                            {isLoadingFolders ? (
                              <SidebarMenuSubItem>
                                <span className="px-3 py-1.5 text-[11px] text-sidebar-foreground/40 block">
                                  Loading folders…
                                </span>
                              </SidebarMenuSubItem>
                            ) : folders && folders.length === 0 ? (
                              <SidebarMenuSubItem>
                                <span className="px-3 py-1.5 text-[11px] text-sidebar-foreground/25 italic block">
                                  No folders
                                </span>
                              </SidebarMenuSubItem>
                            ) : folders ? (
                              <FolderTree
                                folders={folders}
                                depth={0}
                                selectedFolderId={selectedFolderId}
                                openIds={allOpenIds}
                                onSelect={selectFolder}
                                onToggleOpen={toggleFolderOpen}
                              />
                            ) : null}
                          </SidebarMenuSub>
                        </div>
                      </Collapsible.Content>
                    </SidebarMenuItem>
                  </Collapsible.Root>
                )
              })}
            </SidebarMenu>
          )}
        </div>

        {/* Footer — sticky, document count + Send button */}
        <div className="px-3 pt-2.5 pb-3 border-t border-sidebar-border shrink-0 flex flex-col gap-2">
          <p className="text-[11px] text-sidebar-foreground/40 text-center">
            {count === 0
              ? "No documents selected"
              : `${count} document${count === 1 ? "" : "s"} selected`}
            {selectedFolderId ? null : <span className="ml-1 text-sidebar-foreground/25">· select a destination</span>}
          </p>
          <Button
            className="w-full"
            size="sm"
            disabled={!canSend}
            onClick={handleSend}
          >
            {sendProgress
              ? `Uploading ${sendProgress.current} of ${sendProgress.total}…`
              : sending
              ? "Sending…"
              : "Send to ThinkEx"}
          </Button>
          {sendSuccess && (
            <p className="text-[11px] text-green-400 text-center leading-tight">
              {`Sent ${count} document${count === 1 ? "" : "s"} to ThinkEx`}
            </p>
          )}
          {sendError && (
            <p className="text-[11px] text-red-400 text-center leading-tight">{sendError}</p>
          )}
        </div>
      </div>
    </SidebarProvider>
  )
}
