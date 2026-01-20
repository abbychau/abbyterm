import { useState, useEffect } from 'react';
import { WindowControls } from './WindowControls';
import { MenuButton } from './MenuButton';
import { NewTabButton } from './NewTabButton';
import { DockerButton } from './DockerButton';
import { K8sButton } from './K8sButton';
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
    if (isMaximized) {
      await invoke('window_unmaximize');
      setIsMaximized(false);
    } else {
      await invoke('window_maximize');
      setIsMaximized(true);
    }
  };

  return (
    <div className={`h-10 app-surface border-b app-border flex items-center justify-between select-none `}>
      {/* Left section - Title */}
      <div 
        data-tauri-drag-region 
        className="flex items-center gap-2 px-1 select-none"
        onDoubleClick={handleDoubleClick}
      >
        <img src="/hamham.png" alt="Icon" className="w-8 h-8 pointer-events-none m-1" />
        <span className="text-sm font-semibold app-text -ml-2 pointer-events-none">{activeTabTitle || 'AbbyTerm'}</span>
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
        {settings.showDockerButton && <DockerButton />}
        {settings.showKubectlButton && <K8sButton />}
        <MenuButton />
      </div>
      <div className="w-px h-4 mx-1 app-border" />
      <WindowControls />
    </div>
  );
}
