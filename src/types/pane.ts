import { Uuid } from './tab';

export type SplitDirection = 'horizontal' | 'vertical';

export interface PaneNode {
  id: string;
  type: 'terminal' | 'split';
}

export interface TerminalPane extends PaneNode {
  type: 'terminal';
  sessionId: Uuid;
}

export interface SplitPane extends PaneNode {
  type: 'split';
  direction: SplitDirection;
  children: [PaneNode, PaneNode];
  ratio: number; // 0-1, split position
}

export type Pane = TerminalPane | SplitPane;
