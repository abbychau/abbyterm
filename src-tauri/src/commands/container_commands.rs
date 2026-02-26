use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::time::{timeout, Duration};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerContainer {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String,
    pub project: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KubernetesPod {
    pub name: String,
    pub namespace: String,
    pub status: String,
    pub ready: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KubernetesContext {
    pub name: String,
    pub cluster: String,
    pub user: String,
    pub namespace: Option<String>,
    pub is_current: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KubernetesService {
    pub name: String,
    pub namespace: String,
    pub service_type: String,
    pub cluster_ip: String,
    pub external_ip: String,
    pub ports: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KubernetesDeployment {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub up_to_date: String,
    pub available: String,
    pub age: String,
}

fn find_command(cmd: &str) -> String {
    // Common locations for kubectl and docker
    let common_paths = vec![
        format!("/usr/local/bin/{}", cmd),
        format!("/usr/bin/{}", cmd),
        format!("/opt/homebrew/bin/{}", cmd),
        format!("/home/linuxbrew/.linuxbrew/bin/{}", cmd),
    ];

    // Check if command exists in common paths
    for path in &common_paths {
        if Path::new(path).exists() {
            return path.clone();
        }
    }

    // Try to find in PATH using shell to ensure proper PATH is loaded
    // Use login shell to get the full PATH environment
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    if let Ok(output) = std::process::Command::new(&shell)
        .arg("-l")
        .arg("-c")
        .arg(format!("which {}", cmd))
        .output()
    {
        if output.status.success() {
            if let Ok(path) = String::from_utf8(output.stdout) {
                let path = path.trim();
                if !path.is_empty() {
                    return path.to_string();
                }
            }
        }
    }

    // Fall back to just the command name
    cmd.to_string()
}

fn resolve_command(cmd: &str, override_path: Option<String>) -> String {
    if let Some(p) = override_path {
        let trimmed = p.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    find_command(cmd)
}

#[tauri::command]
pub async fn check_kubectl_available(kubectl_path: Option<String>) -> bool {
    let kubectl_cmd = resolve_command("kubectl", kubectl_path);
    let output = timeout(
        Duration::from_secs(3),
        tokio::process::Command::new(&kubectl_cmd)
            .arg("version")
            .arg("--client")
            .output(),
    )
    .await;

    match output {
        Ok(Ok(out)) => out.status.success(),
        _ => false,
    }
}

#[tauri::command]
pub async fn check_docker_available(docker_path: Option<String>) -> bool {
    let docker_cmd = resolve_command("docker", docker_path);
    let output = timeout(
        Duration::from_secs(3),
        tokio::process::Command::new(&docker_cmd)
            .arg("ps")
            .arg("--format")
            .arg("{{.ID}}")
            .output(),
    )
    .await;

    match output {
        Ok(Ok(out)) => out.status.success(),
        _ => false,
    }
}

#[tauri::command]
pub async fn get_docker_containers(docker_path: Option<String>) -> Result<Vec<DockerContainer>, String> {
    let docker_cmd = resolve_command("docker", docker_path);

    let output = timeout(
        Duration::from_secs(10),
        tokio::process::Command::new(&docker_cmd)
            .arg("ps")
            .arg("--format")
            .arg("{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Label \"com.docker.compose.project\"}}")
            .output()
    )
    .await
    .map_err(|_| "Docker command timed out".to_string())?
    .map_err(|e| format!("Failed to execute docker ps ({}): {}", docker_cmd, e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Docker command failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let containers: Vec<DockerContainer> = stdout
        .lines()
        .filter(|line| !line.is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 4 {
                let project = if parts.len() >= 5 && !parts[4].is_empty() {
                    Some(parts[4].to_string())
                } else {
                    None
                };

                Some(DockerContainer {
                    id: parts[0].to_string(),
                    name: parts[1].to_string(),
                    image: parts[2].to_string(),
                    status: parts[3].to_string(),
                    project,
                })
            } else {
                None
            }
        })
        .collect();

    Ok(containers)
}

#[tauri::command]
pub async fn get_kubernetes_pods(kubectl_path: Option<String>) -> Result<Vec<KubernetesPod>, String> {
    let kubectl_cmd = resolve_command("kubectl", kubectl_path);

    // Get current namespace from context with timeout
    let current_namespace = match timeout(
        Duration::from_secs(3),
        tokio::process::Command::new(&kubectl_cmd)
            .arg("config")
            .arg("view")
            .arg("--minify")
            .arg("--output")
            .arg("jsonpath={..namespace}")
            .output()
    )
    .await
    {
        Ok(Ok(output)) => String::from_utf8(output.stdout)
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "default".to_string()),
        _ => "default".to_string(),
    };

    // Get pods with timeout
    let output = timeout(
        Duration::from_secs(10),
        tokio::process::Command::new(&kubectl_cmd)
            .arg("get")
            .arg("pods")
            .arg("--no-headers")
            .output()
    )
    .await
    .map_err(|_| "Kubectl command timed out. Check your cluster connection.".to_string())?
    .map_err(|e| format!("Failed to execute kubectl ({}): {}", kubectl_cmd, e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Kubectl command failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let pods: Vec<KubernetesPod> = stdout
        .lines()
        .filter(|line| !line.is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            // Format: NAME READY STATUS RESTARTS AGE
            if parts.len() >= 3 {
                Some(KubernetesPod {
                    name: parts[0].to_string(),
                    ready: parts[1].to_string(),
                    status: parts[2].to_string(),
                    namespace: current_namespace.clone(),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(pods)
}

#[tauri::command]
pub async fn get_kubernetes_contexts(kubectl_path: Option<String>) -> Result<Vec<KubernetesContext>, String> {
    let kubectl_cmd = resolve_command("kubectl", kubectl_path);

    // Get current context
    let current_context = match timeout(
        Duration::from_secs(3),
        tokio::process::Command::new(&kubectl_cmd)
            .arg("config")
            .arg("current-context")
            .output()
    )
    .await
    {
        Ok(Ok(output)) if output.status.success() => {
            String::from_utf8(output.stdout)
                .ok()
                .map(|s| s.trim().to_string())
        }
        _ => None,
    };

    // Get all contexts
    let output = timeout(
        Duration::from_secs(10),
        tokio::process::Command::new(&kubectl_cmd)
            .arg("config")
            .arg("get-contexts")
            .arg("-o")
            .arg("name")
            .output()
    )
    .await
    .map_err(|_| "Kubectl command timed out".to_string())?
    .map_err(|e| format!("Failed to execute kubectl ({}): {}", kubectl_cmd, e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Kubectl command failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let context_names: Vec<String> = stdout
        .lines()
        .filter(|line| !line.is_empty())
        .map(|line| line.trim().to_string())
        .collect();

    // Get detailed info for each context
    let mut contexts = Vec::new();
    for name in context_names {
        let is_current = current_context.as_ref().map_or(false, |c| c == &name);

        // Get context details
        let details_output = timeout(
            Duration::from_secs(3),
            tokio::process::Command::new(&kubectl_cmd)
                .arg("config")
                .arg("view")
                .arg("-o")
                .arg(format!("jsonpath={{.contexts[?(@.name==\"{}\")]}}{{\"\\n\"}}", name))
                .output()
        )
        .await;

        let (cluster, user, namespace) = match details_output {
            Ok(Ok(output)) if output.status.success() => {
                let json_str = String::from_utf8_lossy(&output.stdout);
                // Parse basic info from the JSON output
                let cluster = json_str.split("\"cluster\":\"").nth(1)
                    .and_then(|s| s.split("\"").next())
                    .unwrap_or("")
                    .to_string();
                let user = json_str.split("\"user\":\"").nth(1)
                    .and_then(|s| s.split("\"").next())
                    .unwrap_or("")
                    .to_string();
                let namespace = json_str.split("\"namespace\":\"").nth(1)
                    .and_then(|s| s.split("\"").next())
                    .map(|s| s.to_string());
                (cluster, user, namespace)
            }
            _ => (String::new(), String::new(), None),
        };

        contexts.push(KubernetesContext {
            name,
            cluster,
            user,
            namespace,
            is_current,
        });
    }

    Ok(contexts)
}

#[tauri::command]
pub async fn set_kubernetes_context(kubectl_path: Option<String>, context_name: String) -> Result<(), String> {
    let kubectl_cmd = resolve_command("kubectl", kubectl_path);

    let output = timeout(
        Duration::from_secs(10),
        tokio::process::Command::new(&kubectl_cmd)
            .arg("config")
            .arg("use-context")
            .arg(&context_name)
            .output()
    )
    .await
    .map_err(|_| "Kubectl command timed out".to_string())?
    .map_err(|e| format!("Failed to execute kubectl: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to switch context: {}", stderr));
    }

    Ok(())
}

#[tauri::command]
pub async fn get_kubernetes_services(kubectl_path: Option<String>) -> Result<Vec<KubernetesService>, String> {
    let kubectl_cmd = resolve_command("kubectl", kubectl_path);

    // Get current namespace from context
    let current_namespace = match timeout(
        Duration::from_secs(3),
        tokio::process::Command::new(&kubectl_cmd)
            .arg("config")
            .arg("view")
            .arg("--minify")
            .arg("--output")
            .arg("jsonpath={..namespace}")
            .output()
    )
    .await
    {
        Ok(Ok(output)) => String::from_utf8(output.stdout)
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "default".to_string()),
        _ => "default".to_string(),
    };

    // Get services with timeout
    let output = timeout(
        Duration::from_secs(10),
        tokio::process::Command::new(&kubectl_cmd)
            .arg("get")
            .arg("services")
            .arg("--no-headers")
            .output()
    )
    .await
    .map_err(|_| "Kubectl command timed out. Check your cluster connection.".to_string())?
    .map_err(|e| format!("Failed to execute kubectl ({}): {}", kubectl_cmd, e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Kubectl command failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let services: Vec<KubernetesService> = stdout
        .lines()
        .filter(|line| !line.is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            // Format: NAME TYPE CLUSTER-IP EXTERNAL-IP PORT(S) AGE
            if parts.len() >= 5 {
                Some(KubernetesService {
                    name: parts[0].to_string(),
                    service_type: parts[1].to_string(),
                    cluster_ip: parts[2].to_string(),
                    external_ip: parts[3].to_string(),
                    ports: parts[4].to_string(),
                    namespace: current_namespace.clone(),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(services)
}

#[tauri::command]
pub async fn get_kubernetes_deployments(kubectl_path: Option<String>) -> Result<Vec<KubernetesDeployment>, String> {
    let kubectl_cmd = resolve_command("kubectl", kubectl_path);

    // Get current namespace from context
    let current_namespace = match timeout(
        Duration::from_secs(3),
        tokio::process::Command::new(&kubectl_cmd)
            .arg("config")
            .arg("view")
            .arg("--minify")
            .arg("--output")
            .arg("jsonpath={..namespace}")
            .output()
    )
    .await
    {
        Ok(Ok(output)) => String::from_utf8(output.stdout)
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "default".to_string()),
        _ => "default".to_string(),
    };

    // Get deployments with timeout
    let output = timeout(
        Duration::from_secs(10),
        tokio::process::Command::new(&kubectl_cmd)
            .arg("get")
            .arg("deployments")
            .arg("--no-headers")
            .output()
    )
    .await
    .map_err(|_| "Kubectl command timed out. Check your cluster connection.".to_string())?
    .map_err(|e| format!("Failed to execute kubectl ({}): {}", kubectl_cmd, e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Kubectl command failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let deployments: Vec<KubernetesDeployment> = stdout
        .lines()
        .filter(|line| !line.is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            // Format: NAME READY UP-TO-DATE AVAILABLE AGE
            if parts.len() >= 5 {
                Some(KubernetesDeployment {
                    name: parts[0].to_string(),
                    ready: parts[1].to_string(),
                    up_to_date: parts[2].to_string(),
                    available: parts[3].to_string(),
                    age: parts[4].to_string(),
                    namespace: current_namespace.clone(),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(deployments)
}

#[tauri::command]
pub async fn restart_kubernetes_deployment(
    kubectl_path: Option<String>,
    deployment_name: String,
    namespace: String,
) -> Result<String, String> {
    let kubectl_cmd = resolve_command("kubectl", kubectl_path);

    let output = timeout(
        Duration::from_secs(30),
        tokio::process::Command::new(&kubectl_cmd)
            .arg("rollout")
            .arg("restart")
            .arg("deployment")
            .arg(&deployment_name)
            .arg("-n")
            .arg(&namespace)
            .output()
    )
    .await
    .map_err(|_| "Kubectl command timed out".to_string())?
    .map_err(|e| format!("Failed to execute kubectl: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to restart deployment: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}

#[tauri::command]
pub async fn scale_kubernetes_deployment(
    kubectl_path: Option<String>,
    deployment_name: String,
    namespace: String,
    replicas: i32,
) -> Result<String, String> {
    let kubectl_cmd = resolve_command("kubectl", kubectl_path);

    let output = timeout(
        Duration::from_secs(30),
        tokio::process::Command::new(&kubectl_cmd)
            .arg("scale")
            .arg("deployment")
            .arg(&deployment_name)
            .arg(format!("--replicas={}", replicas))
            .arg("-n")
            .arg(&namespace)
            .output()
    )
    .await
    .map_err(|_| "Kubectl command timed out".to_string())?
    .map_err(|e| format!("Failed to execute kubectl: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to scale deployment: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}
