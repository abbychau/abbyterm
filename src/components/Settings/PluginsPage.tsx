import { plugins } from '@/plugins/registry';
import type { Tab } from '@/types/tab';

interface PluginsPageProps {
  onOpenTab: (tab: Tab) => void;
}

export function PluginsPage({ onOpenTab }: PluginsPageProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Plugins</h3>
        <p className="text-xs app-text-muted mt-1">
          Quick-connect tools that open in a new tab.
        </p>
      </div>

      <div className="grid gap-3">
        {plugins.map((plugin) => (
          <div
            key={plugin.id}
            className="border app-border app-surface p-3 flex gap-3 items-center"
          >
            <img
              src={plugin.thumbnailSrc}
              alt=""
              className="w-[150px] rounded-md object-cover flex-shrink-0"
              draggable={false}
            />

            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{plugin.name}</div>
              <div className="text-xs app-text-muted truncate mt-0.5">{plugin.description}</div>
            </div>

            <button
              onClick={() => {
                void plugin.open().then(onOpenTab);
              }}
              className="px-3 py-1.5 bg-[color:var(--app-accent)] text-[color:var(--app-on-accent)] hover:opacity-90 transition-colors"
            >
              Open
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
