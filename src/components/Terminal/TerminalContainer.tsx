import { Terminal } from './Terminal';
import { useTabStore } from '@/store/tabStore';

export function TerminalContainer() {
  const { tabs, activeTabId } = useTabStore();

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-100">No Terminal Open</h2>
          <p className="text-gray-400 mb-6">
            Click the + button in the title bar to create a new terminal
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className="w-full h-full"
          style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
        >
          <Terminal sessionId={tab.sessionId} isActive={tab.id === activeTabId} />
        </div>
      ))}
    </div>
  );
}
