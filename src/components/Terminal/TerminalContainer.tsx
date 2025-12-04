import { useState, useEffect } from 'react';
import { Terminal } from './Terminal';
import { useTabStore } from '@/store/tabStore';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';

export function TerminalContainer() {
  const { tabs, activeTabId } = useTabStore();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await invoke<boolean>('is_maximized');
      setIsMaximized(maximized);
    };

    checkMaximized();

    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onResized(() => {
      checkMaximized();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-100">No Terminal Open</h2>
          <p className="text-gray-400 mb-6">
            Click the + button in the title bar to create a new terminal
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 relative overflow-hidden ${isMaximized ? '' : 'rounded-b-lg'}`}>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className="w-full h-full"
          style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
        >
          <Terminal sessionId={tab.sessionId} isActive={tab.id === activeTabId} />
        </div>
      ))}
    </div>
  );
}
