import { useEffect, useRef } from 'react';
import { TitleBar } from './components/TitleBar/TitleBar';
import { TabBar } from './components/TabBar/TabBar';
import { TerminalContainer } from './components/Terminal/TerminalContainer';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useTabStore } from './store/tabStore';
import { useSettingsStore } from './store/settingsStore';
import { v4 as uuidv4 } from 'uuid';

function App() {
  const addTab = useTabStore((state) => state.addTab);
  const activeTabTitle = useTabStore((state) =>
    state.tabs.find((t) => t.id === state.activeTabId)?.title
  );
  const settings = useSettingsStore((state) => state.settings);
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
        // Auto-hide Kubectl button if kubectl isn't runnable.
        // (Do not gate this behind the button being shown; we want the first-run experience to be correct.)
        try {
          const kubectlOk = await invoke<boolean>('check_kubectl_available', {
            kubectlPath: settings.kubectlExecutablePath || null,
          });
          const current = useSettingsStore.getState().settings;
          if (!kubectlOk && current.showKubectlButton) {
            useSettingsStore.getState().updateSettings({ showKubectlButton: false });
          }
        } catch (e) {
          // If the check itself fails, keep current setting unchanged.
          console.warn('Failed to check kubectl availability:', e);
        }

        // Auto-hide Docker button if docker isn't runnable.
        try {
          const dockerOk = await invoke<boolean>('check_docker_available', {
            dockerPath: settings.dockerExecutablePath || null,
          });
          const current = useSettingsStore.getState().settings;
          if (!dockerOk && current.showDockerButton) {
            useSettingsStore.getState().updateSettings({ showDockerButton: false });
          }
        } catch (e) {
          console.warn('Failed to check docker availability:', e);
        }

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
          cwd: settings.defaultCwd || null,
          cols: 80,
          rows: 24,
        });

        addTab({
          id: uuidv4(),
          title: shell || 'Local',
          sessionId,
          type: 'local',
        });
      } catch (error) {
        console.error('Failed to initialize terminal:', error);
      }
    };

    init();

    return;
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
