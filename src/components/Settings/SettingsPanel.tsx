import { useState, useEffect } from 'react';
import { useSettingsStore, defaultShortcuts } from '@/store/settingsStore';
import { defaultThemes, Shortcuts } from '@/types/settings';
import { invoke } from '@tauri-apps/api/core';
import { ShortcutRecorder } from './ShortcutRecorder';
import { RotateCcw } from 'lucide-react';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSettings, setTheme } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<'appearance' | 'terminal' | 'shortcuts' | 'advanced'>('appearance');
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
      <span className="text-gray-300">{label}</span>
      <div className="flex items-center gap-2">
        <ShortcutRecorder
          value={settings.shortcuts[id]}
          onChange={(val) => updateShortcut(id, val)}
        />
        <button
          onClick={() => updateShortcut(id, defaultShortcuts[id])}
          className={`p-1.5 transition-colors ${
            settings.shortcuts[id] !== defaultShortcuts[id]
              ? 'text-gray-400 hover:text-white hover:bg-gray-700 opacity-100'
              : 'text-transparent opacity-0 pointer-events-none'
          }`}
          title="Reset to default"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 shadow-2xl w-[800px] h-[600px] flex flex-col">
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

        <div className="flex flex-1 overflow-hidden">
          {/* Tab Bar - Sidebar */}
          <div className="flex flex-col w-48 border-r border-gray-700 bg-gray-800/50">
            {[
              { id: 'appearance', label: 'Appearance' },
              { id: 'terminal', label: 'Terminal' },
              { id: 'shortcuts', label: 'Shortcuts' },
              { id: 'advanced', label: 'Advanced' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 text-left font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-gray-700 text-white border-l-2 border-blue-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
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
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(defaultThemes).map(([name, theme]) => (
                      <button
                        key={name}
                        onClick={() => setTheme(theme)}
                        className={`p-4 border-2 transition-all ${
                          settings.theme.name === name
                            ? 'border-blue-500 bg-blue-500 bg-opacity-10'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 grid grid-cols-4 grid-rows-2 gap-0.5 p-1"
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
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {activeTab === 'terminal' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Cursor Style</label>
                  <div className="flex gap-6 pt-2">
                    {(['block', 'underline', 'bar'] as const).map((style) => (
                      <label key={style} className="flex items-center gap-2 cursor-pointer group">
                        <div className={`w-4 h-4 border flex items-center justify-center transition-colors ${
                          settings.cursorStyle === style 
                            ? 'border-blue-500' 
                            : 'border-gray-500 group-hover:border-gray-400'
                        }`}>
                          {settings.cursorStyle === style && (
                            <div className="w-2 h-2 bg-blue-500" />
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
                        <span className="capitalize text-gray-300 group-hover:text-white transition-colors">
                          {style}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Cursor Blink</label>
                  <button
                    onClick={() => updateSettings({ cursorBlink: !settings.cursorBlink })}
                    className={`relative w-12 h-6 transition-colors ${
                      settings.cursorBlink ? 'bg-blue-500' : 'bg-gray-600'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 bg-white transition-transform ${
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

            {activeTab === 'shortcuts' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <h3 className="col-span-2 text-lg font-medium mb-2 text-blue-400">Terminal</h3>
                  
                  {renderShortcutRow('Copy', 'copy')}
                  {renderShortcutRow('Paste', 'paste')}
                  {renderShortcutRow('Zoom In', 'zoomIn')}
                  {renderShortcutRow('Zoom Out', 'zoomOut')}
                  {renderShortcutRow('Reset Zoom', 'zoomReset')}

                  <h3 className="col-span-2 text-lg font-medium mb-2 mt-4 text-blue-400">Window & Tabs</h3>

                  {renderShortcutRow('Toggle Fullscreen', 'toggleFullscreen')}
                  {renderShortcutRow('New Tab', 'newTab')}
                  {renderShortcutRow('Close Tab', 'closeTab')}
                  {renderShortcutRow('Next Tab', 'nextTab')}
                  {renderShortcutRow('Previous Tab', 'prevTab')}
                </div>
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Default Shell</label>
                  <div className="relative">
                    <input
                      type="text"
                      list="shell-options"
                      value={settings.shell}
                      onChange={(e) => updateSettings({ shell: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 focus:border-blue-500 focus:outline-none"
                      placeholder="/bin/bash"
                    />
                    <datalist id="shell-options">
                      {availableShells.map((shell) => (
                        <option key={shell} value={shell} />
                      ))}
                    </datalist>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Select from list or type custom path. Leave empty to use system default.
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium">WebGL Renderer (Experimental)</label>
                    <p className="text-xs text-gray-400">
                      Enable WebGL rendering for better performance. May cause issues on some systems.
                    </p>
                  </div>
                  <button
                    onClick={() => updateSettings({ useWebGL: !settings.useWebGL })}
                    className={`w-12 h-6 transition-colors relative ${
                      settings.useWebGL ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-4 h-4 bg-white transition-transform ${
                        settings.useWebGL ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
