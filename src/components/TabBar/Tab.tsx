import { useState } from 'react';
import { X } from 'lucide-react';
import { useTabStore } from '@/store/tabStore';
import { invoke } from '@tauri-apps/api/core';
import { TabContextMenu } from './TabContextMenu';

interface TabProps {
  id: string;
  title: string;
  isActive: boolean;
}

export function Tab({ id, title, isActive }: TabProps) {
  const { setActiveTab, removeTab } = useTabStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Find the tab to get all PTY session IDs from its panes
    const { tabs } = useTabStore.getState();
    const tab = tabs.find((t) => t.id === id);
    if (tab) {
      // Recursively collect all session IDs from the pane tree
      const collectSessionIds = (pane: any): string[] => {
        if (pane.type === 'terminal') {
          return [pane.sessionId];
        } else if (pane.type === 'split') {
          return pane.children.flatMap((child: any) => collectSessionIds(child));
        }
        return [];
      };

      const sessionIds = collectSessionIds(tab.rootPane);

      // Kill all PTY sessions in this tab
      for (const sid of sessionIds) {
        try {
          await invoke('pty_kill', { sessionId: sid });
        } catch (err) {
          console.error('Failed to kill PTY session:', sid, err);
        }
      }
    }

    // Remove tab from store
    removeTab(id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div
        className={`
          h-9 px-3 flex items-center gap-2 cursor-pointer border-r app-border min-w-[120px] max-w-[300px] select-none
          ${
            isActive
              ? 'app-surface-2 app-text'
              : 'app-surface app-text-muted app-hover'
          }
        `}
        onClick={() => setActiveTab(id)}
        onContextMenu={handleContextMenu}
        title={title}
      >
        <span className="text-sm truncate flex-1">{title}</span>
        <button
          onClick={handleClose}
          className="app-hover-2 p-0.5 transition-colors flex-shrink-0"
          aria-label="Close tab"
        >
          <X size={14} />
        </button>
      </div>
      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tabId={id}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
