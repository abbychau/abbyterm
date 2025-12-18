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

    // Try to find in PATH
    if let Ok(output) = std::process::Command::new("which").arg(cmd).output() {
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

#[tauri::command]
pub async fn get_docker_containers() -> Result<Vec<DockerContainer>, String> {
    let docker_cmd = find_command("docker");

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
pub async fn get_kubernetes_pods() -> Result<Vec<KubernetesPod>, String> {
    let kubectl_cmd = find_command("kubectl");

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
