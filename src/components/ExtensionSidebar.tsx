import * as React from "react"
import * as Collapsible from "@radix-ui/react-collapsible"
import { ChevronRight, Folder as FolderIcon, FolderOpen, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { IconRenderer } from "@/lib/icon-renderer"
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const BANNER_KEY = "banner_enabled"

function buildFolderTree(folders: FolderItem[], parentId?: string): FolderTreeItem[] {
  return folders
    .filter((f) => (f.folderId ?? undefined) === parentId)
    .map((f) => {
      const children = buildFolderTree(folders, f.id)
      return { id: f.id, name: f.name, color: f.color, ...(children.length > 0 && { children }) }
    })
}

function getSelectedPdfCount(): number {
  return document.querySelectorAll(
    '.ef-item-row[aria-selected="true"] .mimeClass-pdf'
  ).length
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
  // Extension state
  const [enabled, setEnabled] = React.useState(true)
  const [count, setCount] = React.useState(0)
  const [expanded, setExpanded] = React.useState(false)
  const [tabTop, setTabTop] = React.useState<number | null>(null)

  // Workspace + folder data
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([])
  const [workspacesLoading, setWorkspacesLoading] = React.useState(true)
  const [foldersByWorkspace, setFoldersByWorkspace] = React.useState<
    Record<string, FolderItem[]>
  >({})
  const [loadingFolderForId, setLoadingFolderForId] = React.useState<string | null>(null)

  // Selection state
  const [openWorkspaceIds, setOpenWorkspaceIds] = React.useState<Set<string>>(new Set())
  const [openFolderIds, setOpenFolderIds] = React.useState<Set<string>>(new Set())
  const [selectedFolderId, setSelectedFolderId] = React.useState<string | null>(null)

  const widgetRef = React.useRef<HTMLDivElement>(null)
  const tabRef = React.useRef<HTMLButtonElement>(null)

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

  // ── Fetch workspace list ────────────────────────────────────────────────
  React.useEffect(() => {
    browser.runtime.sendMessage({ type: "FETCH_WORKSPACES" }, (response) => {
      setWorkspaces(response?.workspaces ?? [])
      setWorkspacesLoading(false)
    })
  }, [])

  // ── Prefetch folders as soon as workspaces load (if banner is enabled) ──
  React.useEffect(() => {
    if (!enabled || workspaces.length === 0) return
    workspaces.forEach((ws) => {
      if (ws.id in foldersByWorkspace) return
      browser.runtime.sendMessage(
        { type: "FETCH_WORKSPACE_FOLDERS", id: ws.id },
        (response) => {
          const folders: Array<{ id: string; name: string; folderId?: string; color?: string }> =
            response?.folders ?? []
          setFoldersByWorkspace((prev) => ({ ...prev, [ws.id]: folders }))
        }
      )
    })
  }, [enabled, workspaces])

  // ── Watch .ef-directory for PDF selection changes ───────────────────────
  React.useEffect(() => {
    let selectionObserver: MutationObserver | null = null

    function setupObserver(directory: Element) {
      selectionObserver?.disconnect()
      selectionObserver = new MutationObserver(() => setCount(getSelectedPdfCount()))
      selectionObserver.observe(directory, {
        attributes: true,
        attributeFilter: ["aria-selected"],
        subtree: true,
      })
      setCount(getSelectedPdfCount())
    }

    const existing = document.querySelector(".ef-directory")
    if (existing) setupObserver(existing)

    const directoryObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue
          const dir = node.classList.contains("ef-directory")
            ? node
            : node.querySelector(".ef-directory")
          if (dir) setupObserver(dir)
        }
        for (const node of mutation.removedNodes) {
          if (!(node instanceof Element)) continue
          if (
            node.classList.contains("ef-directory") ||
            node.querySelector?.(".ef-directory")
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
      if (!isCurrentlyOpen && !(wsId in foldersByWorkspace) && loadingFolderForId !== wsId) {
        setLoadingFolderForId(wsId)
        browser.runtime.sendMessage(
          { type: "FETCH_WORKSPACE_FOLDERS", id: wsId },
          (response) => {
            const folders: Array<{ id: string; name: string; folderId?: string; color?: string }> =
              response?.folders ?? []
            setFoldersByWorkspace((prev) => ({ ...prev, [wsId]: folders }))
            setLoadingFolderForId(null)
          }
        )
      }
    },
    [openWorkspaceIds, foldersByWorkspace, loadingFolderForId]
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

  const canSend = !!selectedFolderId && count > 0

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
        <div className="flex items-center gap-2 px-4 h-12 border-b border-sidebar-border shrink-0">
          <button
            className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-75 transition-opacity cursor-pointer"
            onClick={() => window.open("https://thinkex.app", "_blank")}
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
          <button
            className="text-sidebar-foreground/35 hover:text-sidebar-foreground/70 transition-colors cursor-pointer p-1 rounded"
            onClick={() => setExpanded(false)}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Workspace + folder tree — scrollable */}
        <div
          className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-2"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "hsl(240 3.7% 25%) transparent",
          }}
        >
          {workspacesLoading ? (
            <p className="px-1 py-2 text-[12px] text-sidebar-foreground/40">Loading…</p>
          ) : workspaces.length === 0 ? (
            <p className="px-1 py-2 text-[12px] text-sidebar-foreground/40 italic">No workspaces found</p>
          ) : (
            <SidebarMenu>
              {workspaces.map((ws) => {
                const isOpen = openWorkspaceIds.has(ws.id)
                const rawFolders = foldersByWorkspace[ws.id]
                const folders = rawFolders ? buildFolderTree(rawFolders) : null
                const isLoadingFolders = loadingFolderForId === ws.id

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

        {/* Footer — sticky, PDF count + Send button */}
        <div className="px-3 pt-2.5 pb-3 border-t border-sidebar-border shrink-0 flex flex-col gap-2">
          <p className="text-[11px] text-sidebar-foreground/40 text-center">
            {count === 0
              ? "No PDFs selected"
              : `${count} PDF${count === 1 ? "" : "s"} selected`}
            {selectedFolderId ? null : <span className="ml-1 text-sidebar-foreground/25">· select a destination</span>}
          </p>
          <Button
            className="w-full"
            size="sm"
            disabled={!canSend}
            onClick={() => {
              if (!canSend) return
              console.log("[ThinkEx] Send:", {
                destination: selectedFolderId,
                pdfCount: count,
              })
            }}
          >
            Send to ThinkEx
          </Button>
        </div>
      </div>
    </SidebarProvider>
  )
}
