import * as ContextMenu from '@radix-ui/react-context-menu';
import { ReactNode } from 'react';

interface TerminalContextMenuProps {
  children: ReactNode;
  onCopy: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onClear: () => void;
}

export function TerminalContextMenu({ 
  children, 
  onCopy, 
  onPaste, 
  onSelectAll,
  onClear 
}: TerminalContextMenuProps) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger className="w-full h-full block">
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content 
          className="min-w-[220px] app-surface-2 overflow-hidden p-[5px] shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] border app-border z-[9999]"
        >
          <ContextMenu.Item 
            className="group text-[13px] leading-none app-text flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none cursor-default data-[highlighted]:bg-[color:var(--app-accent)] data-[highlighted]:text-[color:var(--app-text)]"
            onSelect={onCopy}
          >
            Copy
            <div className="ml-auto pl-[20px] app-text-muted group-data-[highlighted]:text-[color:var(--app-text)] text-[11px]">
              Ctrl+Shift+C
            </div>
          </ContextMenu.Item>
          <ContextMenu.Item 
            className="group text-[13px] leading-none app-text flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none cursor-default data-[highlighted]:bg-[color:var(--app-accent)] data-[highlighted]:text-[color:var(--app-text)]"
            onSelect={onPaste}
          >
            Paste
            <div className="ml-auto pl-[20px] app-text-muted group-data-[highlighted]:text-[color:var(--app-text)] text-[11px]">
              Ctrl+Shift+V
            </div>
          </ContextMenu.Item>
          
          <ContextMenu.Separator className="h-px w-full my-1 bg-[color:var(--app-border)]" />
          
          <ContextMenu.Item 
            className="group text-[13px] leading-none app-text flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none cursor-default data-[highlighted]:bg-[color:var(--app-accent)] data-[highlighted]:text-[color:var(--app-text)]"
            onSelect={onSelectAll}
          >
            Select All
          </ContextMenu.Item>
          <ContextMenu.Item 
            className="group text-[13px] leading-none app-text flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none cursor-default data-[highlighted]:bg-[color:var(--app-accent)] data-[highlighted]:text-[color:var(--app-text)]"
            onSelect={onClear}
          >
            Clear Terminal
            <div className="ml-auto pl-[20px] app-text-muted group-data-[highlighted]:text-[color:var(--app-text)] text-[11px]">
              Ctrl+L
            </div>
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
