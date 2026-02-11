import { useEffect, useRef } from 'react';
import { TitleBar } from './components/TitleBar/TitleBar';
import { TabBar } from './components/TabBar/TabBar';
import { TerminalContainer } from './components/Terminal/TerminalContainer';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useTabStore } from './store/tabStore';
import { useSettingsStore } from './store/settingsStore';
import { v4 as uuidv4 } from 'uuid';

function App() {
  const addTab = useTabStore((state) => state.addTab);
  const activeTabTitle = useTabStore((state) =>
    state.tabs.find((t) => t.id === state.activeTabId)?.title
  );
  const settings = useSettingsStore((state) => state.settings);
  const initialized = useRef(false);
  useGlobalShortcuts();

  useEffect(() => {
    // With `decorations: false`, many Linux compositors don't draw a shadow by default.
    // Ask the runtime to enable the native shadow where supported.
    const applyShadow = async () => {
      try {
        const appWindow = getCurrentWindow();
        await (appWindow as any).setShadow?.(true);
      } catch {
        // Not supported on this platform/window manager, or missing permission.
      }
    };
    applyShadow();
  }, []);

  useEffect(() => {
    const updateTitle = async () => {
      const nextTitle = activeTabTitle || 'AbbyTerm';

      // Always keep the web document title in sync (useful for `vite preview`, and harmless in Tauri).
      document.title = nextTitle;

      // Best-effort: update the actual native window title for taskbar / window manager.
      try {
        const appWindow = getCurrentWindow();
        await appWindow.setTitle(nextTitle);
      } catch {
        // Likely running outside Tauri, or missing capability permissions.
      }
    };
    updateTitle();
  }, [activeTabTitle]);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  useEffect(() => {
    const themeToUse = settings.syncAppThemeWithTerminal ? settings.theme : settings.appTheme;
    const colors = themeToUse?.colors;
    if (!colors) return;

    const isLightBackground = (hexColor: string) => {
      const hex = hexColor.trim();
      const m = hex.match(/^#([0-9a-fA-F]{6})$/);
      if (!m) return false;

      const n = parseInt(m[1], 16);
      const r = (n >> 16) & 0xff;
      const g = (n >> 8) & 0xff;
      const b = n & 0xff;

      // Relative luminance (sRGB)
      const srgb = [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      const lum = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
      return lum > 0.6;
    };

    const hexToRgb = (hexColor: string) => {
      const hex = hexColor.trim();
      const m = hex.match(/^#([0-9a-fA-F]{6})$/);
      if (!m) return null;

      const n = parseInt(m[1], 16);
      return {
        r: (n >> 16) & 0xff,
        g: (n >> 8) & 0xff,
        b: n & 0xff,
      };
    };

    const isLight = isLightBackground(colors.background);
    const pickOnColor = (hexColor: string) => (isLightBackground(hexColor) ? '#000000' : '#ffffff');

    const fgRgb = hexToRgb(colors.foreground);
    const textMutedFromFg = fgRgb ? `rgba(${fgRgb.r}, ${fgRgb.g}, ${fgRgb.b}, 0.65)` : colors.brightBlack;

    const bgRgb = hexToRgb(colors.background);
    const blendRgb = (from: { r: number; g: number; b: number }, to: { r: number; g: number; b: number }, t: number) => {
      const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
      return {
        r: clamp(from.r + (to.r - from.r) * t),
        g: clamp(from.g + (to.g - from.g) * t),
        b: clamp(from.b + (to.b - from.b) * t),
      };
    };

    const toRgbCss = (rgb: { r: number; g: number; b: number }) => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

    const surface2 =
      isLight && bgRgb && fgRgb ? toRgbCss(blendRgb(bgRgb, fgRgb, 0.04)) : (isLight ? (colors.white || colors.brightWhite || colors.background) : colors.black);
    const border =
      isLight && bgRgb && fgRgb ? toRgbCss(blendRgb(bgRgb, fgRgb, 0.18)) : (isLight ? (colors.brightBlack || colors.foreground) : colors.brightBlack);
    const textMuted = isLight ? textMutedFromFg : colors.brightBlack;
    const hover = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)';
    const hover2 = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)';

    const root = document.documentElement;
    root.style.setProperty('--app-bg', colors.background);
    root.style.setProperty('--app-surface', colors.background);
    root.style.setProperty('--app-surface-2', surface2);
    root.style.setProperty('--app-border', border);
    root.style.setProperty('--app-text', colors.foreground);
    root.style.setProperty('--app-text-muted', textMuted);
    root.style.setProperty('--app-hover', hover);
    root.style.setProperty('--app-hover-2', hover2);
    root.style.setProperty('--app-accent', colors.blue);
    root.style.setProperty('--app-on-accent', pickOnColor(colors.blue));
    root.style.setProperty('--app-danger', colors.red);
    root.style.setProperty('--app-on-danger', pickOnColor(colors.red));
    root.style.setProperty('--app-success', colors.green);
    root.style.setProperty('--app-on-success', pickOnColor(colors.green));
  }, [settings.appTheme, settings.syncAppThemeWithTerminal, settings.theme]);

  useEffect(() => {
    const init = async () => {
      if (initialized.current) return;
      initialized.current = true;

      try {
        // Auto-hide Kubectl button if kubectl isn't runnable.
        // (Do not gate this behind the button being shown; we want the first-run experience to be correct.)
        try {
          const kubectlOk = await invoke<boolean>('check_kubectl_available', {
            kubectlPath: settings.kubectlExecutablePath || null,
          });
          const current = useSettingsStore.getState().settings;
          if (!kubectlOk && current.showKubectlButton) {
            useSettingsStore.getState().updateSettings({ showKubectlButton: false });
          }
        } catch (e) {
          // If the check itself fails, keep current setting unchanged.
          console.warn('Failed to check kubectl availability:', e);
        }

        // Auto-hide Docker button if docker isn't runnable.
        try {
          const dockerOk = await invoke<boolean>('check_docker_available', {
            dockerPath: settings.dockerExecutablePath || null,
          });
          const current = useSettingsStore.getState().settings;
          if (!dockerOk && current.showDockerButton) {
            useSettingsStore.getState().updateSettings({ showDockerButton: false });
          }
        } catch (e) {
          console.warn('Failed to check docker availability:', e);
        }

        const args = await invoke<string[] | null>('get_initial_args');

        // Auto-start only when requested by command args or app settings.
        if ((!args || args.length === 0) && !settings.autoStartLocalTerminal) {
          return;
        }

        let shell: string | undefined;
        let shellArgs: string[] | undefined;

        if (args && args.length === 1 && args[0].includes(' ')) {
            const parts = args[0].split(' ');
            shell = parts[0];
            shellArgs = parts.slice(1);
        } else if (args && args.length > 0) {
            shell = args[0];
            if (args.length > 1) {
                shellArgs = args.slice(1);
            }
        }

        const sessionId = await invoke<string>('create_pty_session', {
          shell: shell || null,
          args: shellArgs || null,
          cwd: settings.defaultCwd || null,
          cols: 80,
          rows: 24,
        });

        addTab({
          id: uuidv4(),
          title: shell || 'Local',
          sessionId,
          type: 'local',
          rootPane: {
            type: 'terminal',
            id: uuidv4(),
            sessionId,
            title: shell || 'Local',
            tabType: 'local',
          },
        });
      } catch (error) {
        console.error('Failed to initialize terminal:', error);
      }
    };

    init();

    return;
  }, []);

  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <div className="h-full w-full flex flex-col overflow-hidden app-bg border border-solid app-border">
        <TitleBar />
        <TabBar />
        <TerminalContainer />
      </div>
    </div>
  );
}

export default App;
