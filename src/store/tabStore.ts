import { create } from 'zustand';
import { Tab, TabStore } from '@/types/tab';

export const useTabStore = create<TabStore>((set) => ({
  tabs: [],
  activeTabId: null,

  addTab: (tab: Tab) =>
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    })),

  removeTab: (id: string) =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== id);
      let newActiveId = state.activeTabId;

      // If we're removing the active tab, switch to another tab
      if (state.activeTabId === id) {
        if (newTabs.length > 0) {
          // Find the index of the removed tab
          const removedIndex = state.tabs.findIndex((t) => t.id === id);
          // Try to activate the next tab, or the previous one if this was the last tab
          newActiveId =
            newTabs[Math.min(removedIndex, newTabs.length - 1)]?.id || null;
        } else {
          newActiveId = null;
        }
      }

      return {
        tabs: newTabs,
        activeTabId: newActiveId,
      };
    }),

  setActiveTab: (id: string) => set({ activeTabId: id }),

  updateTab: (id: string, updates: Partial<Tab>) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
}));
