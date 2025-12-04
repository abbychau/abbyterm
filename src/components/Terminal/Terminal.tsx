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

  // Focus terminal when it becomes active
  // Update terminal settings when they change
  useEffect(() => {
    const term = xtermRef.current;
    if (!term || (term as any).isDisposed) return;

    term.options = {
      ...term.options,
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      cursorStyle: settings.cursorStyle,
      cursorBlink: settings.cursorBlink,
      scrollback: settings.scrollback,
      theme: settings.theme.colors,
    };

    // Trigger a fit after settings change to recalculate dimensions
    fitAddonRef.current?.fit();
  }, [settings]);

  useEffect(() => {
    if (isActive && xtermRef.current && !(xtermRef.current as any).isDisposed) {
      xtermRef.current.focus();
    }
  }, [isActive]);

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

    // Handle window resize
    const handleResize = () => {
      if (!term) return;
      fitAddon.fit();
      invoke('pty_resize', {
        sessionId,
        cols: term.cols,
        rows: term.rows,
      }).catch((err) => {
        console.error('Failed to resize PTY:', err);
      });
    };

    window.addEventListener('resize', handleResize);

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

      window.removeEventListener('resize', handleResize);

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
