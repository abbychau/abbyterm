import { useState, useEffect, useMemo } from 'react';
import { Cloud, ServerIcon, Check, Network, Package, Copy } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '@/store/tabStore';
import { v4 as uuidv4 } from 'uuid';
import { useSettingsStore } from '@/store/settingsStore';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
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

interface KubernetesService {
  name: string;
  namespace: string;
  service_type: string;
  cluster_ip: string;
  external_ip: string;
  ports: string;
}

interface KubernetesDeployment {
  name: string;
  namespace: string;
  ready: string;
  up_to_date: string;
  available: string;
  age: string;
}

export function K8sButton() {
  const { addTab, activeTabId, tabs } = useTabStore();
  const settings = useSettingsStore((state) => state.settings);
  const [kubernetesPods, setKubernetesPods] = useState<KubernetesPod[]>([]);
  const [kubernetesServices, setKubernetesServices] = useState<KubernetesService[]>([]);
  const [kubernetesDeployments, setKubernetesDeployments] = useState<KubernetesDeployment[]>([]);
  const [kubernetesContexts, setKubernetesContexts] = useState<KubernetesContext[]>([]);
  const [isLoadingK8s, setIsLoadingK8s] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isLoadingDeployments, setIsLoadingDeployments] = useState(false);
  const [isLoadingContexts, setIsLoadingContexts] = useState(false);
  const [k8sError, setK8sError] = useState<string | null>(null);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [deploymentsError, setDeploymentsError] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [copiedResource, setCopiedResource] = useState<string | null>(null);

  const getKubectlExecutable = () => {
    const p = (settings.kubectlExecutablePath || '').trim();
    if (!p) return 'kubectl';
    if (/^[A-Za-z0-9_./-]+$/.test(p)) return p;
    return `'${p.replace(/'/g, `'"'"'`)}'`;
  };

  // Load all resources when dropdown opens
  useEffect(() => {
    if (isOpen) {
      loadAllKubernetesResources();
    }
  }, [isOpen]);

  const loadAllKubernetesResources = async () => {
    await Promise.all([
      loadKubernetesContexts(),
      loadKubernetesPods(),
      loadKubernetesServices(),
      loadKubernetesDeployments(),
    ]);
  };

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

  const loadKubernetesServices = async () => {
    setIsLoadingServices(true);
    setServicesError(null);
    try {
      const services = await invoke<KubernetesService[]>('get_kubernetes_services', {
        kubectlPath: settings.kubectlExecutablePath || null,
      });
      console.log('Kubernetes services loaded:', services);
      setKubernetesServices(services);
    } catch (err) {
      console.error('Failed to load Kubernetes services:', err);
      setServicesError('Failed to load services');
      setKubernetesServices([]);
    } finally {
      setIsLoadingServices(false);
    }
  };

  const loadKubernetesDeployments = async () => {
    setIsLoadingDeployments(true);
    setDeploymentsError(null);
    try {
      const deployments = await invoke<KubernetesDeployment[]>('get_kubernetes_deployments', {
        kubectlPath: settings.kubectlExecutablePath || null,
      });
      console.log('Kubernetes deployments loaded:', deployments);
      setKubernetesDeployments(deployments);
    } catch (err) {
      console.error('Failed to load Kubernetes deployments:', err);
      setDeploymentsError('Failed to load deployments');
      setKubernetesDeployments([]);
    } finally {
      setIsLoadingDeployments(false);
    }
  };

  const handleSwitchContext = async (contextName: string) => {
    try {
      await invoke('set_kubernetes_context', {
        kubectlPath: settings.kubectlExecutablePath || null,
        contextName,
      });
      // Reload all resources after switching
      await loadAllKubernetesResources();
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

  const getActiveTerminalSession = (): string | null => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (!activeTab) return null;

    const findFirstTerminalSessionId = (pane: any): string | null => {
      if (pane.type === 'terminal') {
        return pane.sessionId;
      } else if (pane.type === 'split') {
        for (const child of pane.children) {
          const sid = findFirstTerminalSessionId(child);
          if (sid) return sid;
        }
      }
      return null;
    };

    return findFirstTerminalSessionId(activeTab.rootPane);
  };

  const writeToActiveTerminal = async (command: string) => {
    const sessionId = getActiveTerminalSession();
    if (!sessionId) {
      alert('No active terminal found. Please open a terminal first.');
      return;
    }

    await invoke('pty_write', {
      sessionId,
      data: command + '\n',
    });
  };

  const handleDescribePod = async (pod: KubernetesPod) => {
    try {
      const kubectlBin = getKubectlExecutable();
      const command = `${kubectlBin} describe pod ${pod.name} -n ${pod.namespace}`;
      await writeToActiveTerminal(command);
    } catch (err) {
      console.error('Failed to run kubectl describe:', err);
      alert('Failed to run kubectl describe: ' + err);
    }
  };

  const handlePodLogs = async (pod: KubernetesPod, follow: boolean = false, tail?: number) => {
    try {
      const kubectlBin = getKubectlExecutable();
      let command = `${kubectlBin} logs ${pod.name} -n ${pod.namespace}`;
      if (follow) command += ' -f';
      if (tail) command += ` --tail=${tail}`;
      await writeToActiveTerminal(command);
    } catch (err) {
      console.error('Failed to view logs:', err);
      alert('Failed to view logs: ' + err);
    }
  };

  const handleRestartDeployment = async (deployment: KubernetesDeployment) => {
    try {
      const kubectlBin = getKubectlExecutable();
      const command = `${kubectlBin} rollout restart deployment ${deployment.name} -n ${deployment.namespace}`;
      await writeToActiveTerminal(command);
    } catch (err) {
      console.error('Failed to restart deployment:', err);
    }
  };

  const handleScaleDeployment = async (deployment: KubernetesDeployment) => {
    try {
      // Extract current replica count from the "ready" field (e.g., "2/3" -> suggest 3)
      const currentReplicas = deployment.ready.split('/')[1] || '1';
      const kubectlBin = getKubectlExecutable();
      // Insert the command with a placeholder that user can edit
      const command = `${kubectlBin} scale deployment ${deployment.name} --replicas=${currentReplicas} -n ${deployment.namespace}`;

      // Write the command but don't execute it - let user edit the replica count
      const sessionId = getActiveTerminalSession();
      if (!sessionId) {
        return;
      }

      await invoke('pty_write', {
        sessionId,
        data: command, // Don't add \n so user can edit
      });
    } catch (err) {
      console.error('Failed to scale deployment:', err);
    }
  };

  const handleDescribeDeployment = async (deployment: KubernetesDeployment) => {
    try {
      const kubectlBin = getKubectlExecutable();
      const command = `${kubectlBin} describe deployment ${deployment.name} -n ${deployment.namespace}`;
      await writeToActiveTerminal(command);
    } catch (err) {
      console.error('Failed to describe deployment:', err);
      alert('Failed to describe deployment: ' + err);
    }
  };

  const handlePortForward = async (service: KubernetesService) => {
    const portMapping = prompt(
      `Port forward ${service.name}\nEnter local:remote port (e.g., 8080:80)`,
      service.ports.split('/')[0].split(':')[0] || '8080:80'
    );

    if (portMapping === null) return;

    try {
      const kubectlBin = getKubectlExecutable();
      const command = `${kubectlBin} port-forward svc/${service.name} ${portMapping} -n ${service.namespace}`;
      await writeToActiveTerminal(command);
    } catch (err) {
      console.error('Failed to setup port forward:', err);
      alert('Failed to setup port forward: ' + err);
    }
  };

  const copyResourceName = async (name: string, type: string) => {
    try {
      await writeText(name);
      const resourceKey = `${type}-${name}`;
      setCopiedResource(resourceKey);

      // Clear the indicator after 1.5 seconds
      setTimeout(() => {
        setCopiedResource(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to copy resource name:', err);
    }
  };

  const renderPodItem = (pod: KubernetesPod) => {
    const resourceKey = `pod-${pod.name}`;
    const isCopied = copiedResource === resourceKey;

    return (
      <DropdownSub
        key={`${pod.namespace}-${pod.name}`}
        trigger={
          <>
            <ServerIcon size={16} />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="truncate">{pod.name}</span>
              <span className="text-xs app-text-muted truncate">{pod.ready} • {pod.status}</span>
            </div>
            {isCopied && (
              <Check
                size={14}
                className="text-[color:var(--app-success)] animate-pulse ml-2"
              />
            )}
          </>
        }
        onAuxClick={() => copyResourceName(pod.name, 'pod')}
      >
      <DropdownItem onSelect={() => handleNewKubernetesTab(pod)}>
        Open Terminal
      </DropdownItem>
      <DropdownItem onSelect={() => handleDescribePod(pod)}>
        Describe Pod
      </DropdownItem>
      <DropdownItem onSelect={() => handlePodLogs(pod, false)}>
        View Logs
      </DropdownItem>
      <DropdownItem onSelect={() => handlePodLogs(pod, true)}>
        Follow Logs
      </DropdownItem>
      <DropdownItem onSelect={() => handlePodLogs(pod, false, 100)}>
        Logs (Last 100)
      </DropdownItem>
    </DropdownSub>
    );
  };

  const handleDescribeService = async (service: KubernetesService) => {
    try {
      const kubectlBin = getKubectlExecutable();
      const command = `${kubectlBin} describe svc ${service.name} -n ${service.namespace}`;
      await writeToActiveTerminal(command);
    } catch (err) {
      console.error('Failed to run kubectl describe:', err);
      alert('Failed to run kubectl describe: ' + err);
    }
  };

  const renderServiceItem = (service: KubernetesService) => {
    const resourceKey = `service-${service.name}`;
    const isCopied = copiedResource === resourceKey;

    return (
      <DropdownSub
        key={`${service.namespace}-${service.name}`}
        trigger={
          <>
            <Network size={16} />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="truncate">{service.name}</span>
              <span className="text-xs app-text-muted truncate">
                {service.service_type} • {service.ports}
              </span>
            </div>
            {isCopied && (
              <Check
                size={14}
                className="text-[color:var(--app-success)] animate-pulse ml-2"
              />
            )}
          </>
        }
        onAuxClick={() => copyResourceName(service.name, 'service')}
      >
        <DropdownItem onSelect={() => handleDescribeService(service)}>
          Describe Service
        </DropdownItem>
        <DropdownItem onSelect={() => handlePortForward(service)}>
          Port Forward
        </DropdownItem>
      </DropdownSub>
    );
  };

  const renderDeploymentItem = (deployment: KubernetesDeployment) => {
    const resourceKey = `deployment-${deployment.name}`;
    const isCopied = copiedResource === resourceKey;

    return (
      <DropdownSub
        key={`${deployment.namespace}-${deployment.name}`}
        trigger={
          <>
            <Package size={16} />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="truncate">{deployment.name}</span>
              <span className="text-xs app-text-muted truncate">
                {deployment.ready} • {deployment.available}
              </span>
            </div>
            {isCopied && (
              <Check
                size={14}
                className="text-[color:var(--app-success)] animate-pulse ml-2"
              />
            )}
          </>
        }
        onAuxClick={() => copyResourceName(deployment.name, 'deployment')}
      >
        <DropdownItem onSelect={() => handleDescribeDeployment(deployment)}>
          Describe
        </DropdownItem>
        <DropdownItem onSelect={() => handleRestartDeployment(deployment)}>
          Restart
        </DropdownItem>
        <DropdownItem onSelect={() => handleScaleDeployment(deployment)}>
          Scale
        </DropdownItem>
      </DropdownSub>
    );
  };

  return (
    <Dropdown
      trigger={<Cloud size={16} className="app-text" />}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      ariaLabel="Kubernetes"
    >
      <DropdownHeader
        label="KUBERNETES RESOURCES"
        onRefresh={loadAllKubernetesResources}
        isRefreshing={isLoadingK8s || isLoadingServices || isLoadingDeployments || isLoadingContexts}
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

      {/* Services Submenu */}
      <DropdownSub
        triggerIcon={<Network size={16} />}
        triggerLabel="Services"
        triggerCount={kubernetesServices.length}
      >
        {isLoadingServices && <DropdownStateMessage type="loading" message="Loading..." />}

        {!isLoadingServices && servicesError && (
          <DropdownStateMessage type="error" message={servicesError} />
        )}

        {!isLoadingServices && !servicesError && kubernetesServices.length === 0 && (
          <DropdownStateMessage type="empty" message="No services found" />
        )}

        {!isLoadingServices && !servicesError && kubernetesServices.length > 0 && (
          <>
            {kubernetesServices.map((service) => renderServiceItem(service))}
          </>
        )}
      </DropdownSub>

      {/* Deployments Submenu */}
      <DropdownSub
        triggerIcon={<Package size={16} />}
        triggerLabel="Deployments"
        triggerCount={kubernetesDeployments.length}
      >
        {isLoadingDeployments && <DropdownStateMessage type="loading" message="Loading..." />}

        {!isLoadingDeployments && deploymentsError && (
          <DropdownStateMessage type="error" message={deploymentsError} />
        )}

        {!isLoadingDeployments && !deploymentsError && kubernetesDeployments.length === 0 && (
          <DropdownStateMessage type="empty" message="No deployments found" />
        )}

        {!isLoadingDeployments && !deploymentsError && kubernetesDeployments.length > 0 && (
          <>
            {kubernetesDeployments.map((deployment) => renderDeploymentItem(deployment))}
          </>
        )}
      </DropdownSub>

      {/* Pods Submenu */}
      <DropdownSub
        triggerIcon={<ServerIcon size={16} />}
        triggerLabel="Pods"
        triggerCount={kubernetesPods.length}
      >
        {isLoadingK8s && <DropdownStateMessage type="loading" message="Loading..." />}

        {!isLoadingK8s && k8sError && <DropdownStateMessage type="error" message={k8sError} />}

        {!isLoadingK8s && !k8sError && kubernetesPods.length === 0 && (
          <DropdownStateMessage type="empty" message="No pods found" />
        )}

        {!isLoadingK8s && !k8sError && (
          <>
            {/* If only one namespace, render pods directly. Otherwise, group by namespace */}
            {Object.entries(groupedPods).length === 1 ? (
              // Single namespace - render pods directly
              Object.values(groupedPods)[0].map((pod) => renderPodItem(pod))
            ) : (
              // Multiple namespaces - render namespace groups as sub-menus
              Object.entries(groupedPods).map(([namespace, pods]) => (
                <DropdownSub
                  key={namespace}
                  triggerIcon={<Cloud size={16} />}
                  triggerLabel={namespace}
                  triggerCount={pods.length}
                >
                  {pods.map((pod) => renderPodItem(pod))}
                </DropdownSub>
              ))
            )}
          </>
        )}
      </DropdownSub>
    </Dropdown>
  );
}
