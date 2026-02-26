import { ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { tabStore } from '@/store/tabStore';
import { Rows, Columns } from 'lucide-react';
import {
  ContextMenuRoot,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/Shared/ContextMenu';

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
    <ContextMenuRoot>
      <ContextMenuTrigger>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onCopy} shortcut="Ctrl+Shift+C">
          Copy
        </ContextMenuItem>
        <ContextMenuItem onSelect={onPaste} shortcut="Ctrl+Shift+V">
          Paste
        </ContextMenuItem>

        <ContextMenuSeparator />

        {tabId && paneId && (
          <>
            <ContextMenuItem
              onSelect={() => splitPane('vertical')}
              icon={<Rows size={14} strokeWidth={2} />}
            >
              Split Vertically
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => splitPane('horizontal')}
              icon={<Columns size={14} strokeWidth={2} />}
            >
              Split Horizontally
            </ContextMenuItem>
            <ContextMenuItem onSelect={handleClosePane} danger>
              Close Pane
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        <ContextMenuItem onSelect={onSelectAll}>
          Select All
        </ContextMenuItem>
        <ContextMenuItem onSelect={onClear} shortcut="Ctrl+L">
          Clear Terminal
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuRoot>
  );
}
