import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Dropdown, DropdownItem, DropdownSeparator } from './Dropdown/Dropdown';
import { SettingsPanel } from '../Settings/SettingsPanel';
import { AboutModal } from '../AboutModal';

export function MenuButton() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <Dropdown trigger={<Menu size={16} className="app-text" />} minWidth={180}>
        <DropdownItem onSelect={() => setSettingsOpen(true)}>Settings</DropdownItem>
        <DropdownSeparator />
        <DropdownItem onSelect={() => setAboutOpen(true)}>About</DropdownItem>
      </Dropdown>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AboutModal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}
