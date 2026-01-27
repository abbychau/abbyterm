import type { Terminal as XTerm } from 'xterm';

export type TerminalPluginId = 'particles';

export interface TerminalPluginContext {
  sessionId: string;
  term: XTerm;
  container: HTMLDivElement;
  getThemeColors: () => string[];
}

export interface TerminalPluginInstance {
  dispose: () => void;
}

export interface TerminalPluginDefinition {
  id: TerminalPluginId;
  name: string;
  description: string;
  defaultEnabled: boolean;
  activate: (ctx: TerminalPluginContext) => TerminalPluginInstance;
}
