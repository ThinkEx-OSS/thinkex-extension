const STORAGE_KEY = 'canvas_domains';
const BANNER_KEY = 'banner_enabled';

let bannerEnabled = true;

browser.storage.sync.get(BANNER_KEY).then((result) => {
  bannerEnabled = result[BANNER_KEY] !== false;
});

browser.storage.onChanged.addListener((changes) => {
  if (BANNER_KEY in changes) {
    bannerEnabled = changes[BANNER_KEY].newValue !== false;
    if (!bannerEnabled) updateBanner(0);
  }
});

let selectionObserver: MutationObserver | null = null;

// --- Shadow DOM ---

let shadowRoot: ShadowRoot | null = null;

function getShadowRoot(): ShadowRoot {
  if (shadowRoot) return shadowRoot;
  const host = document.createElement('div');
  host.id = 'thinkex-root';
  host.style.cssText = 'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: none;';
  document.body.appendChild(host);
  shadowRoot = host.attachShadow({ mode: 'open' });
  return shadowRoot;
}

// --- State ---

let bannerPos: { top: number; left: number } | null = null;
let expanded = false;
let currentCount = 0;
let openWorkspaceIds = new Set<string>();
let selectedFolderId: string | null = null;
let selectedWorkspaceId: string | null = null;

// --- Placeholder data (replaced by real API in Steps 5-7) ---

const MOCK_WORKSPACES = [
  { id: 'w1', name: 'ENGL 201', color: '#3B82F6' },
  { id: 'w2', name: 'CS 101',   color: '#10B981' },
  { id: 'w3', name: 'Research', color: '#8B5CF6' },
];

type MockFolder = { id: string; name: string; children?: MockFolder[] };

const MOCK_FOLDERS: Record<string, MockFolder[]> = {
  w1: [
    { id: 'f1', name: 'Week 1 Readings', children: [{ id: 'f1a', name: 'Primary Sources' }] },
    { id: 'f2', name: 'Assignments' },
  ],
  w2: [
    { id: 'f3', name: 'Lectures' },
    { id: 'f4', name: 'Problem Sets' },
  ],
  w3: [],
};

// --- Draggable ---

function makeDraggable(el: HTMLElement) {
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;
  let dragging = false;

  el.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = el.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    el.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const left = Math.max(0, Math.min(startLeft + (e.clientX - startX), window.innerWidth - el.offsetWidth));
    const top  = Math.max(0, Math.min(startTop  + (e.clientY - startY), window.innerHeight - el.offsetHeight));
    el.style.left  = `${left}px`;
    el.style.top   = `${top}px`;
    el.style.right = 'auto';
    bannerPos = { top, left };
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    el.style.cursor = 'grab';
  });
}

// --- Panel content ---

function renderFolderTree(
  container: HTMLElement,
  folders: MockFolder[],
  depth = 0,
) {
  folders.forEach((folder) => {
    const isOpen = openWorkspaceIds.has(folder.id);
    const isSelected = selectedFolderId === folder.id;

    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px ${4 + depth * 12}px 4px ${8 + depth * 12}px;
      border-radius: 6px;
      cursor: pointer;
      background: ${isSelected ? 'rgba(59,130,246,0.2)' : 'transparent'};
      transition: background 0.1s;
    `;
    row.onmouseenter = () => { if (!isSelected) row.style.background = 'rgba(255,255,255,0.05)'; };
    row.onmouseleave = () => { if (!isSelected) row.style.background = 'transparent'; };

    const chevron = document.createElement('span');
    chevron.textContent = '›';
    chevron.style.cssText = `
      font-size: 12px;
      color: rgba(255,255,255,0.35);
      width: 12px;
      flex-shrink: 0;
      transform: rotate(${isOpen ? '90deg' : '0deg'});
      display: inline-block;
      transition: transform 0.15s;
      visibility: ${folder.children?.length ? 'visible' : 'hidden'};
    `;

    const icon = document.createElement('span');
    icon.textContent = '📁';
    icon.style.cssText = 'font-size: 11px; flex-shrink: 0; opacity: 0.7;';

    const label = document.createElement('span');
    label.textContent = folder.name;
    label.style.cssText = `
      font-size: 12px;
      color: ${isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)'};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    `;

    row.appendChild(chevron);
    row.appendChild(icon);
    row.appendChild(label);
    container.appendChild(row);

    row.onclick = (e) => {
      e.stopPropagation();
      selectedFolderId = isSelected ? null : folder.id;
      if (folder.children?.length) {
        if (openWorkspaceIds.has(folder.id)) openWorkspaceIds.delete(folder.id);
        else openWorkspaceIds.add(folder.id);
      }
      renderPanel();
    };

    if (isOpen && folder.children?.length) {
      renderFolderTree(container, folder.children, depth + 1);
    }
  });
}

function renderPanel() {
  const root = getShadowRoot();
  const panel = root.querySelector<HTMLElement>('#thinkex-panel');
  if (!panel) return;

  panel.innerHTML = '';

  // Section label
  const label = document.createElement('p');
  label.textContent = 'Workspaces';
  label.style.cssText = `
    margin: 0 0 4px;
    padding: 0 8px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
  `;
  panel.appendChild(label);

  // Workspace list
  MOCK_WORKSPACES.forEach((ws) => {
    const isOpen = openWorkspaceIds.has(ws.id);
    const isFolderSelected = selectedWorkspaceId === ws.id;

    const wsRow = document.createElement('div');
    wsRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 5px 8px;
      border-radius: 6px;
      cursor: pointer;
      background: ${isFolderSelected ? 'rgba(255,255,255,0.07)' : 'transparent'};
      transition: background 0.1s;
    `;
    wsRow.onmouseenter = () => { if (!isFolderSelected) wsRow.style.background = 'rgba(255,255,255,0.04)'; };
    wsRow.onmouseleave = () => { if (!isFolderSelected) wsRow.style.background = 'transparent'; };

    const chevron = document.createElement('span');
    chevron.textContent = '›';
    chevron.style.cssText = `
      font-size: 13px;
      color: rgba(255,255,255,0.3);
      width: 12px;
      flex-shrink: 0;
      display: inline-block;
      transform: rotate(${isOpen ? '90deg' : '0deg'});
      transition: transform 0.15s;
    `;

    const dot = document.createElement('span');
    dot.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${ws.color};
      flex-shrink: 0;
    `;

    const wsName = document.createElement('span');
    wsName.textContent = ws.name;
    wsName.style.cssText = `
      font-size: 13px;
      font-weight: 500;
      color: rgba(255,255,255,0.8);
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;

    wsRow.appendChild(chevron);
    wsRow.appendChild(dot);
    wsRow.appendChild(wsName);
    panel.appendChild(wsRow);

    wsRow.onclick = () => {
      if (openWorkspaceIds.has(ws.id)) {
        openWorkspaceIds.delete(ws.id);
        if (selectedWorkspaceId === ws.id) {
          selectedWorkspaceId = null;
          selectedFolderId = null;
        }
      } else {
        openWorkspaceIds.add(ws.id);
        selectedWorkspaceId = ws.id;
      }
      renderPanel();
    };

    // Folders under this workspace
    if (isOpen) {
      const folders = MOCK_FOLDERS[ws.id] ?? [];

      if (folders.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'No folders';
        empty.style.cssText = `
          margin: 2px 0;
          padding: 3px 8px 3px 28px;
          font-size: 11px;
          color: rgba(255,255,255,0.2);
        `;
        panel.appendChild(empty);
      } else {
        // "Root (no folder)" option
        const rootRow = document.createElement('div');
        const rootSelected = selectedFolderId === `${ws.id}-root`;
        rootRow.style.cssText = `
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px 4px 28px;
          border-radius: 6px;
          cursor: pointer;
          background: ${rootSelected ? 'rgba(59,130,246,0.2)' : 'transparent'};
        `;
        rootRow.onmouseenter = () => { if (!rootSelected) rootRow.style.background = 'rgba(255,255,255,0.04)'; };
        rootRow.onmouseleave = () => { if (!rootSelected) rootRow.style.background = 'transparent'; };
        const rootLabel = document.createElement('span');
        rootLabel.textContent = 'Root';
        rootLabel.style.cssText = `font-size: 12px; color: ${rootSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)'}; font-style: italic;`;
        rootRow.appendChild(rootLabel);
        rootRow.onclick = (e) => {
          e.stopPropagation();
          selectedFolderId = rootSelected ? null : `${ws.id}-root`;
          renderPanel();
        };
        panel.appendChild(rootRow);

        const folderContainer = document.createElement('div');
        folderContainer.style.paddingLeft = '16px';
        renderFolderTree(folderContainer, folders);
        panel.appendChild(folderContainer);
      }
    }
  });

  // Send button
  const divider = document.createElement('div');
  divider.style.cssText = 'height: 1px; background: rgba(255,255,255,0.07); margin: 8px 0 6px;';
  panel.appendChild(divider);

  const sendBtn = document.createElement('button');
  const canSend = !!selectedFolderId;
  sendBtn.textContent = `Send ${currentCount} PDF${currentCount === 1 ? '' : 's'} to ThinkEx`;
  sendBtn.disabled = !canSend;
  sendBtn.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    border-radius: 8px;
    border: none;
    background: ${canSend ? '#3B82F6' : 'rgba(255,255,255,0.07)'};
    color: ${canSend ? '#fff' : 'rgba(255,255,255,0.25)'};
    font-size: 12px;
    font-weight: 600;
    cursor: ${canSend ? 'pointer' : 'not-allowed'};
    transition: background 0.15s;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;
  if (canSend) {
    sendBtn.onmouseenter = () => { sendBtn.style.background = '#2563EB'; };
    sendBtn.onmouseleave = () => { sendBtn.style.background = '#3B82F6'; };
    sendBtn.onclick = () => {
      console.log('[ThinkEx] Send:', {
        destination: selectedFolderId,
        workspace: selectedWorkspaceId,
        pdfCount: currentCount,
      });
    };
  }
  panel.appendChild(sendBtn);
}

// --- Banner ---

function updateBanner(count: number) {
  currentCount = count;
  const root = getShadowRoot();
  let banner = root.querySelector<HTMLElement>('#thinkex-banner');

  if (count === 0) {
    banner?.remove();
    return;
  }

  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'thinkex-banner';
    makeDraggable(banner);
    root.appendChild(banner);
  }

  banner.style.cssText = `
    position: fixed;
    top: ${bannerPos ? bannerPos.top : 24}px;
    ${bannerPos ? `left: ${bannerPos.left}px` : 'right: 24px'};
    z-index: 2147483647;
    pointer-events: auto;
    background: rgba(18, 18, 18, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    color: rgba(235, 235, 235, 0.92);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    border-radius: 14px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    display: flex;
    flex-direction: column;
    width: ${expanded ? '260px' : 'auto'};
    overflow: hidden;
    cursor: grab;
  `;

  banner.innerHTML = '';

  // --- Pill row ---
  const pill = document.createElement('div');
  pill.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    flex-shrink: 0;
    ${expanded ? 'border-bottom: 1px solid rgba(255,255,255,0.06);' : ''}
  `;

  const text = document.createElement('span');
  text.style.cssText = 'font-size: 13px; font-weight: 500; flex: 1; letter-spacing: 0.01em;';
  text.textContent = `${count} PDF${count === 1 ? '' : 's'} selected`;

  const expandBtn = document.createElement('button');
  expandBtn.textContent = expanded ? '▾' : '›';
  expandBtn.title = expanded ? 'Collapse' : 'Send to ThinkEx';
  expandBtn.style.cssText = `
    background: none; border: none;
    color: rgba(255,255,255,0.5);
    cursor: pointer; font-size: 15px;
    padding: 0; line-height: 1;
  `;
  expandBtn.onclick = () => { expanded = !expanded; updateBanner(count); };

  const dismiss = document.createElement('button');
  dismiss.textContent = '×';
  dismiss.style.cssText = `
    background: none; border: none;
    color: rgba(255,255,255,0.25);
    cursor: pointer; font-size: 17px;
    padding: 0; line-height: 1;
  `;
  dismiss.onclick = () => { expanded = false; banner!.remove(); };

  pill.appendChild(text);
  pill.appendChild(expandBtn);
  pill.appendChild(dismiss);
  banner.appendChild(pill);

  // --- Expanded panel ---
  if (expanded) {
    const panel = document.createElement('div');
    panel.id = 'thinkex-panel';
    panel.style.cssText = `
      padding: 10px 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 360px;
      overflow-y: auto;
      cursor: default;
    `;
    banner.appendChild(panel);
    renderPanel();
  }
}

function getSelectedPdfCount(): number {
  return document.querySelectorAll(
    '.ef-item-row[aria-selected="true"] .mimeClass-pdf'
  ).length;
}

// --- Layer 2: selection observer ---

function setupSelectionObserver(directory: Element) {
  if (selectionObserver) return;

  selectionObserver = new MutationObserver(() => {
    updateBanner(bannerEnabled ? getSelectedPdfCount() : 0);
  });

  selectionObserver.observe(directory, {
    attributes: true,
    attributeFilter: ['aria-selected'],
    subtree: true,
  });

  updateBanner(getSelectedPdfCount());
}

function teardownSelectionObserver() {
  selectionObserver?.disconnect();
  selectionObserver = null;
  expanded = false;
  openWorkspaceIds.clear();
  selectedFolderId = null;
  selectedWorkspaceId = null;
  updateBanner(0);
}

// --- Layer 1: directory observer ---

function setupDirectoryObserver() {
  const existing = document.querySelector('.ef-directory');
  if (existing) setupSelectionObserver(existing);

  const directoryObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        const directory = node.classList.contains('ef-directory')
          ? node : node.querySelector('.ef-directory');
        if (directory) setupSelectionObserver(directory);
      }
      for (const node of mutation.removedNodes) {
        if (!(node instanceof Element)) continue;
        const wasDirectory = node.classList.contains('ef-directory') || node.querySelector('.ef-directory');
        if (wasDirectory) teardownSelectionObserver();
      }
    }
  });

  directoryObserver.observe(document.body, { childList: true, subtree: true });
}

// --- Auth + Canvas detection ---

async function isSessionActive(): Promise<boolean> {
  return new Promise((resolve) => {
    browser.runtime.sendMessage({ type: 'GET_SESSION' }, (response) => {
      resolve(!!response?.session?.user);
    });
  });
}

async function getSavedDomains(): Promise<string[]> {
  const result = await browser.storage.sync.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? [];
}

async function saveDomain(domain: string): Promise<void> {
  const existing = await getSavedDomains();
  if (!existing.includes(domain)) {
    await browser.storage.sync.set({ [STORAGE_KEY]: [...existing, domain] });
  }
}

async function probeForCanvas(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`${domain}/api/v1/courses?per_page=1`);
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

export default defineContentScript({
  matches: ['https://*/*'],
  async main() {
    const signedIn = await isSessionActive();
    if (!signedIn) return;

    const domain = `${location.protocol}//${location.hostname}`;
    const savedDomains = await getSavedDomains();

    if (savedDomains.some((d) => domain.includes(d))) {
      setupDirectoryObserver();
      return;
    }

    const isCanvas = await probeForCanvas(domain);
    if (isCanvas) {
      await saveDomain(location.hostname);
      setupDirectoryObserver();
    }
  },
});
