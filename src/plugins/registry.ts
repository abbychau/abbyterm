import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';
import type { Tab } from '@/types/tab';

export type PluginId = 'ratel';

export interface PluginDefinition {
  id: PluginId;
  name: string;
  description: string;
  thumbnailSrc: string;
  open: () => Promise<Tab>;
}

const RATEL_HOST = '192.252.182.94';
const RATEL_PORT = 9999;

export const plugins: PluginDefinition[] = [
  {
    id: 'ratel',
    name: 'Ratel',
    description: `Connects to ${RATEL_HOST}:${RATEL_PORT}`,
    thumbnailSrc: '/hamham-poker.png',
    open: async () => {
      const sessionId = await invoke<string>('create_ratel_session', {
        host: RATEL_HOST,
        port: RATEL_PORT,
        cols: 80,
        rows: 24,
      });

      return {
        id: uuidv4(),
        title: `Ratel: ${RATEL_HOST}:${RATEL_PORT}`,
        sessionId,
        type: 'plugin',
      };
    },
  },
];
