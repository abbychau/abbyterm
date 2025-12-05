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
            className="px-3 h-8 flex items-center justify-center hover:bg-gray-700 rounded transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Menu size={16} className="text-gray-300" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="min-w-[180px] bg-gray-800 rounded-md shadow-lg p-1 border border-gray-700 z-50">
            <DropdownMenu.Item
              className="px-3 py-2 text-sm text-gray-200 rounded hover:bg-gray-700 outline-none cursor-pointer"
              onSelect={() => setSettingsOpen(true)}
            >
              Settings
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="h-px bg-gray-700 my-1" />
            <DropdownMenu.Item
              className="px-3 py-2 text-sm text-gray-200 rounded hover:bg-gray-700 outline-none cursor-pointer"
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
