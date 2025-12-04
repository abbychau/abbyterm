export interface Tab {
  id: string;
  title: string;
  sessionId: string;
  type: 'local' | 'ssh';
}

export interface TabStore {
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
}
