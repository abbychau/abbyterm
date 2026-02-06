import { create } from 'zustand';
import { Tab, TabStore, SplitDirection, Pane } from '@/types/tab';
import { v4 as uuidv4 } from 'uuid';

const _useTabStore = create<TabStore>((set, get) => ({
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

  splitPane: (tabId: string, paneId: string, direction: SplitDirection) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    let newPaneId: string | null = null;

    // Helper function to find and replace a pane in the tree
    const findAndReplacePane = (pane: any): any => {
      if (pane.type === 'terminal' && pane.id === paneId) {
        // Create a new terminal pane
        const newTerminalPane: any = {
          type: 'terminal',
          id: uuidv4(),
          sessionId: '', // Will be filled after PTY session creation
          title: pane.title,
          tabType: pane.tabType,
        };
        newPaneId = newTerminalPane.id;

        const newSplitPane: any = {
          type: 'split',
          id: uuidv4(),
          direction,
          children: [
            pane, // Keep the original pane
            newTerminalPane, // Add the new pane
          ],
          sizes: [0.5, 0.5], // Equal split by default
        };
        return newSplitPane;
      } else if (pane.type === 'split') {
        return {
          ...pane,
          children: pane.children.map((child: Pane) => findAndReplacePane(child)),
        };
      }
      return pane;
    };

    const updatedTab = {
      ...tab,
      rootPane: findAndReplacePane(tab.rootPane),
    };

    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? updatedTab : t)),
    }));

    return newPaneId;
  },

  closePane: (tabId: string, paneId: string) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    // Helper function to remove a pane from the tree
    const removePane = (pane: any): any | null => {
      if (pane.type === 'terminal' && pane.id === paneId) {
        return null; // Signal to remove this pane
      } else if (pane.type === 'split') {
        const newChildren = pane.children
          .map((child: Pane) => removePane(child))
          .filter((child: Pane | null): child is Pane => child !== null);

        // If no children left, return null
        if (newChildren.length === 0) {
          return null;
        }
        // If only one child left, return that child (flatten)
        if (newChildren.length === 1) {
          return newChildren[0];
        }
        // Otherwise, return the split with updated children
        return {
          ...pane,
          children: newChildren,
        };
      }
      return pane;
    };

    const updatedRootPane = removePane(tab.rootPane);

    if (!updatedRootPane) {
      // If removing the last pane, remove the entire tab
      get().removeTab(tabId);
      return;
    }

    const updatedTab = {
      ...tab,
      rootPane: updatedRootPane,
    };

    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? updatedTab : t)),
    }));
  },
}));

// Export as hook for React components - this IS the store, not a function
// You can use it as: useTabStore((state) => state.something) for selectors
// Or: useTabStore.getState().something for direct access
export const useTabStore = _useTabStore;

// Non-hook version with explicit type for use outside React components
export const tabStore = _useTabStore;
