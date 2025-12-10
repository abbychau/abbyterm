import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, Copy } from 'lucide-react';

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    // Check initial state
    invoke<boolean>('is_maximized').then(setIsMaximized);

    // Listen for window resize events
    const unlisten = appWindow.onResized(() => {
        invoke<boolean>('is_maximized').then(setIsMaximized);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = () => invoke('window_minimize');

  const handleMaximize = async () => {
    if (isMaximized) {
      await invoke('window_unmaximize');
      setIsMaximized(false);
    } else {
      await invoke('window_maximize');
      setIsMaximized(true);
    }
  };

  const handleClose = () => invoke('window_close');

  return (
    <div className="flex">
      <button
        onClick={handleMinimize}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-12 h-10 flex items-center justify-center hover:bg-gray-700 transition-colors"
        aria-label="Minimize"
      >
        <Minus size={16} className="text-gray-300" />
      </button>
      <button
        onClick={handleMaximize}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-12 h-10 flex items-center justify-center hover:bg-gray-700 transition-colors"
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
      >
        {isMaximized ? (
          <Copy size={14} className="text-gray-300" />
        ) : (
          <Square size={14} className="text-gray-300" />
        )}
      </button>
      <button
        onClick={handleClose}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-12 h-10 flex items-center justify-center hover:bg-red-600 transition-colors"
        aria-label="Close"
      >
        <X size={16} className="text-gray-300" />
      </button>
    </div>
  );
}
