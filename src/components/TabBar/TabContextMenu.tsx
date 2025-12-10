import { useEffect, useRef } from 'react';
import { useTabStore } from '@/store/tabStore';
import { invoke } from '@tauri-apps/api/core';

interface TabContextMenuProps {
  x: number;
  y: number;
  tabId: string;
  sessionId: string;
  onClose: () => void;
}

export function TabContextMenu({ x, y, tabId, sessionId, onClose }: TabContextMenuProps) {
  const { tabs, removeTab } = useTabStore();
  const menuRef = useRef<HTMLDivElement>(null);

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
    try {
      await invoke('pty_kill', { sessionId });
    } catch (err) {
      console.error('Failed to kill PTY session:', err);
    }
    removeTab(tabId);
    onClose();
  };

  const handleCloseOthers = async () => {
    const otherTabs = tabs.filter((t) => t.id !== tabId);
    for (const tab of otherTabs) {
      try {
        await invoke('pty_kill', { sessionId: tab.sessionId });
      } catch (err) {
        console.error(`Failed to kill PTY session for tab ${tab.id}:`, err);
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
      try {
        await invoke('pty_kill', { sessionId: tab.sessionId });
      } catch (err) {
        console.error(`Failed to kill PTY session for tab ${tab.id}:`, err);
      }
      removeTab(tab.id);
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 text-sm text-gray-200"
      style={{ top: y, left: x }}
    >
      <button
        className="w-full text-left px-4 py-2 hover:bg-gray-700 transition-colors"
        onClick={handleClose}
      >
        Close
      </button>
      <button
        className="w-full text-left px-4 py-2 hover:bg-gray-700 transition-colors"
        onClick={handleCloseOthers}
      >
        Close Others
      </button>
      <button
        className="w-full text-left px-4 py-2 hover:bg-gray-700 transition-colors"
        onClick={handleCloseToRight}
      >
        Close to the Right
      </button>
    </div>
  );
}
