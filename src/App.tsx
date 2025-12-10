import { useState, useEffect, useRef } from 'react';
import { TitleBar } from './components/TitleBar/TitleBar';
import { TabBar } from './components/TabBar/TabBar';
import { TerminalContainer } from './components/Terminal/TerminalContainer';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useTabStore } from './store/tabStore';
import { v4 as uuidv4 } from 'uuid';

function App() {
  const [isMaximized, setIsMaximized] = useState(false);
  const addTab = useTabStore((state) => state.addTab);
  const activeTabTitle = useTabStore((state) => 
    state.tabs.find((t) => t.id === state.activeTabId)?.title
  );
  const initialized = useRef(false);
  useGlobalShortcuts();

  useEffect(() => {
    const updateTitle = async () => {
      const appWindow = getCurrentWindow();
      await appWindow.setTitle(activeTabTitle || 'AbbyTerm');
    };
    updateTitle();
  }, [activeTabTitle]);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      if (initialized.current) return;
      initialized.current = true;

      try {
        const args = await invoke<string[] | null>('get_initial_args');
        
        let shell: string | undefined;
        let shellArgs: string[] | undefined;

        if (args && args.length > 0) {
            if (args.length === 1 && args[0].includes(' ')) {
                const parts = args[0].split(' ');
                shell = parts[0];
                shellArgs = parts.slice(1);
            } else {
                shell = args[0];
                if (args.length > 1) {
                    shellArgs = args.slice(1);
                }
            }
        }

        const sessionId = await invoke<string>('create_pty_session', {
          shell: shell || null,
          args: shellArgs || null,
          cwd: null,
          cols: 80,
          rows: 24,
        });

        addTab({
          id: uuidv4(),
          title: shell || 'Terminal',
          sessionId,
          type: 'local',
        });
      } catch (error) {
        console.error('Failed to initialize terminal:', error);
      }
    };

    init();

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
    <div className={`h-screen flex items-center justify-center`}>
      <div className={`h-full w-full bg-gray-900 text-white flex flex-col overflow-hidden`}>
        <TitleBar />
        <TabBar />
        <TerminalContainer />
      </div>
    </div>
  );
}

export default App;
