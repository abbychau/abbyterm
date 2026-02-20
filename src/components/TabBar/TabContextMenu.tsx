import { useEffect, useRef, useState } from 'react';
import { useTabStore } from '@/store/tabStore';
import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

interface TabContextMenuProps {
  x: number;
  y: number;
  tabId: string;
  onClose: () => void;
}

export function TabContextMenu({ x, y, tabId, onClose }: TabContextMenuProps) {
  const { tabs, removeTab } = useTabStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'success' | 'error'>('idle');

  const currentTab = tabs.find((t) => t.id === tabId);
  const isDocker = currentTab?.title.startsWith('Docker:');
  const isK8s = currentTab?.title.startsWith('K8s:');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleClose = async () => {
    const currentTab = tabs.find((t) => t.id === tabId);
    if (currentTab) {
      const collectSessionIds = (pane: any): string[] => {
        if (pane.type === 'terminal') {
          return [pane.sessionId];
        } else if (pane.type === 'split') {
          return pane.children.flatMap((child: any) => collectSessionIds(child));
        }
        return [];
      };

      const sessionIds = collectSessionIds(currentTab.rootPane);
      for (const sid of sessionIds) {
        try {
          await invoke('pty_kill', { sessionId: sid });
        } catch (err) {
          console.error('Failed to kill PTY session:', sid, err);
        }
      }
    }
    removeTab(tabId);
    onClose();
  };

  const handleCloseOthers = async () => {
    const otherTabs = tabs.filter((t) => t.id !== tabId);
    for (const tab of otherTabs) {
      const collectSessionIds = (pane: any): string[] => {
        if (pane.type === 'terminal') {
          return [pane.sessionId];
        } else if (pane.type === 'split') {
          return pane.children.flatMap((child: any) => collectSessionIds(child));
        }
        return [];
      };

      const sessionIds = collectSessionIds(tab.rootPane);
      for (const sid of sessionIds) {
        try {
          await invoke('pty_kill', { sessionId: sid });
        } catch (err) {
          console.error(`Failed to kill PTY session for tab ${tab.id}:`, err);
        }
      }
      removeTab(tab.id);
    }
    onClose();
  };

  const handleCloseToRight = async () => {
    const index = tabs.findIndex((t) => t.id === tabId);
    if (index === -1) return;

    const tabsToRight = tabs.slice(index + 1);
    for (const tab of tabsToRight) {
      const collectSessionIds = (pane: any): string[] => {
        if (pane.type === 'terminal') {
          return [pane.sessionId];
        } else if (pane.type === 'split') {
          return pane.children.flatMap((child: any) => collectSessionIds(child));
        }
        return [];
      };

      const sessionIds = collectSessionIds(tab.rootPane);
      for (const sid of sessionIds) {
        try {
          await invoke('pty_kill', { sessionId: sid });
        } catch (err) {
          console.error(`Failed to kill PTY session for tab ${tab.id}:`, err);
        }
      }
      removeTab(tab.id);
    }
    onClose();
  };

  const handleCopyWorkingDirectory = async () => {
    setCopyStatus('copying');
    try {
      let textToCopy: string;

      if (isDocker) {
        // Extract container name from "Docker: container-name"
        textToCopy = currentTab?.title.replace('Docker: ', '') || '';
      } else if (isK8s) {
        // Extract pod name from "K8s: namespace/pod-name"
        const parts = currentTab?.title.replace('K8s: ', '').split('/') || [];
        textToCopy = parts[parts.length - 1] || ''; // Get the pod name (last part)
      } else {
        // For local terminals, find the first terminal session ID and get the actual CWD
        const findFirstTerminalSessionId = (pane: any): string | null => {
          if (pane.type === 'terminal') {
            return pane.sessionId;
          } else if (pane.type === 'split') {
            for (const child of pane.children) {
              const sid = findFirstTerminalSessionId(child);
              if (sid) return sid;
            }
          }
          return null;
        };

        const firstSessionId = findFirstTerminalSessionId(currentTab?.rootPane);
        if (firstSessionId) {
          textToCopy = await invoke<string>('get_session_cwd', { sessionId: firstSessionId });
        } else {
          textToCopy = '';
        }
      }

      await writeText(textToCopy);
      setCopyStatus('success');

      // Reset status after 1.5 seconds
      setTimeout(() => {
        setCopyStatus('idle');
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
      setCopyStatus('error');

      // Reset status after 1.5 seconds
      setTimeout(() => {
        setCopyStatus('idle');
      }, 1500);
    }
  };

  const getCopyButtonText = () => {
    if (copyStatus === 'copying') return 'Copying...';
    if (copyStatus === 'success') return 'Copied!';
    if (copyStatus === 'error') return 'Failed to copy';

    // Default state - show appropriate text based on tab type
    if (isDocker) return 'Copy Container Name';
    if (isK8s) return 'Copy Pod Name';
    return 'Copy Working Directory';
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-48 app-surface-2 border app-border shadow-lg py-1 text-sm app-text no-select"
      style={{ top: y, left: x }}
    >
      <button
        className={`w-full text-left px-4 py-2 transition-colors ${
          copyStatus === 'success'
            ? 'app-bg-success app-hover-success'
            : copyStatus === 'error'
            ? 'app-bg-danger app-hover-danger'
            : 'app-hover'
        }`}
        onClick={handleCopyWorkingDirectory}
        disabled={copyStatus === 'copying'}
      >
        {getCopyButtonText()}
      </button>
      <div className="h-px my-1 app-border" />
      <button
        className="w-full text-left px-4 py-2 app-hover transition-colors"
        onClick={handleClose}
      >
        Close
      </button>
      <button
        className="w-full text-left px-4 py-2 app-hover transition-colors"
        onClick={handleCloseOthers}
      >
        Close Others
      </button>
      <button
        className="w-full text-left px-4 py-2 app-hover transition-colors"
        onClick={handleCloseToRight}
      >
        Close to the Right
      </button>
    </div>
  );
}
