import * as ContextMenu from '@radix-ui/react-context-menu';
import { ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { tabStore } from '@/store/tabStore';
import { Rows, Columns } from 'lucide-react';

interface TerminalContextMenuProps {
  children: ReactNode;
  onCopy: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  tabId?: string;
  paneId?: string;
}

export function TerminalContextMenu({
  children,
  onCopy,
  onPaste,
  onSelectAll,
  onClear,
  tabId,
  paneId
}: TerminalContextMenuProps) {
  const splitPane = async (direction: 'vertical' | 'horizontal') => {
    if (!tabId || !paneId) return;

    // Create a new PTY session first
    let sessionId: string;
    try {
      sessionId = await invoke('create_pty_session', {
        shell: null,
        args: null,
        cwd: null,
        cols: 80,
        rows: 24,
      });
    } catch (error) {
      console.error('Failed to create PTY session for split:', error);
      return;
    }

    // Split the pane and get the new pane ID
    tabStore.getState().splitPane(tabId, paneId, direction);

    // Update the new pane with the session ID
    const { updateTab } = tabStore.getState();
    const currentTab = tabStore.getState().tabs.find(t => t.id === tabId);
    if (currentTab) {
      const updatePane = (pane: any): any => {
        if (pane.type === 'terminal' && pane.sessionId === '') {
          // New pane has empty sessionId, update it
          return { ...pane, sessionId };
        } else if (pane.type === 'split') {
          return { ...pane, children: pane.children.map(updatePane) };
        }
        return pane;
      };
      updateTab(tabId, { rootPane: updatePane(currentTab.rootPane) });
    }
  };

  const handleClosePane = async () => {
    if (!tabId || !paneId) return;

    // Find the pane to get its sessionId for killing the PTY session
    const { tabs } = tabStore.getState();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const findPaneSessionId = (pane: any): string | null => {
      if (pane.type === 'terminal' && pane.id === paneId) {
        return pane.sessionId;
      } else if (pane.type === 'split') {
        for (const child of pane.children) {
          const sessionId = findPaneSessionId(child);
          if (sessionId) return sessionId;
        }
      }
      return null;
    };

    const sessionId = findPaneSessionId(tab.rootPane);

    // Kill the PTY session if we found one
    if (sessionId) {
      try {
        await invoke('pty_kill', { sessionId });
      } catch (err) {
        console.error('Failed to kill PTY session:', err);
      }
    }

    // Close the pane
    tabStore.getState().closePane(tabId, paneId);
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger className="w-full h-full block">
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content 
          className="min-w-[220px] app-surface-2 overflow-hidden p-[5px] shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] border app-border z-[9999]"
        >
          <ContextMenu.Item 
            className="group text-[13px] leading-none app-text flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none cursor-default data-[highlighted]:bg-[color:var(--app-accent)] data-[highlighted]:text-[color:var(--app-text)]"
            onSelect={onCopy}
          >
            Copy
            <div className="ml-auto pl-[20px] app-text-muted group-data-[highlighted]:text-[color:var(--app-text)] text-[11px]">
              Ctrl+Shift+C
            </div>
          </ContextMenu.Item>
          <ContextMenu.Item 
            className="group text-[13px] leading-none app-text flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none cursor-default data-[highlighted]:bg-[color:var(--app-accent)] data-[highlighted]:text-[color:var(--app-text)]"
            onSelect={onPaste}
          >
            Paste
            <div className="ml-auto pl-[20px] app-text-muted group-data-[highlighted]:text-[color:var(--app-text)] text-[11px]">
              Ctrl+Shift+V
            </div>
          </ContextMenu.Item>

          <ContextMenu.Separator className="h-px w-full my-1 bg-[color:var(--app-border)]" />

          {tabId && paneId && (
            <>
              <ContextMenu.Item
                className="group text-[13px] leading-none app-text flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none cursor-default data-[highlighted]:bg-[color:var(--app-accent)] data-[highlighted]:text-[color:var(--app-text)]"
                onSelect={() => splitPane('vertical')}
              >
                Split Vertically
                <div className="absolute left-[5px] app-text-muted group-data-[highlighted]:text-[color:var(--app-text)]">
                  <Rows size={14} strokeWidth={2} />
                </div>
              </ContextMenu.Item>
              <ContextMenu.Item
                className="group text-[13px] leading-none app-text flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none cursor-default data-[highlighted]:bg-[color:var(--app-accent)] data-[highlighted]:text-[color:var(--app-text)]"
                onSelect={() => splitPane('horizontal')}
              >
                Split Horizontally
                <div className="absolute left-[5px] app-text-muted group-data-[highlighted]:text-[color:var(--app-text)]">
                  <Columns size={14} strokeWidth={2} />
                </div>
              </ContextMenu.Item>
              <ContextMenu.Item
                className="group text-[13px] leading-none app-text flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none cursor-default data-[highlighted]:bg-[color:var(--app-danger)] data-[highlighted]:text-[color:var(--app-on-danger)]"
                onSelect={handleClosePane}
              >
                Close Pane
              </ContextMenu.Item>
              <ContextMenu.Separator className="h-px w-full my-1 bg-[color:var(--app-border)]" />
            </>
          )}

          <ContextMenu.Item 
            className="group text-[13px] leading-none app-text flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none cursor-default data-[highlighted]:bg-[color:var(--app-accent)] data-[highlighted]:text-[color:var(--app-text)]"
            onSelect={onSelectAll}
          >
            Select All
          </ContextMenu.Item>
          <ContextMenu.Item 
            className="group text-[13px] leading-none app-text flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none cursor-default data-[highlighted]:bg-[color:var(--app-accent)] data-[highlighted]:text-[color:var(--app-text)]"
            onSelect={onClear}
          >
            Clear Terminal
            <div className="ml-auto pl-[20px] app-text-muted group-data-[highlighted]:text-[color:var(--app-text)] text-[11px]">
              Ctrl+L
            </div>
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
