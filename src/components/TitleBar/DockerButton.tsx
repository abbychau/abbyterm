import { useState, useEffect, useMemo } from 'react';
import { Container } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '@/store/tabStore';
import { v4 as uuidv4 } from 'uuid';
import { useSettingsStore } from '@/store/settingsStore';
import {
  Dropdown,
  DropdownItem,
  DropdownHeader,
  DropdownStateMessage,
  DropdownSub,
} from './Dropdown/Dropdown';

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  project?: string;
}

export function DockerButton() {
  const { addTab } = useTabStore();
  const settings = useSettingsStore((state) => state.settings);
  const [dockerContainers, setDockerContainers] = useState<DockerContainer[]>([]);
  const [isLoadingDocker, setIsLoadingDocker] = useState(false);
  const [dockerError, setDockerError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const getDockerExecutable = () => {
    const p = (settings.dockerExecutablePath || '').trim();
    if (!p) return 'docker';
    // Basic /bin/sh safe quoting for paths with spaces.
    if (/^[A-Za-z0-9_./-]+$/.test(p)) return p;
    return `'${p.replace(/'/g, `'"'"'`)}'`;
  };

  const getHostShellForExec = () => (settings.shell || '/bin/sh').trim() || '/bin/sh';

  const getHostShellArgsForExec = (shellPath: string) => {
    // macOS GUI apps often have a limited PATH; a login shell helps load user PATH.
    if (shellPath.endsWith('/bash') || shellPath.endsWith('/zsh')) return ['-l'];
    return null;
  };

  const maybePrefixPathForDocker = () => {
    // Helps Docker be found on macOS (Homebrew + Docker Desktop), and is harmless elsewhere.
    // We only do this when user didn't provide an explicit docker path.
    const p = (settings.dockerExecutablePath || '').trim();
    if (p) return '';

    const extra = ['/usr/local/bin', '/opt/homebrew/bin', '/Applications/Docker.app/Contents/Resources/bin'];
    return `export PATH="$PATH:${extra.join(':')}"; `;
  };

  // Load containers when dropdown opens
  useEffect(() => {
    if (isOpen) {
      loadDockerContainers();
    }
  }, [isOpen]);

  const loadDockerContainers = async () => {
    setIsLoadingDocker(true);
    setDockerError(null);
    try {
      const containers = await invoke<DockerContainer[]>('get_docker_containers', {
        dockerPath: settings.dockerExecutablePath || null,
      });
      console.log('Docker containers loaded:', containers);
      setDockerContainers(containers);
    } catch (err) {
      console.error('Failed to load Docker containers:', err);
      setDockerError(String(err));
      setDockerContainers([]);
    } finally {
      setIsLoadingDocker(false);
    }
  };

  const handleNewDockerTab = async (container: DockerContainer) => {
    try {
      const tabId = uuidv4();

      const hostShell = getHostShellForExec();
      const hostArgs = getHostShellArgsForExec(hostShell);

      // Create PTY session with docker exec command
      const sessionId = await invoke<string>('create_pty_session', {
        shell: hostShell,
        args: hostArgs,
        cwd: null,
        cols: 80,
        rows: 24,
      });

      // Execute docker exec command
      const dockerBin = getDockerExecutable();
      const dockerCommand = `${maybePrefixPathForDocker()}${dockerBin} exec -it ${container.id} /bin/sh\n`;
      await invoke('pty_write', {
        sessionId,
        data: dockerCommand,
      });

      // Add tab to store with rootPane structure
      addTab({
        id: tabId,
        title: `Docker: ${container.name}`,
        sessionId,
        type: 'local',
        rootPane: {
          type: 'terminal',
          id: tabId,
          sessionId,
          title: `Docker: ${container.name}`,
          tabType: 'local',
        },
      });
    } catch (err) {
      console.error('Failed to connect to Docker container:', err);
      alert('Failed to connect to Docker container: ' + err);
    }
  };

  // Group containers by project
  const groupedContainers = useMemo(() => {
    const projects: Record<string, DockerContainer[]> = {};
    const standalone: DockerContainer[] = [];

    dockerContainers.forEach((container) => {
      if (container.project) {
        if (!projects[container.project]) {
          projects[container.project] = [];
        }
        projects[container.project].push(container);
      } else {
        standalone.push(container);
      }
    });

    return { projects, standalone };
  }, [dockerContainers]);

  const renderContainerItem = (container: DockerContainer) => (
    <DropdownItem
      key={container.id}
      onSelect={() => handleNewDockerTab(container)}
      icon={<Container size={16} />}
    >
      <div className="flex flex-col flex-1 min-w-0">
        <span className="truncate">{container.name}</span>
        <span className="text-xs app-text-muted truncate">{container.image}</span>
      </div>
    </DropdownItem>
  );

  return (
    <Dropdown
      trigger={<Container size={16} className="app-text" />}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      ariaLabel="Docker containers"
    >
      <DropdownHeader
        label="DOCKER CONTAINERS"
        onRefresh={loadDockerContainers}
        isRefreshing={isLoadingDocker}
      />

      {isLoadingDocker && <DropdownStateMessage type="loading" />}

      {!isLoadingDocker && dockerError && <DropdownStateMessage type="error" message={dockerError} />}

      {!isLoadingDocker && !dockerError && dockerContainers.length === 0 && (
        <DropdownStateMessage type="empty" message="No running containers" />
      )}

      {!isLoadingDocker && !dockerError && (
        <>
          {/* Render project groups as sub-menus */}
          {Object.entries(groupedContainers.projects).map(([projectName, containers]) => (
            <DropdownSub
              key={projectName}
              triggerIcon={<Container size={16} />}
              triggerLabel={projectName}
              triggerCount={containers.length}
            >
              {containers.map((container) => renderContainerItem(container))}
            </DropdownSub>
          ))}

          {/* Render standalone containers */}
          {groupedContainers.standalone.map((container) => renderContainerItem(container))}
        </>
      )}
    </Dropdown>
  );
}
