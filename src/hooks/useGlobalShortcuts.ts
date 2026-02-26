import { useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { useTabStore } from '@/store/tabStore';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';

export function useGlobalShortcuts() {
  const { settings, updateSettings } = useSettingsStore();
  const { addTab, removeTab, activeTabId, tabs, setActiveTab } = useTabStore();

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if input or textarea is focused (except for xterm)
      if (
        (document.activeElement instanceof HTMLInputElement ||
         document.activeElement instanceof HTMLTextAreaElement) &&
        !document.activeElement.classList.contains('xterm-helper-textarea')
      ) {
        return;
      }

      const modifiers = [];
      if (e.ctrlKey) modifiers.push('Ctrl');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.altKey) modifiers.push('Alt');
      if (e.metaKey) modifiers.push('Meta');

      let key = e.key;
      if (key === ' ') key = 'Space';
      if (key.length === 1) key = key.toUpperCase();
      
      const currentShortcut = [...modifiers, key].join('+');
      const { shortcuts } = settings;

      if (currentShortcut === shortcuts.toggleFullscreen) {
        e.preventDefault();
        const win = getCurrentWindow();
        const isFullscreen = await win.isFullscreen();
        win.setFullscreen(!isFullscreen);
      } else if (currentShortcut === shortcuts.zoomIn) {
        e.preventDefault();
        updateSettings({ fontSize: Math.min(settings.fontSize + 1, 48) });
      } else if (currentShortcut === shortcuts.zoomOut) {
        e.preventDefault();
        updateSettings({ fontSize: Math.max(settings.fontSize - 1, 6) });
      } else if (currentShortcut === shortcuts.zoomReset) {
        e.preventDefault();
        updateSettings({ fontSize: 14 });
      } else if (currentShortcut === shortcuts.newTab) {
        e.preventDefault();
        try {
          const tabId = uuidv4();
          const sessionId = await invoke<string>('create_pty_session', {
            shell: null,
            args: null,
            cwd: settings.defaultCwd || null,
            cols: 80,
            rows: 24,
          });
          addTab({
            id: tabId,
            title: 'Local',
            sessionId,
            type: 'local',
            rootPane: {
              type: 'terminal',
              id: tabId,
              sessionId,
              title: 'Local',
              tabType: 'local',
            },
          });
        } catch (err) {
          console.error('Failed to create terminal via shortcut:', err);
        }
      } else if (currentShortcut === shortcuts.closeTab) {
        e.preventDefault();
        if (activeTabId) {
          const activeTab = tabs.find((t) => t.id === activeTabId);

          // Keep behavior consistent with clicking the tab's close button:
          // kill the underlying PTY session first.
          if (activeTab?.sessionId) {
            try {
              await invoke('pty_kill', { sessionId: activeTab.sessionId });
            } catch (err) {
              console.error('Failed to kill PTY session (closeTab shortcut):', err);
            }
          }

          removeTab(activeTabId);
        }
      } else if (currentShortcut === shortcuts.nextTab) {
        e.preventDefault();
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        if (currentIndex !== -1 && tabs.length > 1) {
          const nextIndex = (currentIndex + 1) % tabs.length;
          setActiveTab(tabs[nextIndex].id);
        }
      } else if (currentShortcut === shortcuts.prevTab) {
        e.preventDefault();
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        if (currentIndex !== -1 && tabs.length > 1) {
          const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          setActiveTab(tabs[prevIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings, activeTabId, tabs, addTab, removeTab, setActiveTab, updateSettings]);
}
