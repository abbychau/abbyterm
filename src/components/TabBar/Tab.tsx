import { X } from 'lucide-react';
import { useTabStore } from '@/store/tabStore';
import { invoke } from '@tauri-apps/api/core';

interface TabProps {
  id: string;
  title: string;
  isActive: boolean;
  sessionId: string;
}

export function Tab({ id, title, isActive, sessionId }: TabProps) {
  const { setActiveTab, removeTab } = useTabStore();

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

  return (
    <div
      className={`
        h-9 px-3 flex items-center gap-2 cursor-pointer border-r border-gray-800 min-w-[120px] max-w-[200px]
        ${
          isActive
            ? 'bg-gray-800 text-gray-100'
            : 'bg-gray-900 text-gray-400 hover:bg-gray-850'
        }
      `}
      onClick={() => setActiveTab(id)}
    >
      <span className="text-sm truncate flex-1">{title}</span>
      <button
        onClick={handleClose}
        className="hover:bg-gray-700 rounded p-0.5 transition-colors flex-shrink-0"
        aria-label="Close tab"
      >
        <X size={14} />
      </button>
    </div>
  );
}
