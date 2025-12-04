import { useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { defaultThemes } from '@/types/settings';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSettings, setTheme } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<'appearance' | 'terminal' | 'advanced'>('appearance');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-[800px] max-h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-gray-700">
          {[
            { id: 'appearance', label: 'Appearance' },
            { id: 'terminal', label: 'Terminal' },
            { id: 'advanced', label: 'Advanced' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Theme</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(defaultThemes).map(([name, theme]) => (
                    <button
                      key={name}
                      onClick={() => setTheme(theme)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        settings.theme.name === name
                          ? 'border-blue-500 bg-blue-500 bg-opacity-10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded grid grid-cols-4 grid-rows-2 gap-0.5 p-1"
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
                              className="rounded-sm"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <span className="font-medium">{name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
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
                <label className="block text-sm font-medium mb-2">Font Family</label>
                <input
                  type="text"
                  value={settings.fontFamily}
                  onChange={(e) => updateSettings({ fontFamily: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {activeTab === 'terminal' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Cursor Style</label>
                <select
                  value={settings.cursorStyle}
                  onChange={(e) =>
                    updateSettings({ cursorStyle: e.target.value as 'block' | 'underline' | 'bar' })
                  }
                  className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="block">Block</option>
                  <option value="underline">Underline</option>
                  <option value="bar">Bar</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Cursor Blink</label>
                <button
                  onClick={() => updateSettings({ cursorBlink: !settings.cursorBlink })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings.cursorBlink ? 'bg-blue-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      settings.cursorBlink ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
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
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Default Shell</label>
                <input
                  type="text"
                  value={settings.shell}
                  onChange={(e) => updateSettings({ shell: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="/bin/bash"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Leave empty to use system default shell
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
