import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';
import type { Tab } from '@/types/tab';
import { useSettingsStore } from '@/store/settingsStore';
import { platform } from '@tauri-apps/plugin-os';

export type PluginId = 'ratel';

export interface PluginDefinition {
  id: PluginId;
  name: string;
  description: string;
  thumbnailSrc: string;
  open: () => Promise<Tab>;
  supportedPlatforms?: string[]; // Optional: if not specified, plugin is available on all platforms
}

const allPlugins: PluginDefinition[] = [
  {
    id: 'ratel',
    name: 'Ratel',
    description: 'Connect to a Ratel server.',
    thumbnailSrc: '/hamham-poker.png',
    supportedPlatforms: ['linux', 'macos'], // Unix-only
    open: async () => {
      const { ratelHost, ratelPort } = useSettingsStore.getState().settings;

      const sessionId = await invoke<string>('create_ratel_session', {
        host: ratelHost,
        port: ratelPort,
        cols: 80,
        rows: 24,
      });

      return {
        id: uuidv4(),
        title: `Ratel: ${ratelHost}:${ratelPort}`,
        sessionId,
        type: 'plugin',
      };
    },
  },
];

// Filter plugins based on current platform
const currentPlatform = platform();
export const plugins: PluginDefinition[] = allPlugins.filter(plugin => {
  if (!plugin.supportedPlatforms) {
    return true; // Available on all platforms
  }
  return plugin.supportedPlatforms.includes(currentPlatform);
});
