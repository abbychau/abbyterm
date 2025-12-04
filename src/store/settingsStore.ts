import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Settings, SettingsStore, Theme, defaultThemes } from '@/types/settings';

const defaultSettings: Settings = {
  theme: defaultThemes['Dark+'],
  fontSize: 14,
  fontFamily: 'JetBrains Mono, Fira Code, Menlo, Monaco, "Courier New", monospace',
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 10000,
  shell: '/bin/bash',
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
    }
  )
);
