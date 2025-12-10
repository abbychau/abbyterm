import { useState, useEffect, useRef } from 'react';
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
      <div className="flex-1 flex items-center justify-center p-8 select-none">
        <div className="flex flex-col items-center gap-6 opacity-30 hover:opacity-50 transition-opacity duration-700">
          <img 
            src="/hamham.png" 
            alt="No Terminal" 
            className="w-80 h-80 object-contain grayscale brightness-75 pointer-events-none" 
          />
          <h2 className="font-mono text-sm tracking-[0.5em] text-gray-400 uppercase">
            No Terminal Open
          </h2>
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
