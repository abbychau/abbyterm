import { useState, useEffect } from 'react';
import { useSettingsStore, defaultShortcuts } from '@/store/settingsStore';
import { defaultThemes, Shortcuts } from '@/types/settings';
import { invoke } from '@tauri-apps/api/core';
import { ShortcutRecorder } from './ShortcutRecorder';
import { RotateCcw } from 'lucide-react';
import { useTabStore } from '@/store/tabStore';
import { PluginsPage } from './PluginsPage';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSettings, setTheme, setAppTheme } = useSettingsStore();
  const { addTab } = useTabStore();
  const [activeTab, setActiveTab] = useState<'appearance' | 'terminal' | 'shortcuts' | 'advanced' | 'plugins'>('appearance');
  const [availableShells, setAvailableShells] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && activeTab === 'advanced') {
      invoke<string[]>('get_available_shells')
        .then(setAvailableShells)
        .catch(console.error);
    }
  }, [isOpen, activeTab]);

  const updateShortcut = (key: keyof Shortcuts, value: string) => {
    updateSettings({
      shortcuts: {
        ...settings.shortcuts,
        [key]: value,
      },
    });
  };

  const renderShortcutRow = (label: string, id: keyof Shortcuts) => (
    <div className="flex items-center justify-between">
      <span className="app-text text-xs">{label}</span>
      <div className="flex items-center gap-2">
        <ShortcutRecorder
          value={settings.shortcuts[id]}
          onChange={(val) => updateShortcut(id, val)}
        />
        <button
          onClick={() => updateShortcut(id, defaultShortcuts[id])}
          className={`p-1 transition-colors ${
            settings.shortcuts[id] !== defaultShortcuts[id]
              ? 'app-text-muted hover:text-[color:var(--app-text)] app-hover opacity-100'
              : 'text-transparent opacity-0 pointer-events-none'
          }`}
          title="Reset to default"
        >
          <RotateCcw size={12} />
        </button>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="app-surface-2 app-text border app-border shadow-2xl w-full max-w-[1024px] h-full max-h-[768px] flex flex-col text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b app-border">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="app-text-muted hover:text-[color:var(--app-text)] transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Tab Bar - Sidebar */}
          <div className="flex flex-col w-36 border-r app-border app-surface">
            {[
              { id: 'appearance', label: 'Appearance' },
              { id: 'terminal', label: 'Terminal' },
              { id: 'shortcuts', label: 'Shortcuts' },
              { id: 'plugins', label: 'Plugins' },
              { id: 'advanced', label: 'Advanced' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 text-left font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'app-surface-2 app-text border-l-2'
                    : 'app-text-muted hover:text-[color:var(--app-text)] app-hover'
                }`}
                style={activeTab === tab.id ? { borderLeftColor: 'var(--app-accent)' } : undefined}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">Terminal Theme</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(defaultThemes).map(([name, theme]) => (
                      <button
                        key={name}
                        onClick={() => setTheme(theme)}
                        className={`p-2 border-2 transition-all text-left ${
                          settings.theme.name === name
                            ? 'border-[color:var(--app-accent)] bg-[color:var(--app-hover-2)]'
                            : 'app-border hover:border-[color:var(--app-text-muted)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-10 h-10 grid grid-cols-4 grid-rows-2 gap-0.5 p-0.5"
                            style={{ backgroundColor: theme.colors.background }}
                          >
                            {[
                              theme.colors.red,
                              theme.colors.green,
                              theme.colors.yellow,
                              theme.colors.blue,
                              theme.colors.magenta,
                              theme.colors.cyan,
                              theme.colors.white,
                              theme.colors.brightBlack,
                            ].map((color, i) => (
                              <div
                                key={i}
                                className=""
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <span className="font-medium text-xs">{name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-1 border-t app-border opacity-60" />

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-medium">Use same theme as terminal</label>
                      <p className="text-[11px] app-text-muted mt-0.5">When enabled, title bar, tabs, menus, and dialogs follow the terminal theme.</p>
                    </div>
                    <button
                      onClick={() => updateSettings({ syncAppThemeWithTerminal: !settings.syncAppThemeWithTerminal })}
                      className={`relative w-10 h-5 transition-colors ${
                        settings.syncAppThemeWithTerminal
                          ? 'bg-[color:var(--app-accent)]'
                          : 'bg-[color:var(--app-border)]'
                      }`}
                      title="Use the terminal theme for the app UI"
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 bg-[color:var(--app-surface)] shadow-sm transition-transform ${
                          settings.syncAppThemeWithTerminal ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {!settings.syncAppThemeWithTerminal && (
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Choose a different app theme</label>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(defaultThemes).map(([name, theme]) => (
                          <button
                            key={name}
                            onClick={() => setAppTheme(theme)}
                            className={`p-2 border-2 transition-all text-left ${
                              settings.appTheme.name === name
                                ? 'border-[color:var(--app-accent)] bg-[color:var(--app-hover-2)]'
                                : 'app-border hover:border-[color:var(--app-text-muted)]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-10 h-10 grid grid-cols-4 grid-rows-2 gap-0.5 p-0.5"
                                style={{ backgroundColor: theme.colors.background }}
                              >
                                {[
                                  theme.colors.red,
                                  theme.colors.green,
                                  theme.colors.yellow,
                                  theme.colors.blue,
                                  theme.colors.magenta,
                                  theme.colors.cyan,
                                  theme.colors.white,
                                  theme.colors.brightBlack,
                                ].map((color, i) => (
                                  <div key={i} style={{ backgroundColor: color }} />
                                ))}
                              </div>
                              <span className="font-medium text-xs">{name}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] app-text-muted mt-1.5">Turn the toggle on to automatically match the terminal theme.</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5">
                    Font Size: {settings.fontSize}px
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="24"
                    value={settings.fontSize}
                    onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5">Font Family</label>
                  <input
                    type="text"
                    value={settings.fontFamily}
                    onChange={(e) => updateSettings({ fontFamily: e.target.value })}
                    className="w-full px-2 py-1.5 app-surface border app-border focus:border-[color:var(--app-accent)] focus:outline-none text-xs"
                  />
                </div>
              </div>
            )}

            {activeTab === 'terminal' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">Cursor Style</label>
                  <div className="flex gap-5 pt-1">
                    {(['block', 'underline', 'bar'] as const).map((style) => (
                      <label key={style} className="flex items-center gap-2 cursor-pointer group">
                        <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-colors ${
                          settings.cursorStyle === style
                            ? 'border-[color:var(--app-accent)]'
                            : 'app-border group-hover:border-[color:var(--app-text-muted)]'
                        }`}>
                          {settings.cursorStyle === style && (
                            <div className="w-1.5 h-1.5 bg-[color:var(--app-accent)]" />
                          )}
                        </div>
                        <input
                          type="radio"
                          name="cursorStyle"
                          value={style}
                          checked={settings.cursorStyle === style}
                          onChange={(e) =>
                            updateSettings({ cursorStyle: e.target.value as 'block' | 'underline' | 'bar' })
                          }
                          className="hidden"
                        />
                        <span className="capitalize app-text-muted group-hover:text-[color:var(--app-text)] transition-colors text-xs">
                          {style}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Cursor Blink</label>
                  <button
                    onClick={() => updateSettings({ cursorBlink: !settings.cursorBlink })}
                    className={`relative w-10 h-5 transition-colors ${
                      settings.cursorBlink ? 'bg-[color:var(--app-accent)]' : 'bg-[color:var(--app-border)]'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 bg-[color:var(--app-surface)] shadow-sm transition-transform ${
                        settings.cursorBlink ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5">
                    Scrollback Lines: {settings.scrollback}
                  </label>
                  <input
                    type="range"
                    min="1000"
                    max="50000"
                    step="1000"
                    value={settings.scrollback}
                    onChange={(e) => updateSettings({ scrollback: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div className="pt-1 border-t app-border opacity-60" />

                <div className="space-y-2.5">
                  <div>
                    <h3 className="text-xs font-medium app-text">Toolbar Buttons</h3>
                    <p className="text-[11px] app-text-muted mt-0.5">Show or hide quick-connect buttons in the title bar.</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium">Show Docker</label>
                    <button
                      onClick={() => updateSettings({ showDockerButton: !settings.showDockerButton })}
                      className={`relative w-10 h-5 transition-colors ${
                        settings.showDockerButton ? 'bg-[color:var(--app-accent)]' : 'bg-[color:var(--app-border)]'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 bg-[color:var(--app-surface)] shadow-sm transition-transform ${
                          settings.showDockerButton ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium">Show Kubectl</label>
                    <button
                      onClick={() => updateSettings({ showKubectlButton: !settings.showKubectlButton })}
                      className={`relative w-10 h-5 transition-colors ${
                        settings.showKubectlButton ? 'bg-[color:var(--app-accent)]' : 'bg-[color:var(--app-border)]'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 bg-[color:var(--app-surface)] shadow-sm transition-transform ${
                          settings.showKubectlButton ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <h3 className="col-span-2 text-sm font-medium mb-1 text-[color:var(--app-accent)]">Terminal</h3>

                  {renderShortcutRow('Copy', 'copy')}
                  {renderShortcutRow('Paste', 'paste')}
                  {renderShortcutRow('Zoom In', 'zoomIn')}
                  {renderShortcutRow('Zoom Out', 'zoomOut')}
                  {renderShortcutRow('Reset Zoom', 'zoomReset')}

                  <h3 className="col-span-2 text-sm font-medium mb-1 mt-2 text-[color:var(--app-accent)]">Window & Tabs</h3>

                  {renderShortcutRow('Toggle Fullscreen', 'toggleFullscreen')}
                  {renderShortcutRow('New Tab', 'newTab')}
                  {renderShortcutRow('Close Tab', 'closeTab')}
                  {renderShortcutRow('Next Tab', 'nextTab')}
                  {renderShortcutRow('Previous Tab', 'prevTab')}
                </div>
              </div>
            )}

            {activeTab === 'plugins' && (
              <PluginsPage
                onOpenTab={(tab) => {
                  addTab(tab);
                  onClose();
                }}
              />
            )}

            {activeTab === 'advanced' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">Default Shell</label>
                  <div className="relative">
                    <input
                      type="text"
                      list="shell-options"
                      value={settings.shell}
                      onChange={(e) => updateSettings({ shell: e.target.value })}
                      className="w-full px-2 py-1.5 app-surface border app-border focus:border-[color:var(--app-accent)] focus:outline-none text-xs"
                      placeholder="/bin/bash"
                    />
                    <datalist id="shell-options">
                      {availableShells.map((shell) => (
                        <option key={shell} value={shell} />
                      ))}
                    </datalist>
                  </div>
                  <p className="text-[11px] app-text-muted mt-1">
                    Select from list or type custom path. Leave empty to use system default.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5">Default Directory</label>
                  <input
                    type="text"
                    value={settings.defaultCwd}
                    onChange={(e) => updateSettings({ defaultCwd: e.target.value })}
                    className="w-full px-2 py-1.5 app-surface border app-border focus:border-[color:var(--app-accent)] focus:outline-none text-xs"
                    placeholder="~"
                  />
                  <p className="text-[11px] app-text-muted mt-1">
                    Starting directory for new shell sessions. Use ~ for home directory.
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-medium">Open Local Terminal On Startup</label>
                    <p className="text-[11px] app-text-muted">
                      Automatically create one local terminal tab when the app launches.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      updateSettings({ autoStartLocalTerminal: !settings.autoStartLocalTerminal })
                    }
                    className={`w-10 h-5 transition-colors relative ${
                      settings.autoStartLocalTerminal
                        ? 'bg-[color:var(--app-accent)]'
                        : 'bg-[color:var(--app-border)]'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-[color:var(--app-surface)] shadow-sm transition-transform ${
                        settings.autoStartLocalTerminal ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="pt-1 border-t app-border opacity-60" />

                <div>
                  <label className="block text-xs font-medium mb-1.5">Docker Executable Path (Optional)</label>
                  <input
                    type="text"
                    value={settings.dockerExecutablePath}
                    onChange={(e) => updateSettings({ dockerExecutablePath: e.target.value })}
                    className="w-full px-2 py-1.5 app-surface border app-border focus:border-[color:var(--app-accent)] focus:outline-none text-xs"
                    placeholder="/usr/bin/docker"
                  />
                  <p className="text-[11px] app-text-muted mt-1">
                    Leave empty to use PATH. Useful when Docker isn't on PATH.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5">Kubectl Executable Path (Optional)</label>
                  <input
                    type="text"
                    value={settings.kubectlExecutablePath}
                    onChange={(e) => updateSettings({ kubectlExecutablePath: e.target.value })}
                    className="w-full px-2 py-1.5 app-surface border app-border focus:border-[color:var(--app-accent)] focus:outline-none text-xs"
                    placeholder="/usr/local/bin/kubectl"
                  />
                  <p className="text-[11px] app-text-muted mt-1">
                    Leave empty to use PATH. Useful when kubectl isn't on PATH.
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-medium">WebGL Renderer (Experimental)</label>
                    <p className="text-[11px] app-text-muted">
                      Enable WebGL rendering for better performance. May cause issues on some systems.
                    </p>
                  </div>
                  <button
                    onClick={() => updateSettings({ useWebGL: !settings.useWebGL })}
                    className={`w-10 h-5 transition-colors relative ${
                      settings.useWebGL ? 'bg-[color:var(--app-accent)]' : 'bg-[color:var(--app-border)]'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-[color:var(--app-surface)] shadow-sm transition-transform ${
                        settings.useWebGL ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="pt-1 border-t app-border opacity-60" />

                <div>
                  <label className="block text-xs font-medium mb-1">Developer Tools</label>
                  <p className="text-[11px] app-text-muted">
                    Open DevTools for this window.
                  </p>
                  <button
                    onClick={() => invoke('toggle_devtools').catch(console.error)}
                    className="mt-1.5 px-2 py-1.5 app-surface border app-border hover:app-hover transition-colors text-xs"
                  >
                    Open DevTools
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-3 py-2 border-t app-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-[color:var(--app-accent)] text-[color:var(--app-on-accent)] hover:opacity-90 transition-colors text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
