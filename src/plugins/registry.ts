import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';
import type { Tab, TerminalPane } from '@/types/tab';
import { useSettingsStore } from '@/store/settingsStore';

export type PluginId = 'ratel';

export interface PluginDefinition {
  id: PluginId;
  name: string;
  description: string;
  thumbnailSrc: string;
  open: () => Promise<Tab>;
}

export const plugins: PluginDefinition[] = [
  {
    id: 'ratel',
    name: 'Ratel',
    description: 'Connect to a Ratel server.',
    thumbnailSrc: '/hamham-poker.png',
    open: async () => {
      const { ratelHost, ratelPort } = useSettingsStore.getState().settings;

      const sessionId = await invoke<string>('create_ratel_session', {
        host: ratelHost,
        port: ratelPort,
        cols: 80,
        rows: 24,
      });

      const terminalPane: TerminalPane = {
        type: 'terminal',
        id: uuidv4(),
        sessionId,
        title: `Ratel: ${ratelHost}:${ratelPort}`,
        tabType: 'plugin',
      };

      return {
        id: uuidv4(),
        title: `Ratel: ${ratelHost}:${ratelPort}`,
        sessionId,
        type: 'plugin',
        rootPane: terminalPane,
      };
    },
  },
];
