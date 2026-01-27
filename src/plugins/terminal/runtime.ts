import type { Settings } from '@/types/settings';
import type { TerminalPluginContext, TerminalPluginInstance } from './types';
import { terminalPlugins } from './registry';

export const getEnabledTerminalPluginIds = (settings: Settings) => {
  const enabledMap = settings.terminalPlugins ?? {};
  return terminalPlugins
    .filter((p) => enabledMap[p.id] ?? p.defaultEnabled)
    .map((p) => p.id);
};

export const activateEnabledTerminalPlugins = (ctx: TerminalPluginContext, settings: Settings) => {
  const enabledMap = settings.terminalPlugins ?? {};

  const instances: TerminalPluginInstance[] = [];
  for (const plugin of terminalPlugins) {
    const enabled = enabledMap[plugin.id] ?? plugin.defaultEnabled;
    if (!enabled) continue;

    try {
      instances.push(plugin.activate(ctx));
    } catch (err) {
      console.warn(`[plugin:${plugin.id}] activate failed`, err);
    }
  }

  return {
    dispose: () => {
      for (const inst of instances) {
        try {
          inst.dispose();
        } catch (err) {
          console.warn('[plugin] dispose failed', err);
        }
      }
    },
  };
};
