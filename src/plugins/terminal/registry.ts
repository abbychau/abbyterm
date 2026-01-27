import type { TerminalPluginDefinition, TerminalPluginId } from './types';
import { particlesPlugin } from './particles';

export const terminalPlugins: TerminalPluginDefinition[] = [particlesPlugin];

export const getTerminalPlugin = (id: TerminalPluginId) =>
  terminalPlugins.find((p) => p.id === id) ?? null;
