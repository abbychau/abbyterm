import { useState } from 'react';
import { Menu } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { SettingsPanel } from '../Settings/SettingsPanel';
import { AboutModal } from '../AboutModal';

export function MenuButton() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            className="px-3 h-8 flex items-center justify-center app-hover  transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Menu size={16} className="app-text" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="min-w-[180px] app-surface-2 shadow-lg p-1 border app-border z-50">
            <DropdownMenu.Item
              className="px-3 py-2 text-sm app-text  app-hover outline-none cursor-pointer"
              onSelect={() => setSettingsOpen(true)}
            >
              Settings
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="h-px my-1 bg-[color:var(--app-border)]" />
            <DropdownMenu.Item
              className="px-3 py-2 text-sm app-text  app-hover outline-none cursor-pointer"
              onSelect={() => setAboutOpen(true)}
            >
              About
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AboutModal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}
