import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { TerminalProps } from '@/types/terminal';
import { useSettingsStore } from '@/store/settingsStore';
import { useTabStore, tabStore } from '@/store/tabStore';
import { WebglAddon } from 'xterm-addon-webgl';
import { SearchAddon } from 'xterm-addon-search';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import Zmodem from 'zmodem.js/src/zmodem_browser';
import { SearchBox } from './SearchBox';
import { TerminalContextMenu } from './TerminalContextMenu';
import 'xterm/css/xterm.css';
import { activateEnabledTerminalPlugins } from '@/plugins/terminal/runtime';

type ZmodemUploadFile = {
  name: string;
  path: string;
  size: number;
  last_modified_ms: number;
};

type ZmodemTransferProgress = {
  fileName: string;
  fileIndex: number;
  fileCount: number;
  sentBytes: number;
  totalBytes: number;
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
};

export function Terminal({ sessionId, isActive, tabId, paneId, isPrimaryPane }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const terminalPluginsRef = useRef<{ dispose: () => void } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [zmodemProgress, setZmodemProgress] = useState<ZmodemTransferProgress | null>(null);
  const { settings } = useSettingsStore();
  const { updateTab } = useTabStore.getState();
  const settingsRef = useRef(settings);
  const cwdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(isActive);
  const lastNativePasteRef = useRef<{ text: string; at: number } | null>(null);

  // Update ref when isActive changes
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive, isPrimaryPane]);

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

    try {
      const text = await readText();
      if (text) {
        term.paste(text);
        return;
      }
    } catch (err) {
      console.warn('Plugin clipboard read failed:', err);
    }

    if (navigator.clipboard) {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          term.paste(text);
          return;
        }
      } catch (err) {
        console.warn('Web clipboard read failed:', err);
      }
    }

    const cached = lastNativePasteRef.current;
    if (cached && Date.now() - cached.at < 10_000) {
      term.paste(cached.text);
      return;
    }

    console.warn('Clipboard paste unavailable (plugin/web/native cache all failed)');
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

  useEffect(() => {
    const term = xtermRef.current;
    const container = containerRef.current;
    if (!term || !container || (term as any).isDisposed) return;

    terminalPluginsRef.current?.dispose();

    terminalPluginsRef.current = activateEnabledTerminalPlugins(
      {
        sessionId,
        term,
        container,
        getThemeColors: () => {
          const colors = Object.values(settingsRef.current.theme.colors);
          return colors.filter((c) => typeof c === 'string' && c.startsWith('#')) as string[];
        },
      },
      settings
    );

    return () => {
      terminalPluginsRef.current?.dispose();
      terminalPluginsRef.current = null;
    };
  }, [settings.terminalPlugins, settings.theme, sessionId]);

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
      // Use requestAnimationFrame to ensure layout has completed before fitting
      requestAnimationFrame(() => {
        if (fitAddonRef.current && xtermRef.current && !(xtermRef.current as any).isDisposed) {
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
      });
      xtermRef.current?.focus();
    }
  }, [isActive, sessionId]);

  // Start/stop CWD polling when tab becomes active/inactive
  useEffect(() => {
    if (xtermRef.current) {
      const startCwdPolling = () => {
        // Clear any existing interval
        if (cwdIntervalRef.current) {
          clearInterval(cwdIntervalRef.current);
        }

        cwdIntervalRef.current = setInterval(async () => {
          // Only poll if tab is active
          if (!isActiveRef.current) return;

          try {
            const tabs = tabStore.getState().tabs;
            const tab = tabs.find((t) => t.sessionId === sessionId);

            // Skip CWD polling for Docker and K8s tabs
            if (!tab || tab.type !== 'local') return;
            if (tab.title?.startsWith('Docker:') || tab.title?.startsWith('K8s:') || tab.title?.startsWith('SSH:')) {
              return;
            }

            // For split panes, only primary pane should update tab title
            if (!isPrimaryPane) return;

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
      };

      startCwdPolling();

      return () => {
        if (cwdIntervalRef.current) {
          clearInterval(cwdIntervalRef.current);
        }
      };
    }
  }, [sessionId]);

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
    const webLinksAddon = new WebLinksAddon((_event: MouseEvent, uri: string) => {
      // Open URL in default browser using Tauri shell API
      openExternal(uri).catch((err) => {
        console.error('Failed to open URL:', uri, err);
      });
    });
    const searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;

    const shouldUpdateTitle = (currentTitle: string | undefined, nextTitle: string) => {
      if (!nextTitle) return false;
      if (!currentTitle) return true;
      if (currentTitle === nextTitle) return false;

      const currentIsAbsPath = currentTitle.startsWith('/');
      const nextIsAbsPath = nextTitle.startsWith('/');

      // Avoid flicker: don't replace a known absolute path with a less-specific prompt-ish title.
      if (currentIsAbsPath && !nextIsAbsPath) return false;

      return true;
    };

    const extractPathFromPromptishTitle = (rawTitle: string) => {
      const title = rawTitle.trim();

      // Common title / prompt shapes we see:
      // - user@host:~/path
      // - user@host:/abs/path
      // - user@host ~/path
      const colon = title.match(/^.+@.+:([~\/].+)$/);
      if (colon) return colon[1].trim();

      const space = title.match(/^.+@.+\s+([~\/].+)$/);
      if (space) return space[1].trim();

      return null;
    };

    // Handle title change from OSC sequences (including OSC 7 for directory)
    term.onTitleChange((title) => {
      // Only update title if this terminal is active
      if (!isActiveRef.current) return;

      const tabs = tabStore.getState().tabs;
      const tab = tabs.find((t) => t.sessionId === sessionId);
      if (tab) {
        // For split panes, only the primary pane should update the tab title
        if (!isPrimaryPane) return;

        let nextTitle = title;

        // For local terminals, prefer displaying directory, not the full user@host prompt.
        if (tab.type === 'local') {
          const extracted = extractPathFromPromptishTitle(title);
          if (extracted) nextTitle = extracted;
        }

        if (shouldUpdateTitle(tab.title, nextTitle)) {
          updateTab(tab.id, { title: nextTitle });
        }
      }
    });

    // Handle prompt detection for title update
    term.onCursorMove(() => {
      // Only update title if this terminal is active
      if (!isActiveRef.current) return;

      const tabs = tabStore.getState().tabs;
      const tab = tabs.find((t) => t.sessionId === sessionId);
      if (!tab) return;

      // For split panes, only primary pane should update the tab title
      if (tab.sessionId !== sessionId) return;

      const buffer = term?.buffer.active;
      if (!buffer) return;

      const cursorY = buffer.cursorY;
      const line = buffer.getLine(cursorY)?.translateToString().trimEnd();

      if (!line) return;

      // Try different prompt formats to extract directory/context
      let newTitle: string | null = null;

      // Format 1: user@host:path$ or user@host:path#
      const format1 = line.match(/^.+@.+:([~\/][\w\-\.\/]*)([$#%])\s*$/);
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
      if (newTitle && shouldUpdateTitle(tab.title, newTitle)) {
        updateTab(tab.id, { title: newTitle });
      } else if (!newTitle && tab.type === 'local' && (tab.title === 'Terminal' || tab.title === 'Local')) {
        // Keep "Local" as is, don't change
      }
    });

    // Custom key event handler for shortcuts
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true;

      // Arrow keys must always reach the PTY as escape sequences.
      // If they degrade to plain A/B/C/D, editors like Vim will insert letters instead of moving.
      // Handle the common no-modifier case here and bypass xterm's processing.
      if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        let seq: string | null = null;
        if (e.key === 'ArrowUp') seq = '\u001b[A';
        else if (e.key === 'ArrowDown') seq = '\u001b[B';
        else if (e.key === 'ArrowRight') seq = '\u001b[C';
        else if (e.key === 'ArrowLeft') seq = '\u001b[D';

        if (seq) {
          e.preventDefault();
          e.stopPropagation();
          invoke('pty_write', { sessionId, data: seq }).catch((err) => {
            console.error('Failed to write arrow key to PTY:', err);
          });
          return false;
        }
      }

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

        const onPaste = (e: ClipboardEvent) => {
          const text = e.clipboardData?.getData('text/plain');
          if (!text) return;

          lastNativePasteRef.current = { text, at: Date.now() };

          if ((openedTerm as any).isDisposed) return;
          e.preventDefault();
          openedTerm.paste(text);
        };

        const rootEl = openedTerm.element as HTMLElement | null;
        if (rootEl) {
          rootEl.addEventListener('mousedown', onMouseDown);
          rootEl.addEventListener('mousemove', onMouseMove);
          rootEl.addEventListener('mouseup', onMouseUp);
          rootEl.addEventListener('paste', onPaste);

          (openedTerm as any)._clickToMoveCleanup = () => {
            rootEl.removeEventListener('mousedown', onMouseDown);
            rootEl.removeEventListener('mousemove', onMouseMove);
            rootEl.removeEventListener('mouseup', onMouseUp);
            rootEl.removeEventListener('paste', onPaste);
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

    let zmodemSentry: any = null;
    let activeZmodemSession: any = null;
    let zmodemWriteQueue: Promise<unknown> = Promise.resolve();
    let zmodemOutboundBuffer: number[] = [];
    let zmodemQueuedWriteBytes = 0;
    let zmodemFlushTimer: ReturnType<typeof setTimeout> | null = null;
    let isZmodemTransferActive = false;
    let zmodemLastProgressAt = 0;

    const updateZmodemProgress = (next: ZmodemTransferProgress | null) => {
      if (!isMounted || isDisposed) return;
      setZmodemProgress(next);
    };

    const maybeUpdateZmodemProgress = (
      snapshot: ZmodemTransferProgress,
      force = false
    ) => {
      const now = Date.now();
      if (!force && now - zmodemLastProgressAt < 80) return;
      zmodemLastProgressAt = now;
      updateZmodemProgress(snapshot);
    };

    const normalizeZmodemDisplayBytes = (octets: ArrayLike<number>) => {
      const normalized: number[] = [];
      for (let i = 0; i < octets.length; i += 1) {
        const byte = octets[i];
        if (byte === 0x8a) {
          normalized.push(0x0a);
          continue;
        }
        normalized.push(byte);
      }
      return Uint8Array.from(normalized);
    };

    const writeBytesToPty = (octets: ArrayLike<number>) => {
      for (let i = 0; i < octets.length; i += 1) {
        zmodemOutboundBuffer.push(octets[i]);
      }

      const flushOutbound = () => {
        if (zmodemOutboundBuffer.length === 0) return;
        const payload = zmodemOutboundBuffer;
        zmodemOutboundBuffer = [];
        const payloadLen = payload.length;
        zmodemQueuedWriteBytes += payloadLen;

        zmodemWriteQueue = zmodemWriteQueue
          .then(() => invoke('pty_write_bytes', { sessionId, data: payload }))
          .then(() => {
            zmodemQueuedWriteBytes = Math.max(0, zmodemQueuedWriteBytes - payloadLen);
          })
          .catch((err) => {
            console.error('Failed to write ZMODEM bytes to PTY:', err);
            zmodemQueuedWriteBytes = Math.max(0, zmodemQueuedWriteBytes - payloadLen);
          });
      };

      if (zmodemOutboundBuffer.length >= 64 * 1024) {
        if (zmodemFlushTimer) {
          clearTimeout(zmodemFlushTimer);
          zmodemFlushTimer = null;
        }
        flushOutbound();
        return;
      }

      if (zmodemFlushTimer) return;
      zmodemFlushTimer = setTimeout(() => {
        zmodemFlushTimer = null;
        flushOutbound();
      }, 2);
    };

    const flushZmodemWrites = async () => {
      if (zmodemFlushTimer) {
        clearTimeout(zmodemFlushTimer);
        zmodemFlushTimer = null;
      }
      if (zmodemOutboundBuffer.length > 0) {
        const payload = zmodemOutboundBuffer;
        zmodemOutboundBuffer = [];
        const payloadLen = payload.length;
        zmodemQueuedWriteBytes += payloadLen;
        zmodemWriteQueue = zmodemWriteQueue
          .then(() => invoke('pty_write_bytes', { sessionId, data: payload }))
          .then(() => {
            zmodemQueuedWriteBytes = Math.max(0, zmodemQueuedWriteBytes - payloadLen);
          })
          .catch((err) => {
            console.error('Failed to write ZMODEM bytes to PTY:', err);
            zmodemQueuedWriteBytes = Math.max(0, zmodemQueuedWriteBytes - payloadLen);
          });
      }
      await zmodemWriteQueue;
    };

    const shouldRenderZmodemOutput = (octets: ArrayLike<number>) => {
      if (!isZmodemTransferActive) return true;
      if (octets.length <= 48) return true;

      let printable = 0;
      for (let i = 0; i < octets.length; i += 1) {
        const b = octets[i];
        if (b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e)) {
          printable += 1;
        }
      }
      return printable / octets.length > 0.85;
    };

    const sendZmodemUploadFiles = async (session: any, files: ZmodemUploadFile[]) => {
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      let bytesRemaining = files.reduce((sum, file) => sum + file.size, 0);
      let sentBytes = 0;
      let currentFileName = files[0]?.name ?? 'upload';
      let currentFileIndex = files.length > 0 ? 1 : 0;

      maybeUpdateZmodemProgress(
        {
          fileName: currentFileName,
          fileIndex: currentFileIndex,
          fileCount: files.length,
          sentBytes,
          totalBytes,
        },
        true
      );

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        currentFileName = file.name;
        currentFileIndex = i + 1;
        maybeUpdateZmodemProgress(
          {
            fileName: currentFileName,
            fileIndex: currentFileIndex,
            fileCount: files.length,
            sentBytes,
            totalBytes,
          },
          true
        );

        const transfer = await session.send_offer({
          name: file.name,
          size: file.size,
          mtime: new Date(file.last_modified_ms),
          files_remaining: files.length - i,
          bytes_remaining: bytesRemaining,
        });

        if (!transfer) {
          bytesRemaining -= file.size;
          sentBytes += file.size;
          maybeUpdateZmodemProgress(
            {
              fileName: currentFileName,
              fileIndex: currentFileIndex,
              fileCount: files.length,
              sentBytes,
              totalBytes,
            },
            true
          );
          continue;
        }

        let offset = 0;
        while (offset < file.size) {
          const readChunk = await invoke<number[]>('read_zmodem_upload_chunk', {
            path: file.path,
            offset,
            maxLen: 256 * 1024,
          });

          if (readChunk.length === 0) {
            break;
          }

          const payload = Uint8Array.from(readChunk);
          const packetSize = 8192;
          for (let packetOffset = 0; packetOffset < payload.length; packetOffset += packetSize) {
            const packet = payload.subarray(packetOffset, Math.min(packetOffset + packetSize, payload.length));
            transfer.send(packet);
          }

          offset += readChunk.length;
          sentBytes += readChunk.length;
          maybeUpdateZmodemProgress({
            fileName: currentFileName,
            fileIndex: currentFileIndex,
            fileCount: files.length,
            sentBytes,
            totalBytes,
          });

          if (zmodemQueuedWriteBytes >= 2 * 1024 * 1024) {
            await flushZmodemWrites();
          }
        }

        await flushZmodemWrites();
        await transfer.end();
        await flushZmodemWrites();
        bytesRemaining -= file.size;
      }

      await session.close();
      await flushZmodemWrites();
      maybeUpdateZmodemProgress(
        {
          fileName: currentFileName,
          fileIndex: files.length,
          fileCount: files.length,
          sentBytes: totalBytes,
          totalBytes,
        },
        true
      );
    };

    const beginZmodemSession = async (detection: any) => {
      const session = detection.confirm();
      activeZmodemSession = session;
      isZmodemTransferActive = true;

      session.on('session_end', () => {
        if (term && !(term as any).isDisposed) {
          term.write('\r\u001b[2K');
        }
        isZmodemTransferActive = false;
        updateZmodemProgress(null);
        if (activeZmodemSession === session) {
          activeZmodemSession = null;
        }
      });

      if (session.type === 'send') {
        try {
          const selected = await openFileDialog({
            title: 'Select files for rz upload',
            multiple: true,
            directory: false,
          });

          const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
          if (paths.length === 0) {
            await session.close();
            return;
          }

          const files = await invoke<ZmodemUploadFile[]>('prepare_zmodem_upload_files', { paths });
          if (files.length === 0) {
            await session.close();
            return;
          }

          await sendZmodemUploadFiles(session, files);
        } finally {
          isZmodemTransferActive = false;
          updateZmodemProgress(null);
          if (activeZmodemSession === session) {
            activeZmodemSession = null;
          }
        }
        return;
      }

      session.on('offer', (xfer: any) => {
        xfer
          .accept()
          .then(() => {
            const details = xfer.get_details();
            (Zmodem as any).Browser.save_to_disk(xfer.get_payloads(), details?.name ?? 'download.bin');
          })
          .catch((err: unknown) => {
            console.error('Failed to receive ZMODEM file:', err);
          });
      });

      session.start();
    };

    try {
      zmodemSentry = new (Zmodem as any).Sentry({
        to_terminal: (octets: ArrayLike<number>) => {
          if (term && !(term as any).isDisposed) {
            if (!shouldRenderZmodemOutput(octets)) {
              return;
            }
            term.write(normalizeZmodemDisplayBytes(octets));
          }
        },
        sender: (octets: ArrayLike<number>) => {
          writeBytesToPty(octets);
        },
        on_detect: (detection: any) => {
          beginZmodemSession(detection).catch((err) => {
            console.error('Failed to handle ZMODEM session:', err);
            isZmodemTransferActive = false;
            updateZmodemProgress(null);
            try {
              if (activeZmodemSession) {
                activeZmodemSession.abort();
              }
            } catch {
              // Ignore secondary abort errors.
            }
          });
        },
        on_retract: () => {
          // Detection retracted before confirmation; nothing to do.
        },
      });
    } catch (err) {
      console.error('Failed to initialize ZMODEM support:', err);
    }

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
    const unlistenPromise = listen<number[] | string>(`pty-output-${sessionId}`, (event) => {
      if (term && !(term as any).isDisposed) {
        if (typeof event.payload === 'string') {
          term.write(event.payload);
          return;
        }

        const chunk = Uint8Array.from(event.payload);
        if (zmodemSentry) {
          zmodemSentry.consume(chunk);
        } else {
          term.write(chunk);
        }
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

      if (activeZmodemSession) {
        try {
          activeZmodemSession.abort();
        } catch {
          // Ignore abort failures during disposal.
        }
        activeZmodemSession = null;
      }
      isZmodemTransferActive = false;
      updateZmodemProgress(null);
      if (zmodemFlushTimer) {
        clearTimeout(zmodemFlushTimer);
        zmodemFlushTimer = null;
      }
      zmodemOutboundBuffer = [];
      zmodemQueuedWriteBytes = 0;
      zmodemSentry = null;

      terminalPluginsRef.current?.dispose();
      terminalPluginsRef.current = null;

      // Clear timeouts and intervals
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

  const zmodemPercent = zmodemProgress
    ? Math.max(0, Math.min(100, Math.round((zmodemProgress.sentBytes / Math.max(zmodemProgress.totalBytes, 1)) * 100)))
    : 0;

  return (
    <TerminalContextMenu
      onCopy={handleCopy}
      onPaste={handlePaste}
      onSelectAll={handleSelectAll}
      onClear={handleClear}
      tabId={tabId}
      paneId={paneId}
    >
      <div
        ref={containerRef}
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
        {zmodemProgress && (
          <div
            className="absolute right-3 top-3 z-20 w-80 rounded-md border px-3 py-2 text-xs shadow"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              color: '#f4f4f5',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate" title={zmodemProgress.fileName}>{zmodemProgress.fileName}</span>
              <span>{zmodemPercent}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.18)' }}>
              <div
                className="h-full transition-[width] duration-100"
                style={{
                  width: `${zmodemPercent}%`,
                  backgroundColor: settings.theme.colors.green,
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between opacity-85">
              <span>{formatBytes(zmodemProgress.sentBytes)} / {formatBytes(zmodemProgress.totalBytes)}</span>
              <span>{zmodemProgress.fileIndex}/{zmodemProgress.fileCount}</span>
            </div>
          </div>
        )}
        {!isInitialized && (
          <div className="absolute inset-0 flex items-center justify-center app-text-muted">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-b-2 border-[color:var(--app-text-muted)] mx-auto mb-2"></div>
              <p>Initializing terminal...</p>
            </div>
          </div>
        )}
        <div ref={terminalRef} className="w-full h-full" />
      </div>
    </TerminalContextMenu>
  );
}
