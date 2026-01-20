import { useState } from 'react';
import { X } from 'lucide-react';
import { useTabStore } from '@/store/tabStore';
import { invoke } from '@tauri-apps/api/core';
import { TabContextMenu } from './TabContextMenu';

interface TabProps {
  id: string;
  title: string;
  isActive: boolean;
  sessionId: string;
}

export function Tab({ id, title, isActive, sessionId }: TabProps) {
  const { setActiveTab, removeTab } = useTabStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Kill PTY session
    try {
      await invoke('pty_kill', { sessionId });
    } catch (err) {
      console.error('Failed to kill PTY session:', err);
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
          sessionId={sessionId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
