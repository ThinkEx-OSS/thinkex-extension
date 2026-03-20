import * as React from "react"
import * as Collapsible from "@radix-ui/react-collapsible"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  SidebarProvider,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
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
}

interface FolderTreeItem {
  id: string
  name: string
  children?: FolderTreeItem[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BANNER_KEY = "banner_enabled"

function buildFolderTree(folders: FolderItem[], parentId?: string): FolderTreeItem[] {
  return folders
    .filter((f) => (f.folderId ?? undefined) === parentId)
    .map((f) => {
      const children = buildFolderTree(folders, f.id)
      return { id: f.id, name: f.name, ...(children.length > 0 && { children }) }
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
          <React.Fragment key={folder.id}>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                isActive={isSelected}
                style={{ paddingLeft: `${8 + depth * 12}px` }}
                onClick={() => {
                  onSelect(folder.id)
                  if (hasChildren) onToggleOpen(folder.id)
                }}
              >
                <ChevronRight
                  className={cn(
                    "size-3 shrink-0 text-sidebar-foreground/40 transition-transform duration-150",
                    hasChildren ? "opacity-100" : "opacity-0",
                    isOpen && "rotate-90"
                  )}
                />
                <span className="text-[11px]">📁</span>
                <span>{folder.name}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>

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
          </React.Fragment>
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
    let didDrag = false
    let startY = 0
    let startTop = 0

    const onMouseDown = (e: MouseEvent) => {
      dragging = true
      didDrag = false
      startY = e.clientY
      startTop = widget.getBoundingClientRect().top
      tab.style.cursor = "grabbing"
      e.preventDefault()
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return
      const delta = e.clientY - startY
      if (Math.abs(delta) > 3) didDrag = true
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
    const onClick = () => {
      if (didDrag) { didDrag = false; return }
      setExpanded(true)
    }

    tab.addEventListener("mousedown", onMouseDown)
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    tab.addEventListener("click", onClick)

    return () => {
      tab.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
      tab.removeEventListener("click", onClick)
    }
  }, [expanded])

  // ── Workspace toggle — also triggers lazy folder load ───────────────────
  const toggleWorkspace = React.useCallback(
    (wsId: string) => {
      const isCurrentlyOpen = openWorkspaceIds.has(wsId)

      setOpenWorkspaceIds((prev) => {
        const next = new Set(prev)
        if (next.has(wsId)) {
          next.delete(wsId)
          setSelectedFolderId((sf) =>
            sf === `${wsId}-root` || sf?.startsWith(wsId) ? null : sf
          )
        } else {
          next.add(wsId)
        }
        return next
      })

      // Lazy-load folders on first expand
      if (!isCurrentlyOpen && !(wsId in foldersByWorkspace) && loadingFolderForId !== wsId) {
        setLoadingFolderForId(wsId)
        browser.runtime.sendMessage(
          { type: "FETCH_WORKSPACE_EVENTS", id: wsId },
          (response) => {
            const items: Array<{ type: string; id: string; name: string; folderId?: string }> =
              response?.snapshot?.state?.items ?? []
            const folders = items.filter((item) => item.type === "folder")
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
        style={{
          position: "fixed",
          ...(tabTop !== null
            ? { top: `${tabTop}px`, transform: "none" }
            : { top: "50%", transform: "translateY(-50%)" }),
          right: 0,
          zIndex: 2147483647,
          pointerEvents: "auto",
        }}
      >
        <button
          ref={tabRef}
          style={{ cursor: "grab" }}
          className="flex flex-col items-center gap-2 py-4 px-2.5 bg-sidebar border border-r-0 border-sidebar-border rounded-l-xl shadow-xl text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <span className="flex items-center justify-center min-w-5 h-5 rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-[11px] font-bold px-1 leading-none">
            {count}
          </span>
          <span
            className="text-[10px] font-medium text-sidebar-foreground/45 uppercase tracking-wider"
            style={{ writingMode: "vertical-rl" }}
          >
            PDFs
          </span>
          <span className="text-sidebar-foreground/30 text-sm leading-none">‹</span>
        </button>
      </div>
    )
  }

  // ── Expanded panel ──────────────────────────────────────────────────────
  return (
    <SidebarProvider
      open={true}
      className="!min-h-0 !w-auto"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "280px",
        zIndex: 2147483647,
        pointerEvents: "auto",
      } as React.CSSProperties}
    >
      <div className="flex flex-col h-full w-full bg-sidebar border-l border-sidebar-border shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-2 px-3.5 py-4 border-b border-sidebar-border shrink-0">
          <span className="text-[13px] font-medium text-sidebar-foreground flex-1 tracking-tight">
            {count} PDF{count === 1 ? "" : "s"} selected
          </span>
          <button
            className="text-sidebar-foreground/35 hover:text-sidebar-foreground/70 transition-colors text-xl leading-none cursor-pointer"
            onClick={() => setExpanded(false)}
          >
            ›
          </button>
        </div>

        {/* Workspace + folder tree */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
            <SidebarGroupContent>
              {workspacesLoading ? (
                <div className="px-4 py-3 text-[12px] text-sidebar-foreground/40">
                  Loading…
                </div>
              ) : workspaces.length === 0 ? (
                <div className="px-4 py-3 text-[12px] text-sidebar-foreground/40 italic">
                  No workspaces found
                </div>
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
                        onOpenChange={() => toggleWorkspace(ws.id)}
                        asChild
                      >
                        <SidebarMenuItem>
                          <Collapsible.Trigger asChild>
                            <SidebarMenuButton>
                              <ChevronRight
                                className={cn(
                                  "size-4 shrink-0 text-sidebar-foreground/40 transition-transform duration-150",
                                  isOpen && "rotate-90"
                                )}
                              />
                              {ws.color ? (
                                <span
                                  className="size-2 rounded-full shrink-0"
                                  style={{ background: ws.color }}
                                />
                              ) : (
                                <span className="size-2 rounded-full shrink-0 bg-sidebar-foreground/30" />
                              )}
                              <span>{ws.name}</span>
                            </SidebarMenuButton>
                          </Collapsible.Trigger>

                          <Collapsible.Content>
                            <SidebarMenuSub>
                              {isLoadingFolders ? (
                                <SidebarMenuSubItem>
                                  <span className="px-2 py-1 text-[11px] text-sidebar-foreground/40">
                                    Loading folders…
                                  </span>
                                </SidebarMenuSubItem>
                              ) : folders && folders.length === 0 ? (
                                <SidebarMenuSubItem>
                                  <span className="px-2 py-1 text-[11px] text-sidebar-foreground/25 italic">
                                    No folders
                                  </span>
                                </SidebarMenuSubItem>
                              ) : folders ? (
                                <>
                                  <SidebarMenuSubItem>
                                    <SidebarMenuSubButton
                                      isActive={selectedFolderId === `${ws.id}-root`}
                                      onClick={() => selectFolder(`${ws.id}-root`)}
                                    >
                                      <span className="italic text-sidebar-foreground/40 text-xs">
                                        Root
                                      </span>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                  <FolderTree
                                    folders={folders}
                                    depth={0}
                                    selectedFolderId={selectedFolderId}
                                    openIds={allOpenIds}
                                    onSelect={selectFolder}
                                    onToggleOpen={toggleFolderOpen}
                                  />
                                </>
                              ) : null}
                            </SidebarMenuSub>
                          </Collapsible.Content>
                        </SidebarMenuItem>
                      </Collapsible.Root>
                    )
                  })}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border shrink-0">
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
            {count === 0
              ? "No PDFs selected"
              : `Send ${count} PDF${count === 1 ? "" : "s"} to ThinkEx`}
          </Button>
        </div>
      </div>
    </SidebarProvider>
  )
}
