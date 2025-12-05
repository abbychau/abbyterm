import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { TerminalProps } from '@/types/terminal';
import { useSettingsStore } from '@/store/settingsStore';
//import { WebglAddon } from 'xterm-addon-webgl';
import 'xterm/css/xterm.css';

export function Terminal({ sessionId, isActive }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { settings } = useSettingsStore();
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Focus terminal when it becomes active
  // Update terminal settings when they change
  useEffect(() => {
    const term = xtermRef.current;
    if (!term || (term as any).isDisposed) return;

    term.options.fontFamily = settings.fontFamily;
    term.options.fontSize = settings.fontSize;
    term.options.cursorStyle = settings.cursorStyle;
    term.options.cursorBlink = settings.cursorBlink;
    term.options.scrollback = settings.scrollback;
    term.options.theme = settings.theme.colors;

    // Trigger a fit after settings change to recalculate dimensions
    if (fitAddonRef.current) {
      try {
        fitAddonRef.current.fit();
        invoke('pty_resize', {
          sessionId,
          cols: term.cols,
          rows: term.rows,
        }).catch((err) => console.error('Failed to resize PTY after settings change:', err));
      } catch (e) {
        console.error('Failed to fit terminal after settings change:', e);
      }
    }
  }, [settings, sessionId]);

  useEffect(() => {
    if (isActive && xtermRef.current && !(xtermRef.current as any).isDisposed) {
      // Wait for layout to update (display: none -> block)
      setTimeout(() => {
        if (fitAddonRef.current) {
          try {
            fitAddonRef.current.fit();
            // Sync PTY size
            const term = xtermRef.current;
            if (term) {
              invoke('pty_resize', {
                sessionId,
                cols: term.cols,
                rows: term.rows,
              }).catch((err) => console.error('Failed to resize PTY on activation:', err));
            }
          } catch (e) {
            console.error('Failed to fit terminal on activation:', e);
          }
        }
        xtermRef.current?.focus();
      }, 50);
    }
  }, [isActive, sessionId]);

  useEffect(() => {
    const terminalElement = terminalRef.current;
    if (!terminalElement) return;

    let term: XTerm | null = null;
    let isDisposed = false;
    let isMounted = true;

    const initTerminal = () => {
      try {
        // Create terminal instance with default settings
        term = new XTerm({
          fontFamily: settings.fontFamily,
          fontSize: settings.fontSize,
          cursorStyle: settings.cursorStyle,
          cursorBlink: settings.cursorBlink,
          scrollback: settings.scrollback,
          theme: settings.theme.colors,
        });
      } catch (err) {
        console.error('Failed to create terminal:', err);
        return null;
      }
      return term;
    };

    term = initTerminal();
    if (!term) return;

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    // Custom key event handler for shortcuts
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true;

      const modifiers = [];
      if (e.ctrlKey) modifiers.push('Ctrl');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.altKey) modifiers.push('Alt');
      if (e.metaKey) modifiers.push('Meta');
      
      let key = e.key;
      if (key === ' ') key = 'Space';
      if (key.length === 1) key = key.toUpperCase();
      
      const currentShortcut = [...modifiers, key].join('+');
      const { shortcuts } = settingsRef.current;

      if (currentShortcut === shortcuts.copy) {
        const selection = term?.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          return false;
        }
      } else if (currentShortcut === shortcuts.paste) {
        navigator.clipboard.readText().then((text) => {
          term?.paste(text);
        });
        return false;
      }

      // Allow global shortcuts to bubble up
      if (
        currentShortcut === shortcuts.toggleFullscreen ||
        currentShortcut === shortcuts.zoomIn ||
        currentShortcut === shortcuts.zoomOut ||
        currentShortcut === shortcuts.zoomReset ||
        currentShortcut === shortcuts.newTab ||
        currentShortcut === shortcuts.closeTab ||
        currentShortcut === shortcuts.nextTab ||
        currentShortcut === shortcuts.prevTab
      ) {
        return false;
      }

      return true;
    });

    // Note: WebGL addon is not loaded because it causes rendering delays
    // The default canvas renderer provides immediate updates
    // try {
    //   const webglAddon = new WebglAddon();
    //   term.loadAddon(webglAddon);
    // } catch (e) {
    //   console.warn('WebGL addon could not be loaded:', e);
    // }

    // Wait for DOM to be ready before opening terminal
    const openTimeout = setTimeout(() => {
      if (isDisposed || !isMounted || !term) return;

      try {
        // Open terminal in DOM
        term.open(terminalElement);

        // Focus the terminal so it can receive input
        term.focus();

        // Fit terminal to container after a brief delay
        const fitTimeout = setTimeout(() => {
          if (isDisposed || !isMounted || !term) return;
          try {
            fitAddon.fit();
            term.focus(); // Focus again after fitting
            if (isMounted) {
              setIsInitialized(true);
            }
          } catch (err) {
            console.error('Failed to fit terminal:', err);
          }
        }, 50);

        // Store timeout for cleanup
        xtermRef.current = term;
        (term as any)._fitTimeout = fitTimeout;
      } catch (err) {
        console.error('Failed to open terminal:', err);
      }
    }, 0);

    // Handle terminal input - send to backend
    term.onData((data) => {
      invoke('pty_write', { sessionId, data }).catch((err) => {
        console.error('Failed to write to PTY:', err);
      });
    });

    // Handle resize
    const handleResize = () => {
      if (!term) return;
      try {
        fitAddon.fit();
        invoke('pty_resize', {
          sessionId,
          cols: term.cols,
          rows: term.rows,
        }).catch((err) => {
          console.error('Failed to resize PTY:', err);
        });
      } catch (e) {
        // Ignore fit errors (can happen if element is hidden)
      }
    };

    // Use ResizeObserver to handle container resizing
    const resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to avoid "ResizeObserver loop limit exceeded"
      requestAnimationFrame(() => {
        handleResize();
      });
    });
    
    resizeObserver.observe(terminalElement);

    // Initial resize after a short delay to ensure proper dimensions
    setTimeout(() => {
      handleResize();
    }, 100);

    // Listen for PTY output
    const unlistenPromise = listen<string>(`pty-output-${sessionId}`, (event) => {
      if (term && !(term as any).isDisposed) {
        term.write(event.payload);
      }
    });

    // Listen for PTY exit
    const unlistenExitPromise = listen(`pty-exit-${sessionId}`, () => {
      if (!term) return;
      term.write('\r\n\r\n[Process exited]\r\n');
      term.options.cursorBlink = false;
    });

    fitAddonRef.current = fitAddon;

    // Cleanup
    return () => {
      isMounted = false;
      isDisposed = true;

      // Clear timeouts
      clearTimeout(openTimeout);
      if (term && (term as any)._fitTimeout) {
        clearTimeout((term as any)._fitTimeout);
      }

      resizeObserver.disconnect();

      unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
      unlistenExitPromise.then((unlisten) => unlisten()).catch(() => {});

      // Safely dispose terminal
      if (term) {
        try {
          if (!(term as any).isDisposed) {
            term.dispose();
          }
        } catch (err) {
          console.warn('Error disposing terminal:', err);
        }
      }
    };
  }, [sessionId]);

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{ backgroundColor: settings.theme.colors.background }}
    >
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-2"></div>
            <p>Initializing terminal...</p>
          </div>
        </div>
      )}
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
}
