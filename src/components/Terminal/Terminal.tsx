import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';
import { TerminalProps } from '@/types/terminal';
import { useSettingsStore } from '@/store/settingsStore';
import { useTabStore } from '@/store/tabStore';
import { WebglAddon } from 'xterm-addon-webgl';
import { SearchAddon } from 'xterm-addon-search';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { SearchBox } from './SearchBox';
import { TerminalContextMenu } from './TerminalContextMenu';
import 'xterm/css/xterm.css';

export function Terminal({ sessionId, isActive }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { settings } = useSettingsStore();
  const updateTab = useTabStore((state) => state.updateTab);
  const settingsRef = useRef(settings);

  const handleCopy = async () => {
    const term = xtermRef.current;
    if (!term) return;
    const selection = term.getSelection();
    if (selection) {
      try {
        await writeText(selection);
        console.log('Copied to plugin clipboard');
      } catch (e) {
        console.warn('Plugin copy failed:', e);
        try {
            await navigator.clipboard.writeText(selection);
            console.log('Copied to web clipboard');
        } catch (e2) {
            console.warn('Web copy failed:', e2);
            // Fallback to execCommand
            // We need to ensure the textarea is focused and has selection?
            // Xterm handles this usually if we focus it.
            document.execCommand('copy');
        }
      }
    }
  };

  const handlePaste = async () => {
    const term = xtermRef.current;
    if (!term) return;
    
    const webPromise = navigator.clipboard 
      ? navigator.clipboard.readText().catch(e => {
          console.warn('Web clipboard read failed:', e);
          return { error: e, type: 'web' };
        })
      : Promise.resolve({ error: 'API unavailable', type: 'web' });
    
    const pluginPromise = readText().catch(e => {
        console.warn('Plugin clipboard read failed:', e);
        return { error: e, type: 'plugin' };
    });

    Promise.all([pluginPromise, webPromise]).then(([pluginResult, webResult]) => {
        if (typeof pluginResult === 'string') {
            term.paste(pluginResult);
        } else if (typeof webResult === 'string') {
            term.paste(webResult);
        } else {
            console.error('Clipboard paste failed', pluginResult, webResult);
            if (!document.execCommand('paste')) {
                term.write(`\r\n[Clipboard Error] Plugin: ${pluginResult?.error}, Web: ${webResult?.error}\r\n`);
            }
        }
    });
  };

  const handleSelectAll = () => {
    xtermRef.current?.selectAll();
  };

  const handleClear = () => {
    xtermRef.current?.clear();
  };

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

    // Handle WebGL addon
    if (settings.useWebGL && !webglAddonRef.current) {
      try {
        const webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => {
          webglAddon.dispose();
        });
        term.loadAddon(webglAddon);
        webglAddonRef.current = webglAddon;
      } catch (e) {
        console.warn('WebGL addon could not be loaded:', e);
      }
    } else if (!settings.useWebGL && webglAddonRef.current) {
      webglAddonRef.current.dispose();
      webglAddonRef.current = null;
    }

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
    const webLinksAddon = new WebLinksAddon((event: MouseEvent, uri: string) => {
      // Open URL in default browser using Tauri shell API
      open(uri).catch((err) => {
        console.error('Failed to open URL:', uri, err);
      });
    });
    const searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;

    // Handle title change from OSC sequences (including OSC 7 for directory)
    term.onTitleChange((title) => {
      const tabs = useTabStore.getState().tabs;
      const tab = tabs.find((t) => t.sessionId === sessionId);
      if (tab) {
        updateTab(tab.id, { title });
      }
    });

    // Periodically fetch the current working directory from the shell process
    // Only for actual local terminals, not for docker/k8s exec sessions
    const cwdInterval = setInterval(async () => {
      try {
        const tabs = useTabStore.getState().tabs;
        const tab = tabs.find((t) => t.sessionId === sessionId);

        // Skip CWD polling for Docker and K8s tabs
        if (!tab || tab.type !== 'local') return;
        if (tab.title?.startsWith('Docker:') || tab.title?.startsWith('K8s:') || tab.title?.startsWith('SSH:')) {
          return;
        }

        const cwd = await invoke<string>('get_session_cwd', { sessionId });

        if (cwd && tab.title !== cwd) {
          // Show full path
          updateTab(tab.id, { title: cwd });
        }
      } catch (err) {
        // Silently ignore errors - process might not exist or permission denied
        console.debug('Failed to get session cwd:', err);
      }
    }, 2000); // Poll every 2 seconds

    // Handle prompt detection for title update
    term.onCursorMove(() => {
      const tabs = useTabStore.getState().tabs;
      const tab = tabs.find((t) => t.sessionId === sessionId);
      if (!tab) return;

      const buffer = term?.buffer.active;
      if (!buffer) return;

      const cursorY = buffer.cursorY;
      const line = buffer.getLine(cursorY)?.translateToString().trimEnd();

      if (!line) return;

      // Try different prompt formats to extract directory/context
      let newTitle: string | null = null;

      // Format 1: user@host:path$ or user@host:path#
      const format1 = line.match(/^(.+@.+:.+?)([$#%])\s*$/);
      if (format1) {
        newTitle = format1[1];
      }

      // Format 2: path$ or path# (simple prompt with just path)
      if (!newTitle) {
        const format2 = line.match(/^([~\/][\w\-\.\/]*)([$#%])\s*$/);
        if (format2) {
          newTitle = format2[1];
        }
      }

      // Format 3: user@host path$ (space separated)
      if (!newTitle) {
        const format3 = line.match(/^(.+@.+)\s+([~\/][\w\-\.\/]*)([$#%])\s*$/);
        if (format3) {
          newTitle = format3[2]; // Just use the path part
        }
      }

      // If we detected a title and it's different from current, update it
      // If tab.type is 'local' and title is still default, use "Local" as fallback
      if (newTitle && tab.title !== newTitle) {
        updateTab(tab.id, { title: newTitle });
      } else if (!newTitle && tab.type === 'local' && (tab.title === 'Terminal' || tab.title === 'Local')) {
        // Keep "Local" as is, don't change
      }
    });

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
          e.preventDefault();
          e.stopPropagation();
          handleCopy();
          return false;
        }
      } else if (currentShortcut === shortcuts.paste) {
        e.preventDefault();
        e.stopPropagation();
        handlePaste();
        return false;
      } else if (currentShortcut === shortcuts.find) {
        e.preventDefault();
        e.stopPropagation();
        setIsSearchOpen((prev) => !prev);
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
    if (settingsRef.current.useWebGL) {
      try {
        const webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => {
          webglAddon.dispose();
        });
        term.loadAddon(webglAddon);
        webglAddonRef.current = webglAddon;
      } catch (e) {
        console.warn('WebGL addon could not be loaded:', e);
      }
    }

    // Wait for DOM to be ready before opening terminal
    const openTimeout = setTimeout(() => {
      if (isDisposed || !isMounted || !term) return;

      try {
        // Open terminal in DOM
        term.open(terminalElement);

        const openedTerm = term;

        // Click-to-move-cursor: translate mouse click to left/right arrow sequences.
        // This cannot move the OS mouse pointer; it moves the shell's editing cursor (readline).
        const sendToPty = (data: string) => {
          invoke('pty_write', { sessionId, data }).catch((err) => {
            console.error('Failed to write to PTY:', err);
          });
        };

        const getCellSize = () => {
          const core = (openedTerm as any)?._core;
          const dims = core?._renderService?.dimensions;
          const width = dims?.css?.cell?.width ?? dims?.actualCellWidth;
          const height = dims?.css?.cell?.height ?? dims?.actualCellHeight;
          if (typeof width === 'number' && width > 0 && typeof height === 'number' && height > 0) {
            return { width, height };
          }
          return null;
        };

        const getViewportCellFromMouseEvent = (e: MouseEvent) => {
          const cell = getCellSize();
          const root = openedTerm.element as HTMLElement | undefined;
          if (!cell || !root) return null;

          const screen = root.querySelector('.xterm-screen') as HTMLElement | null;
          const rect = (screen ?? root).getBoundingClientRect();

          const relX = e.clientX - rect.left;
          const relY = e.clientY - rect.top;
          if (relX < 0 || relY < 0) return null;

          const col0 = Math.floor(relX / cell.width);
          const row0 = Math.floor(relY / cell.height);
          if (col0 < 0 || row0 < 0) return null;
          if (col0 >= openedTerm.cols || row0 >= openedTerm.rows) return null;
          return { col0, row0 };
        };

        const getWrappedBlockStartAbs = (absLine: number) => {
          const buffer = openedTerm.buffer.active;
          if (!buffer) return null;
          let start = absLine;
          while (start > 0) {
            const line = buffer.getLine(start) as any;
            if (!line?.isWrapped) break;
            start -= 1;
          }
          return start;
        };

        let mouseDownAt: { x: number; y: number } | null = null;
        let mouseMoved = false;

        const onMouseDown = (e: MouseEvent) => {
          if (e.button !== 0) return; // left click only
          mouseDownAt = { x: e.clientX, y: e.clientY };
          mouseMoved = false;
        };

        const onMouseMove = (e: MouseEvent) => {
          if (!mouseDownAt) return;
          const dx = Math.abs(e.clientX - mouseDownAt.x);
          const dy = Math.abs(e.clientY - mouseDownAt.y);
          if (dx > 3 || dy > 3) mouseMoved = true;
        };

        const onMouseUp = (e: MouseEvent) => {
          if (e.button !== 0) return;
          if (e.ctrlKey || e.altKey || e.metaKey) return;
          if (mouseMoved) return;
          if ((openedTerm as any).isDisposed) return;

          // If user selected text, don't reposition the shell cursor.
          if (openedTerm.hasSelection()) return;

          const pos = getViewportCellFromMouseEvent(e);
          if (!pos) return;

          const buffer = openedTerm.buffer.active;
          const baseY = buffer.baseY;

          const absCursorLine = baseY + buffer.cursorY;
          const absClickLine = baseY + pos.row0;

          const startCursor = getWrappedBlockStartAbs(absCursorLine);
          const startClick = getWrappedBlockStartAbs(absClickLine);
          if (startCursor == null || startClick == null) return;
          if (startCursor !== startClick) return; // only within the current wrapped input block

          const cursorOffset = (absCursorLine - startCursor) * openedTerm.cols + buffer.cursorX;
          const clickOffset = (absClickLine - startCursor) * openedTerm.cols + pos.col0;
          const delta = clickOffset - cursorOffset;
          if (delta === 0) return;

          openedTerm.focus();
          const n = Math.abs(delta);

          // IMPORTANT: readline expects *key sequences* for arrows, not CSI cursor-movement with numeric params.
          // Normal cursor keys: ESC [ D / ESC [ C
          // Application cursor keys (DECCKM): ESC O D / ESC O C
          const appCursor = (openedTerm as any).modes?.applicationCursorKeysMode === true;
          const left = appCursor ? '\x1bOD' : '\x1b[D';
          const right = appCursor ? '\x1bOC' : '\x1b[C';
          sendToPty((delta < 0 ? left : right).repeat(n));
        };

        const rootEl = openedTerm.element as HTMLElement | null;
        if (rootEl) {
          rootEl.addEventListener('mousedown', onMouseDown);
          rootEl.addEventListener('mousemove', onMouseMove);
          rootEl.addEventListener('mouseup', onMouseUp);

          (openedTerm as any)._clickToMoveCleanup = () => {
            rootEl.removeEventListener('mousedown', onMouseDown);
            rootEl.removeEventListener('mousemove', onMouseMove);
            rootEl.removeEventListener('mouseup', onMouseUp);
          };
        }

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

      // Clear timeouts and intervals
      clearTimeout(openTimeout);
      if (term && (term as any)._fitTimeout) {
        clearTimeout((term as any)._fitTimeout);
      }
      clearInterval(cwdInterval);

      resizeObserver.disconnect();

      unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
      unlistenExitPromise.then((unlisten) => unlisten()).catch(() => {});

      // Safely dispose terminal
      if (term) {
        try {
          const cleanupClickToMove = (term as any)._clickToMoveCleanup;
          if (typeof cleanupClickToMove === 'function') {
            cleanupClickToMove();
          }
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
    <TerminalContextMenu
      onCopy={handleCopy}
      onPaste={handlePaste}
      onSelectAll={handleSelectAll}
      onClear={handleClear}
    >
      <div
        className="w-full h-full relative overflow-hidden"
        style={{ backgroundColor: settings.theme.colors.background }}
      >
        {isSearchOpen && searchAddonRef.current && (
          <SearchBox
            searchAddon={searchAddonRef.current}
            onClose={() => {
              setIsSearchOpen(false);
              xtermRef.current?.focus();
            }}
          />
        )}
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
    </TerminalContextMenu>
  );
}
