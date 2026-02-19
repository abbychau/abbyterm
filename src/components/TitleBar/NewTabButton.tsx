import { useState, useEffect } from 'react';
import { Plus, MonitorDot, ServerIcon } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '@/store/tabStore';
import { useSettingsStore } from '@/store/settingsStore';
import { v4 as uuidv4 } from 'uuid';
import {
  Dropdown,
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
} from './Dropdown/Dropdown';

interface SshHost {
  name: string;
  hostname?: string;
  user?: string;
  port?: number;
  identity_file?: string;
}

export function NewTabButton() {
  const { addTab } = useTabStore();
  const settings = useSettingsStore((state) => state.settings);
  const [sshHosts, setSshHosts] = useState<SshHost[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadSshHosts();
  }, []);

  const loadSshHosts = async () => {
    try {
      const hosts = await invoke<SshHost[]>('get_ssh_hosts');
      setSshHosts(hosts);
    } catch (err) {
      console.error('Failed to load SSH hosts:', err);
    }
  };

  const handleNewLocalTab = async () => {
    try {
      const tabId = uuidv4();

      // Create PTY session
      const sessionId = await invoke<string>('create_pty_session', {
        shell: null,
        args: null,
        cwd: settings.defaultCwd || null,
        cols: 80,
        rows: 24,
      });

      // Add tab to store with rootPane structure
      addTab({
        id: tabId,
        title: 'Local',
        sessionId,
        type: 'local',
        rootPane: {
          type: 'terminal',
          id: tabId,
          sessionId,
          title: 'Local',
          tabType: 'local',
        },
      });
    } catch (err) {
      console.error('Failed to create terminal:', err);
      alert('Failed to create terminal: ' + err);
    }
  };

  const handleNewSshTab = async (host: SshHost) => {
    try {
      const tabId = uuidv4();

      // Build SSH command
      const hostname = host.hostname || host.name;
      const port = host.port || 22;
      const user = host.user || '';

      let sshCommand = `ssh ${user ? `${user}@` : ''}${hostname}`;
      if (port !== 22) {
        sshCommand += ` -p ${port}`;
      }
      if (host.identity_file) {
        sshCommand += ` -i ${host.identity_file}`;
      }

      // Create PTY session with SSH command
      const sessionId = await invoke<string>('create_pty_session', {
        shell: '/bin/sh',
        args: null,
        cwd: null,
        cols: 80,
        rows: 24,
      });

      // Write SSH command to start connection
      await invoke('pty_write', {
        sessionId,
        data: sshCommand + '\n',
      });

      // Add tab to store with rootPane structure
      addTab({
        id: tabId,
        title: `SSH: ${host.name}`,
        sessionId,
        type: 'ssh',
        rootPane: {
          type: 'terminal',
          id: tabId,
          sessionId,
          title: `SSH: ${host.name}`,
          tabType: 'ssh',
        },
      });
    } catch (err) {
      console.error('Failed to create SSH connection:', err);
      alert('Failed to create SSH connection: ' + err);
    }
  };

  return (
    <Dropdown
      trigger={<Plus size={16} className="app-text" />}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      ariaLabel="New connection"
    >
      <DropdownItem onSelect={handleNewLocalTab} icon={<MonitorDot size={16} />}>
        Local Terminal
      </DropdownItem>

      {sshHosts.length > 0 && (
        <>
          <DropdownSeparator />
          <DropdownLabel>SSH CONNECTIONS</DropdownLabel>
          {sshHosts.map((host) => (
            <DropdownItem
              key={host.name}
              onSelect={() => handleNewSshTab(host)}
              icon={<ServerIcon size={16} />}
            >
              <div className="flex flex-col">
                <span>{host.name}</span>
                {host.hostname && host.hostname !== host.name && (
                  <span className="text-xs app-text-muted">{host.hostname}</span>
                )}
              </div>
            </DropdownItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}
