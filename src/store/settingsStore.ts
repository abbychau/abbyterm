import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Settings, SettingsStore, Theme, defaultThemes, Shortcuts } from '@/types/settings';
import { terminalPlugins } from '@/plugins/terminal/registry';

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
  appTheme: defaultThemes['Dark+'],
  syncAppThemeWithTerminal: true,
  fontSize: 14,
  fontFamily: 'JetBrains Mono, Fira Code, Menlo, Monaco, "Courier New", monospace',
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 10000,
  shell: '/bin/bash',
  defaultCwd: '~',
  useWebGL: false,
  showDockerButton: true,
  showKubectlButton: true,
  dockerExecutablePath: '',
  kubectlExecutablePath: '',
  shortcuts: defaultShortcuts,
  ratelHost: '192.252.182.94',
  ratelPort: 9999,
  terminalPlugins: Object.fromEntries(terminalPlugins.map((p) => [p.id, p.defaultEnabled])),
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

      setAppTheme: (appTheme: Theme) =>
        set((state) => ({
          settings: { ...state.settings, appTheme },
        })),
    }),
    {
      name: 'abbyterm-settings',
      merge: (persistedState: any, currentState) => {
        // Deep merge settings to ensure new fields (like shortcuts, defaultCwd) are added
        // to existing persisted state
        const mergedSettings = {
          ...defaultSettings,
          ...(persistedState?.settings || {}),
          // Ensure appTheme exists even for existing users
          appTheme: persistedState?.settings?.appTheme || defaultSettings.appTheme,
          syncAppThemeWithTerminal:
            typeof persistedState?.settings?.syncAppThemeWithTerminal === 'boolean'
              ? persistedState.settings.syncAppThemeWithTerminal
              : defaultSettings.syncAppThemeWithTerminal,
          shortcuts: {
            ...defaultSettings.shortcuts,
            ...(persistedState?.settings?.shortcuts || {}),
          },
          // Ensure defaultCwd is set even for existing users
          defaultCwd: persistedState?.settings?.defaultCwd || defaultSettings.defaultCwd,

          // Ensure Ratel connection defaults exist
          ratelHost: persistedState?.settings?.ratelHost || defaultSettings.ratelHost,
          ratelPort:
            typeof persistedState?.settings?.ratelPort === 'number'
              ? persistedState.settings.ratelPort
              : defaultSettings.ratelPort,

          // Ensure terminalPlugins exists and new plugins get defaults
          terminalPlugins: {
            ...defaultSettings.terminalPlugins,
            ...(persistedState?.settings?.terminalPlugins || {}),
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
