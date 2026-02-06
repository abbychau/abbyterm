export type Uuid = string;

export type SplitDirection = 'horizontal' | 'vertical';

// Snapshot types for session persistence
export interface TerminalPaneSnapshot {
  type: 'terminal';
  id: string;
  title: string;
  tab_type: 'local' | 'ssh' | 'plugin';
  cwd: string; // Current working directory
  session_id?: string; // Optional - will be recreated when loading
}

export interface SplitPaneSnapshot {
  type: 'split';
  id: string;
  direction: SplitDirection;
  children: PaneSnapshot[];
  sizes?: number[];
}

export type PaneSnapshot = TerminalPaneSnapshot | SplitPaneSnapshot;

export interface TabSnapshot {
  id: string;
  title: string;
  type_: 'local' | 'ssh' | 'plugin';
  session_id: string; // Primary sessionId
  root_pane: PaneSnapshot;
}

export interface SessionSnapshot {
  name: string;
  created_at: string;
  tabs: TabSnapshot[];
}

export interface TerminalPane {
  type: 'terminal';
  id: string;
  sessionId: string;
  title: string;
  tabType: 'local' | 'ssh' | 'plugin';
}

export interface SplitPane {
  type: 'split';
  id: string;
  direction: SplitDirection;
  children: Pane[];
  sizes?: number[]; // Optional sizes for the split (e.g., [0.5, 0.5] for equal split)
}

export type Pane = TerminalPane | SplitPane;

export interface Tab {
  id: string;
  title: string;
  sessionId: string; // Primary sessionId for backward compatibility
  type: 'local' | 'ssh' | 'plugin'; // Type for backward compatibility
  rootPane: Pane;
}

export interface TabStore {
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  splitPane: (tabId: string, paneId: string, direction: SplitDirection) => void;
  closePane: (tabId: string, paneId: string) => void;
}
