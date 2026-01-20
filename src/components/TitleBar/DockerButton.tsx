import { useState, useEffect, useMemo } from 'react';
import { Container, RefreshCw, ChevronRight } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '@/store/tabStore';
import { v4 as uuidv4 } from 'uuid';

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  project?: string;
}

export function DockerButton() {
  const { addTab } = useTabStore();
  const [dockerContainers, setDockerContainers] = useState<DockerContainer[]>([]);
  const [isLoadingDocker, setIsLoadingDocker] = useState(false);
  const [dockerError, setDockerError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

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
      const containers = await invoke<DockerContainer[]>('get_docker_containers');
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

      // Create PTY session with docker exec command
      const sessionId = await invoke<string>('create_pty_session', {
        shell: '/bin/sh',
        args: null,
        cwd: null,
        cols: 80,
        rows: 24,
      });

      // Execute docker exec command
      const dockerCommand = `docker exec -it ${container.id} /bin/sh\n`;
      await invoke('pty_write', {
        sessionId,
        data: dockerCommand,
      });

      // Add tab to store
      addTab({
        id: tabId,
        title: `Docker: ${container.name}`,
        sessionId,
        type: 'local',
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
    <DropdownMenu.Item
      key={container.id}
      className="px-3 py-2 text-sm text-gray-200 rounded hover:bg-gray-700 outline-none cursor-pointer flex items-center gap-2"
      onSelect={() => handleNewDockerTab(container)}
    >
      <Container size={16} />
      <div className="flex flex-col flex-1 min-w-0">
        <span className="truncate">{container.name}</span>
        <span className="text-xs text-gray-400 truncate">{container.image}</span>
      </div>
    </DropdownMenu.Item>
  );

  return (
    <DropdownMenu.Root modal={false} onOpenChange={setIsOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          className="px-3 h-8 flex items-center justify-center hover:bg-gray-700 rounded transition-colors"
          aria-label="Docker containers"
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <Container size={16} className="text-gray-300" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[280px] bg-gray-800 rounded-md shadow-lg p-1 border border-gray-700 z-50 max-h-[500px] overflow-y-auto"
          align="start"
          sideOffset={5}
        >
          <div className="px-3 py-2 flex items-center justify-between">
            <DropdownMenu.Label className="text-xs text-gray-400 font-semibold">
              DOCKER CONTAINERS
            </DropdownMenu.Label>
            <button
              onClick={(e) => {
                e.stopPropagation();
                loadDockerContainers();
              }}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              disabled={isLoadingDocker}
            >
              <RefreshCw size={12} className={`text-gray-400 ${isLoadingDocker ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {isLoadingDocker && (
            <div className="px-3 py-2 text-xs text-gray-500 italic">
              Loading...
            </div>
          )}
          {!isLoadingDocker && dockerError && (
            <div className="px-3 py-2 text-xs text-red-400">
              {dockerError}
            </div>
          )}
          {!isLoadingDocker && !dockerError && dockerContainers.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500 italic">
              No running containers
            </div>
          )}
          {!isLoadingDocker && !dockerError && (
            <>
              {/* Render project groups as sub-menus */}
              {Object.entries(groupedContainers.projects).map(([projectName, containers]) => (
                <DropdownMenu.Sub key={projectName}>
                  <DropdownMenu.SubTrigger className="px-3 py-2 text-sm text-gray-200 rounded hover:bg-gray-700 outline-none cursor-pointer flex items-center gap-2">
                    <Container size={16} />
                    <span className="flex-1 truncate">{projectName}</span>
                    <span className="text-xs text-gray-500">({containers.length})</span>
                    <ChevronRight size={14} />
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent className="min-w-[280px] bg-gray-800 rounded-md shadow-lg p-1 border border-gray-700 z-50 max-h-[400px] overflow-y-auto">
                      {containers.map((container) => renderContainerItem(container))}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
              ))}

              {/* Render standalone containers */}
              {groupedContainers.standalone.map((container) => renderContainerItem(container))}
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
