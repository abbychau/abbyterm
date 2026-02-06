import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore, tabStore } from '@/store/tabStore';

export function useSessionManager() {
  const { tabs } = useTabStore();

  // Session manager hooks

  // Helper to get CWD for a terminal pane
  const getTerminalCwd = useCallback(async (sessionId: string): Promise<string> => {
    try {
      return await invoke<string>('get_session_cwd', { sessionId });
    } catch (err) {
      console.error('Failed to get CWD for session:', sessionId, err);
      return '';
    }
  }, []);

  // Recursively collect pane snapshots with CWDs
  const collectPaneSnapshots = useCallback(
    async (pane: any): Promise<any> => {
      if (pane.type === 'terminal') {
        const cwd = await getTerminalCwd(pane.sessionId);
        return {
          type: 'terminal',
          id: pane.id,
          title: pane.title,
          tab_type: pane.tabType,
          cwd,
          session_id: pane.sessionId,
        };
      } else if (pane.type === 'split') {
        const childrenSnapshots = await Promise.all(
          pane.children.map((child: any) => collectPaneSnapshots(child))
        );
        return {
          type: 'split',
          id: pane.id,
          direction: pane.direction,
          children: childrenSnapshots,
          sizes: pane.sizes,
        };
      }
      throw new Error('Unknown pane type');
    },
    [getTerminalCwd]
  );

  // Save current session as snapshot
  const saveSession = useCallback(
    async (name: string): Promise<void> => {
      const tabSnapshots = await Promise.all(
        tabs.map(async (tab) => {
          const rootPaneSnapshot = await collectPaneSnapshots(tab.rootPane);
          return {
            id: tab.id,
            title: tab.title,
            type_: tab.type,
            session_id: tab.sessionId,
            root_pane: rootPaneSnapshot,
          };
        })
      );

      const snapshot = {
        name,
        created_at: new Date().toISOString(),
        tabs: tabSnapshots,
      };

      // Save to Tauri app data directory
      await invoke('save_session_snapshot', { snapshot });
    },
    [tabs, collectPaneSnapshots]
  );

  // Load session from snapshot
  const loadSession = useCallback(
    async (snapshot: any): Promise<void> => {
      const { addTab, setActiveTab } = tabStore.getState();

      // Recursively recreate panes from snapshot with new unique IDs
      const recreatePane = async (
        paneSnapshot: any
      ): Promise<any> => {
        if (paneSnapshot.type === 'terminal') {
          // Create new PTY session
          const sessionId = await invoke<string>('create_pty_session', {
            shell: null,
            args: null,
            cwd: paneSnapshot.cwd,
            cols: 80,
            rows: 24,
          });

          return {
            type: 'terminal',
            id: uuidv4(), // Generate new unique ID
            sessionId,
            title: paneSnapshot.title,
            tabType: paneSnapshot.tab_type,
          };
        } else if (paneSnapshot.type === 'split') {
          const children = await Promise.all(
            paneSnapshot.children.map((child: any) => recreatePane(child))
          );
          return {
            type: 'split',
            id: uuidv4(), // Generate new unique ID
            direction: paneSnapshot.direction,
            children,
            sizes: paneSnapshot.sizes,
          };
        }
        throw new Error('Unknown pane type');
      };

      // Helper to find the first terminal session ID in the pane tree
      const findFirstTerminalSessionId = (pane: any): string | null => {
        if (pane.type === 'terminal') {
          return pane.sessionId;
        } else if (pane.type === 'split') {
          for (const child of pane.children) {
            const sessionId = findFirstTerminalSessionId(child);
            if (sessionId) return sessionId;
          }
        }
        return null;
      };

      // Track the first tab ID to set as active later
      let firstTabId: string | null = null;

      // Create tabs from snapshot
      for (const tabSnapshot of snapshot.tabs) {
        const rootPane = await recreatePane(tabSnapshot.root_pane);
        const newTabId = uuidv4(); // Generate new unique ID for tab

        // Get the primary terminal session ID from the recreated pane tree
        const primarySessionId = findFirstTerminalSessionId(rootPane);

        const tab = {
          id: newTabId,
          title: tabSnapshot.title,
          sessionId: primarySessionId || '', // Use actual session ID or empty string
          type: tabSnapshot.type_,
          rootPane,
        };

        addTab(tab);

        // Track first tab
        if (!firstTabId) {
          firstTabId = newTabId;
        }
      }

      // Set first tab of the loaded session as active
      if (firstTabId) {
        setActiveTab(firstTabId);
      }
    },
    []
  );

  return {
    saveSession,
    loadSession,
  };
}
