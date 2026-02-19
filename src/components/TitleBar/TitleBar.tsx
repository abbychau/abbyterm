import { useState, useEffect } from 'react';
import { WindowControls } from './WindowControls';
import { MenuButton } from './MenuButton';
import { NewTabButton } from './NewTabButton';
import { DockerButton } from './DockerButton';
import { K8sButton } from './K8sButton';
import { SessionButton } from './SessionButton';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '@/store/tabStore';
import { useSettingsStore } from '@/store/settingsStore';

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const settings = useSettingsStore((state) => state.settings);
  const activeTabTitle = useTabStore((state) => 
    state.tabs.find((t) => t.id === state.activeTabId)?.title
  );

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


  const handleDoubleClick = async () => {
    
    const maximized = await invoke<boolean>('is_maximized'); // ensure we have the latest state
    setIsMaximized(maximized);
  };

  return (
    <div className={`h-10 app-surface border-b app-border flex items-center justify-between select-none `}>
      {/* Left section - Title */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 px-1 select-none max-w-md"
        onDoubleClick={handleDoubleClick}
      >
        <img src="/hamham.png" alt="Icon" className="w-8 h-8 pointer-events-none m-1 flex-shrink-0" />
        <span className="text-sm font-semibold app-text -ml-2 pointer-events-none line-clamp-2 overflow-hidden break-words">{activeTabTitle || 'AbbyTerm'}</span>
      </div>

      {/* Middle spacer - DRAGGABLE with JS handler */}
      <div
        className="flex-1 h-full"
        data-tauri-drag-region
        onDoubleClick={handleDoubleClick}
      />

      {/* Right section - Buttons (not draggable) */}
      <div className="flex items-center gap-1">
        <NewTabButton />
        <SessionButton />
        {settings.showDockerButton && <DockerButton />}
        {settings.showKubectlButton && <K8sButton />}
        <MenuButton />
      </div>
      <div className="h-6 border-l app-border mx-2" />
      <WindowControls />
    </div>
  );
}
