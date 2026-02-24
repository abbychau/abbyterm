import { useState, useEffect, useMemo } from 'react';
import { Cloud, ServerIcon, Check } from 'lucide-react';
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

interface KubernetesPod {
  name: string;
  namespace: string;
  status: string;
  ready: string;
}

interface KubernetesContext {
  name: string;
  cluster: string;
  user: string;
  namespace: string | null;
  is_current: boolean;
}

export function K8sButton() {
  const { addTab } = useTabStore();
  const settings = useSettingsStore((state) => state.settings);
  const [kubernetesPods, setKubernetesPods] = useState<KubernetesPod[]>([]);
  const [kubernetesContexts, setKubernetesContexts] = useState<KubernetesContext[]>([]);
  const [isLoadingK8s, setIsLoadingK8s] = useState(false);
  const [isLoadingContexts, setIsLoadingContexts] = useState(false);
  const [k8sError, setK8sError] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const getKubectlExecutable = () => {
    const p = (settings.kubectlExecutablePath || '').trim();
    if (!p) return 'kubectl';
    if (/^[A-Za-z0-9_./-]+$/.test(p)) return p;
    return `'${p.replace(/'/g, `'"'"'`)}'`;
  };

  // Load contexts and pods when dropdown opens
  useEffect(() => {
    if (isOpen) {
      loadKubernetesContexts();
      loadKubernetesPods();
    }
  }, [isOpen]);

  const loadKubernetesContexts = async () => {
    setIsLoadingContexts(true);
    setContextError(null);
    try {
      const contexts = await invoke<KubernetesContext[]>('get_kubernetes_contexts', {
        kubectlPath: settings.kubectlExecutablePath || null,
      });
      console.log('Kubernetes contexts loaded:', contexts);
      setKubernetesContexts(contexts);
    } catch (err) {
      console.error('Failed to load Kubernetes contexts:', err);
      setContextError('Failed to load contexts');
      setKubernetesContexts([]);
    } finally {
      setIsLoadingContexts(false);
    }
  };

  const loadKubernetesPods = async () => {
    setIsLoadingK8s(true);
    setK8sError(null);
    try {
      const pods = await invoke<KubernetesPod[]>('get_kubernetes_pods', {
        kubectlPath: settings.kubectlExecutablePath || null,
      });
      console.log('Kubernetes pods loaded:', pods);
      setKubernetesPods(pods);
    } catch (err) {
      console.error('Failed to load Kubernetes pods:', err);
      const errorStr = String(err);

      // Extract user-friendly error message
      let friendlyError = 'Failed to connect to Kubernetes cluster';

      if (errorStr.includes('connection refused')) {
        friendlyError = 'Cannot connect to cluster - is Kubernetes running?';
      } else if (errorStr.includes('kubectl not found') || errorStr.includes('executable file not found')) {
        friendlyError = 'kubectl not found - please install kubectl';
      } else if (errorStr.includes('Unauthorized') || errorStr.includes('authentication')) {
        friendlyError = 'Authentication failed - check kubectl config';
      } else if (errorStr.includes('Kubectl command failed')) {
        // Extract the first meaningful line from kubectl errors
        const lines = errorStr.split('\n');
        const connectionError = lines.find((l: string) => l.includes('connection refused') || l.includes('connect:'));
        if (connectionError) {
          friendlyError = 'Cannot connect to cluster - is Kubernetes running?';
        }
      }

      setK8sError(friendlyError);
      setKubernetesPods([]);
    } finally {
      setIsLoadingK8s(false);
    }
  };

  const handleSwitchContext = async (contextName: string) => {
    try {
      await invoke('set_kubernetes_context', {
        kubectlPath: settings.kubectlExecutablePath || null,
        contextName,
      });
      // Reload both contexts and pods after switching
      await loadKubernetesContexts();
      await loadKubernetesPods();
    } catch (err) {
      console.error('Failed to switch context:', err);
      alert('Failed to switch context: ' + err);
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
      const kubectlBin = getKubectlExecutable();
      const kubectlCommand = `${kubectlBin} exec -it -n ${pod.namespace} ${pod.name} -- /bin/sh\n`;
      await invoke('pty_write', {
        sessionId,
        data: kubectlCommand,
      });

      // Add tab to store with rootPane structure
      addTab({
        id: tabId,
        title: `K8s: ${pod.namespace}/${pod.name}`,
        sessionId,
        type: 'local',
        rootPane: {
          type: 'terminal',
          id: tabId,
          sessionId,
          title: `K8s: ${pod.namespace}/${pod.name}`,
          tabType: 'local',
        },
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
    <DropdownItem
      key={`${pod.namespace}-${pod.name}`}
      onSelect={() => handleNewKubernetesTab(pod)}
      icon={<ServerIcon size={16} />}
    >
      <div className="flex flex-col flex-1 min-w-0">
        <span className="truncate">{pod.name}</span>
        <span className="text-xs app-text-muted truncate">{pod.ready} • {pod.status}</span>
      </div>
    </DropdownItem>
  );

  return (
    <Dropdown
      trigger={<Cloud size={16} className="app-text" />}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      ariaLabel="Kubernetes"
    >
      <DropdownHeader
        label="KUBERNETES PODS"
        onRefresh={loadKubernetesPods}
        isRefreshing={isLoadingK8s}
      />

      {/* Contexts Submenu */}
      <DropdownSub
        triggerIcon={<Cloud size={16} />}
        triggerLabel="Contexts"
        triggerCount={kubernetesContexts.length}
      >
        {isLoadingContexts && <DropdownStateMessage type="loading" message="Loading..." />}

        {!isLoadingContexts && contextError && (
          <DropdownStateMessage type="error" message={contextError} />
        )}

        {!isLoadingContexts && !contextError && kubernetesContexts.length === 0 && (
          <DropdownStateMessage type="empty" message="No contexts found" />
        )}

        {!isLoadingContexts && !contextError && kubernetesContexts.length > 0 && (
          <>
            {kubernetesContexts.map((context) => (
              <DropdownItem
                key={context.name}
                onSelect={() => handleSwitchContext(context.name)}
                icon={context.is_current ? <Check size={16} className="text-[color:var(--app-accent)]" /> : <div className="w-4" />}
                className={context.is_current ? 'bg-[color:var(--app-hover)]' : ''}
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="truncate font-medium">{context.name}</span>
                  <span className="text-xs app-text-muted truncate">
                    {context.cluster}
                    {context.namespace && ` • ${context.namespace}`}
                  </span>
                </div>
              </DropdownItem>
            ))}
          </>
        )}
      </DropdownSub>

      {isLoadingK8s && <DropdownStateMessage type="loading" />}

      {!isLoadingK8s && k8sError && <DropdownStateMessage type="error" message={k8sError} />}

      {!isLoadingK8s && !k8sError && kubernetesPods.length === 0 && (
        <DropdownStateMessage type="empty" message="No pods found" />
      )}

      {!isLoadingK8s && !k8sError && (
        <>
          {/* Render namespace groups as sub-menus */}
          {Object.entries(groupedPods).map(([namespace, pods]) => (
            <DropdownSub
              key={namespace}
              triggerIcon={<Cloud size={16} />}
              triggerLabel={namespace}
              triggerCount={pods.length}
            >
              {pods.map((pod) => renderPodItem(pod))}
            </DropdownSub>
          ))}
        </>
      )}
    </Dropdown>
  );
}
