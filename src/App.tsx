import { useState, useEffect } from 'react';
import { TitleBar } from './components/TitleBar/TitleBar';
import { TabBar } from './components/TabBar/TabBar';
import { TerminalContainer } from './components/Terminal/TerminalContainer';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';

function App() {
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

  return (
    <div className={`h-screen flex items-center justify-center ${isMaximized ? '' : 'p-2'}`}>
      <div className={`h-full w-full bg-gray-900 text-white flex flex-col overflow-hidden ${isMaximized ? '' : 'rounded-lg shadow-2xl border border-gray-800'}`}>
        <TitleBar />
        <TabBar />
        <TerminalContainer />
      </div>
    </div>
  );
}

export default App;
