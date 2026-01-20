import { useState, useEffect, useMemo } from 'react';
import { Cloud, RefreshCw, ServerIcon, ChevronRight } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '@/store/tabStore';
import { v4 as uuidv4 } from 'uuid';

interface KubernetesPod {
  name: string;
  namespace: string;
  status: string;
  ready: string;
}

export function K8sButton() {
  const { addTab } = useTabStore();
  const [kubernetesPods, setKubernetesPods] = useState<KubernetesPod[]>([]);
  const [isLoadingK8s, setIsLoadingK8s] = useState(false);
  const [k8sError, setK8sError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Load pods when dropdown opens
  useEffect(() => {
    if (isOpen) {
      loadKubernetesPods();
    }
  }, [isOpen]);

  const loadKubernetesPods = async () => {
    setIsLoadingK8s(true);
    setK8sError(null);
    try {
      const pods = await invoke<KubernetesPod[]>('get_kubernetes_pods');
      console.log('Kubernetes pods loaded:', pods);
      setKubernetesPods(pods);
    } catch (err) {
      console.error('Failed to load Kubernetes pods:', err);
      setK8sError(String(err));
      setKubernetesPods([]);
    } finally {
      setIsLoadingK8s(false);
    }
  };

  const handleNewKubernetesTab = async (pod: KubernetesPod) => {
    try {
      const tabId = uuidv4();

      // Create PTY session with kubectl exec command
      const sessionId = await invoke<string>('create_pty_session', {
        shell: '/bin/sh',
        args: null,
        cwd: null,
        cols: 80,
        rows: 24,
      });

      // Execute kubectl exec command
      const kubectlCommand = `kubectl exec -it -n ${pod.namespace} ${pod.name} -- /bin/sh\n`;
      await invoke('pty_write', {
        sessionId,
        data: kubectlCommand,
      });

      // Add tab to store
      addTab({
        id: tabId,
        title: `K8s: ${pod.namespace}/${pod.name}`,
        sessionId,
        type: 'local',
      });
    } catch (err) {
      console.error('Failed to connect to Kubernetes pod:', err);
      alert('Failed to connect to Kubernetes pod: ' + err);
    }
  };

  // Group pods by namespace
  const groupedPods = useMemo(() => {
    const namespaces: Record<string, KubernetesPod[]> = {};

    kubernetesPods.forEach((pod) => {
      if (!namespaces[pod.namespace]) {
        namespaces[pod.namespace] = [];
      }
      namespaces[pod.namespace].push(pod);
    });

    return namespaces;
  }, [kubernetesPods]);

  const renderPodItem = (pod: KubernetesPod) => (
    <DropdownMenu.Item
      key={`${pod.namespace}-${pod.name}`}
      className="px-3 py-2 text-sm text-gray-200 rounded hover:bg-gray-700 outline-none cursor-pointer flex items-center gap-2"
      onSelect={() => handleNewKubernetesTab(pod)}
    >
      <ServerIcon size={16} />
      <div className="flex flex-col flex-1 min-w-0">
        <span className="truncate">{pod.name}</span>
        <span className="text-xs text-gray-400 truncate">{pod.ready} • {pod.status}</span>
      </div>
    </DropdownMenu.Item>
  );

  return (
    <DropdownMenu.Root modal={false} onOpenChange={setIsOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          className="px-3 h-8 flex items-center justify-center hover:bg-gray-700 rounded transition-colors"
          aria-label="Kubernetes pods"
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <Cloud size={16} className="text-gray-300" />
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
              KUBERNETES PODS
            </DropdownMenu.Label>
            <button
              onClick={(e) => {
                e.stopPropagation();
                loadKubernetesPods();
              }}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              disabled={isLoadingK8s}
            >
              <RefreshCw size={12} className={`text-gray-400 ${isLoadingK8s ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {isLoadingK8s && (
            <div className="px-3 py-2 text-xs text-gray-500 italic">
              Loading...
            </div>
          )}
          {!isLoadingK8s && k8sError && (
            <div className="px-3 py-2 text-xs text-red-400">
              {k8sError}
            </div>
          )}
          {!isLoadingK8s && !k8sError && kubernetesPods.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500 italic">
              No pods found
            </div>
          )}
          {!isLoadingK8s && !k8sError && (
            <>
              {/* Render namespace groups as sub-menus */}
              {Object.entries(groupedPods).map(([namespace, pods]) => (
                <DropdownMenu.Sub key={namespace}>
                  <DropdownMenu.SubTrigger className="px-3 py-2 text-sm text-gray-200 rounded hover:bg-gray-700 outline-none cursor-pointer flex items-center gap-2">
                    <Cloud size={16} />
                    <span className="flex-1 truncate">{namespace}</span>
                    <span className="text-xs text-gray-500">({pods.length})</span>
                    <ChevronRight size={14} />
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent className="min-w-[280px] bg-gray-800 rounded-md shadow-lg p-1 border border-gray-700 z-50 max-h-[400px] overflow-y-auto">
                      {pods.map((pod) => renderPodItem(pod))}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
              ))}
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
