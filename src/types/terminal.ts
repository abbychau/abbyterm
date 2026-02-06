export interface TerminalProps {
  sessionId: string;
  isActive?: boolean;
  tabId?: string;
  paneId?: string;
  isPrimaryPane?: boolean;
}

export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor?: string;
  cursorAccent?: string;
  selection?: string;
  black?: string;
  red?: string;
  green?: string;
  yellow?: string;
  blue?: string;
  magenta?: string;
  cyan?: string;
  white?: string;
  brightBlack?: string;
  brightRed?: string;
  brightGreen?: string;
  brightYellow?: string;
  brightBlue?: string;
  brightMagenta?: string;
  brightCyan?: string;
  brightWhite?: string;
}
