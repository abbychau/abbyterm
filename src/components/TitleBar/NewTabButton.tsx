import { useState, useEffect } from 'react';
import { Plus, MonitorDot, ServerIcon } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '@/store/tabStore';
import { useSettingsStore } from '@/store/settingsStore';
import { v4 as uuidv4 } from 'uuid';

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
  const [, setIsOpen] = useState(false);

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
    <DropdownMenu.Root modal={false} onOpenChange={setIsOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          className="px-3 h-8 flex items-center justify-center app-hover transition-colors"
          aria-label="New connection"
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <Plus size={16} className="app-text" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[280px] app-surface-2 rounded-md shadow-lg p-1 border app-border z-50 max-h-[500px] overflow-y-auto"
          align="start"
          sideOffset={5}
        >
          <DropdownMenu.Item
            className="px-3 py-2 text-sm app-text app-hover outline-none cursor-pointer flex items-center gap-2"
            onSelect={handleNewLocalTab}
          >
            <MonitorDot size={16} />
            Local Terminal
          </DropdownMenu.Item>

          {sshHosts.length > 0 && (
            <>
              <DropdownMenu.Separator className="h-px my-1 bg-[color:var(--app-border)]" />
              <DropdownMenu.Label className="px-3 py-2 text-xs app-text-muted font-semibold">
                SSH CONNECTIONS
              </DropdownMenu.Label>
              {sshHosts.map((host) => (
                <DropdownMenu.Item
                  key={host.name}
                  className="px-3 py-2 text-sm app-text app-hover outline-none cursor-pointer flex items-center gap-2"
                  onSelect={() => handleNewSshTab(host)}
                >
                  <ServerIcon size={16} />
                  <div className="flex flex-col">
                    <span>{host.name}</span>
                    {host.hostname && host.hostname !== host.name && (
                      <span className="text-xs app-text-muted">{host.hostname}</span>
                    )}
                  </div>
                </DropdownMenu.Item>
              ))}
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
