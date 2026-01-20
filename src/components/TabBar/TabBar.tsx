import { Tab } from './Tab';
import { useTabStore } from '@/store/tabStore';

export function TabBar() {
  const { tabs, activeTabId } = useTabStore();

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="h-9 app-surface border-b app-border flex overflow-x-auto scrollbar-thin">
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          id={tab.id}
          title={tab.title}
          isActive={tab.id === activeTabId}
          sessionId={tab.sessionId}
        />
      ))}
    </div>
  );
}
