import { Plus } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '@/store/tabStore';
import { v4 as uuidv4 } from 'uuid';

export function NewTabButton() {
  const { addTab } = useTabStore();

  const handleNewTab = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const tabId = uuidv4();

      // Create PTY session
      const sessionId = await invoke<string>('create_pty_session', {
        shell: null,
        cwd: null,
        cols: 80,
        rows: 24,
      });

      // Add tab to store
      addTab({
        id: tabId,
        title: 'Terminal',
        sessionId,
        type: 'local',
      });
    } catch (err) {
      console.error('Failed to create terminal:', err);
      alert('Failed to create terminal: ' + err);
    }
  };

  return (
    <button
      onClick={handleNewTab}
      className="px-3 h-8 flex items-center justify-center hover:bg-gray-700 rounded transition-colors"
      aria-label="New tab"
      type="button"
    >
      <Plus size={16} className="text-gray-300" />
    </button>
  );
}
