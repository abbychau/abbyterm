import { plugins } from '@/plugins/registry';
import { terminalPlugins } from '@/plugins/terminal/registry';
import { useSettingsStore } from '@/store/settingsStore';
import type { Tab } from '@/types/tab';

interface PluginsPageProps {
  onOpenTab: (tab: Tab) => void;
}

export function PluginsPage({ onOpenTab }: PluginsPageProps) {
  const { settings, updateSettings } = useSettingsStore();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Plugins</h3>
        <p className="text-xs app-text-muted mt-1">
          Quick-connect tools and terminal effects.
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">Terminal effects</div>
        <div className="grid gap-2">
          {terminalPlugins.map((plugin) => {
            const enabled = (settings.terminalPlugins?.[plugin.id] ?? plugin.defaultEnabled) === true;

            return (
              <div
                key={plugin.id}
                className="border app-border app-surface p-3 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{plugin.name}</div>
                  <div className="text-xs app-text-muted truncate mt-0.5">{plugin.description}</div>
                </div>

                <button
                  onClick={() => {
                    updateSettings({
                      terminalPlugins: {
                        ...(settings.terminalPlugins ?? {}),
                        [plugin.id]: !enabled,
                      },
                    });
                  }}
                  className={`relative w-12 h-6 transition-colors flex-shrink-0 ${
                    enabled ? 'bg-[color:var(--app-accent)]' : 'bg-[color:var(--app-border)]'
                  }`}
                  title={enabled ? 'Disable' : 'Enable'}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-[color:var(--app-surface)] shadow-sm transition-transform ${
                      enabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            );
          })}

          {terminalPlugins.length === 0 && (
            <div className="text-xs app-text-muted">No terminal plugins available.</div>
          )}
        </div>
      </div>

      <div className="pt-2 border-t app-border opacity-60" />

      <div className="text-sm font-medium">Quick-connect</div>

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
              <div className="text-xs app-text-muted truncate mt-0.5">
                {plugin.id === 'ratel'
                  ? `${settings.ratelHost}:${settings.ratelPort}`
                  : plugin.description}
              </div>

              {plugin.id === 'ratel' && (
                <div className="mt-2 flex gap-2 items-center">
                  <input
                    value={settings.ratelHost}
                    onChange={(e) => updateSettings({ ratelHost: e.target.value })}
                    placeholder="Host"
                    className="w-56 px-2 py-1 app-surface border app-border focus:border-[color:var(--app-accent)] focus:outline-none text-xs"
                  />
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={settings.ratelPort}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (Number.isFinite(n) && n >= 1 && n <= 65535) {
                        updateSettings({ ratelPort: n });
                      }
                    }}
                    placeholder="Port"
                    className="w-24 px-2 py-1 app-surface border app-border focus:border-[color:var(--app-accent)] focus:outline-none text-xs"
                  />
                </div>
              )}
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
