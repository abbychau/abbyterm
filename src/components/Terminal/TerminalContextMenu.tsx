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
          className="min-w-[220px] bg-[#1e1e1e] rounded-md overflow-hidden p-[5px] shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] border border-[#333] z-[9999]"
        >
          <ContextMenu.Item 
            className="group text-[13px] leading-none text-gray-200 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[highlighted]:bg-[#007acc] data-[highlighted]:text-white cursor-default"
            onSelect={onCopy}
          >
            Copy
            <div className="ml-auto pl-[20px] text-gray-400 group-data-[highlighted]:text-white text-[11px]">
              Ctrl+Shift+C
            </div>
          </ContextMenu.Item>
          <ContextMenu.Item 
            className="group text-[13px] leading-none text-gray-200 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[highlighted]:bg-[#007acc] data-[highlighted]:text-white cursor-default"
            onSelect={onPaste}
          >
            Paste
            <div className="ml-auto pl-[20px] text-gray-400 group-data-[highlighted]:text-white text-[11px]">
              Ctrl+Shift+V
            </div>
          </ContextMenu.Item>
          
          <ContextMenu.Separator className="h-[1px] bg-[#333] m-[5px]" />
          
          <ContextMenu.Item 
            className="group text-[13px] leading-none text-gray-200 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[highlighted]:bg-[#007acc] data-[highlighted]:text-white cursor-default"
            onSelect={onSelectAll}
          >
            Select All
          </ContextMenu.Item>
          <ContextMenu.Item 
            className="group text-[13px] leading-none text-gray-200 rounded-[3px] flex items-center h-[25px] px-[5px] relative pl-[25px] select-none outline-none data-[highlighted]:bg-[#007acc] data-[highlighted]:text-white cursor-default"
            onSelect={onClear}
          >
            Clear Terminal
            <div className="ml-auto pl-[20px] text-gray-400 group-data-[highlighted]:text-white text-[11px]">
              Ctrl+L
            </div>
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
