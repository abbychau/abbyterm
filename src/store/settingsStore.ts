import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Settings, SettingsStore, Theme, defaultThemes, Shortcuts } from '@/types/settings';

export const defaultShortcuts: Shortcuts = {
  copy: 'Ctrl+Shift+C',
  paste: 'Ctrl+Shift+V',
  toggleFullscreen: 'F11',
  zoomIn: 'Ctrl+=',
  zoomOut: 'Ctrl+-',
  zoomReset: 'Ctrl+0',
  newTab: 'Ctrl+T',
  closeTab: 'Ctrl+W',
  nextTab: 'Ctrl+Tab',
  prevTab: 'Ctrl+Shift+Tab',
  find: 'Ctrl+F',
};

const defaultSettings: Settings = {
  theme: defaultThemes['Dark+'],
  fontSize: 14,
  fontFamily: 'JetBrains Mono, Fira Code, Menlo, Monaco, "Courier New", monospace',
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 10000,
  shell: '/bin/bash',
  useWebGL: false,
  shortcuts: defaultShortcuts,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,

      updateSettings: (updates: Partial<Settings>) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),

      setTheme: (theme: Theme) =>
        set((state) => ({
          settings: { ...state.settings, theme },
        })),
    }),
    {
      name: 'abbyterm-settings',
      merge: (persistedState: any, currentState) => {
        // Deep merge settings to ensure new fields (like shortcuts) are added
        // to existing persisted state
        const mergedSettings = {
          ...defaultSettings,
          ...(persistedState?.settings || {}),
          shortcuts: {
            ...defaultSettings.shortcuts,
            ...(persistedState?.settings?.shortcuts || {}),
          },
        };

        return {
          ...currentState,
          ...persistedState,
          settings: mergedSettings,
        };
      },
    }
  )
);
