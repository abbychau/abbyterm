import { useState, useEffect } from 'react';
import { WindowControls } from './WindowControls';
import { MenuButton } from './MenuButton';
import { NewTabButton } from './NewTabButton';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';

export function TitleBar() {
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
    <div className={`h-10 bg-gray-900 border-b border-gray-800 flex items-center justify-between select-none ${isMaximized ? '' : 'rounded-t-lg'}`}>
      {/* Left section - Title */}
      <div 
        data-tauri-drag-region 
        className="flex items-center gap-2 px-1 select-none"
        onDoubleClick={handleDoubleClick}
      >
        <img src="/hamham.png" alt="Icon" className="w-8 h-8 pointer-events-none" />
        <span className="text-sm font-semibold text-gray-200 -ml-2 pointer-events-none">AbbyTerm</span>
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
        <MenuButton />
      </div>

      <WindowControls />
    </div>
  );
}
