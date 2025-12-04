use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshHost {
    pub name: String,
    pub hostname: Option<String>,
    pub user: Option<String>,
    pub port: Option<u16>,
    pub identity_file: Option<String>,
}

pub fn parse_ssh_config() -> Result<Vec<SshHost>> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/root".to_string());
    let config_path = PathBuf::from(home).join(".ssh/config");

    if !config_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(config_path)?;
    let mut hosts = Vec::new();
    let mut current_host: Option<SshHost> = None;
    let mut current_props: HashMap<String, String> = HashMap::new();

    for line in content.lines() {
        let line = line.trim();

        // Skip comments and empty lines
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        // Split by whitespace
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }

        let key = parts[0].to_lowercase();
        let value = parts[1..].join(" ");

        if key == "host" {
            // Save previous host if exists
            if let Some(host) = current_host.take() {
                hosts.push(host);
            }

            // Start new host
            // Skip wildcard hosts
            if !value.contains('*') && !value.contains('?') {
                current_host = Some(SshHost {
                    name: value.clone(),
                    hostname: None,
                    user: None,
                    port: None,
                    identity_file: None,
                });
                current_props.clear();
            }
        } else if current_host.is_some() {
            // Store properties for current host
            current_props.insert(key.clone(), value.clone());

            // Update current host with properties
            if let Some(ref mut host) = current_host {
                match key.as_str() {
                    "hostname" => host.hostname = Some(value),
                    "user" => host.user = Some(value),
                    "port" => host.port = value.parse().ok(),
                    "identityfile" => {
                        // Expand tilde
                        let expanded = if value.starts_with("~/") {
                            let home = std::env::var("HOME").unwrap_or_else(|_| "/root".to_string());
                            value.replacen("~", &home, 1)
                        } else {
                            value
                        };
                        host.identity_file = Some(expanded);
                    }
                    _ => {}
                }
            }
        }
    }

    // Don't forget the last host
    if let Some(host) = current_host {
        hosts.push(host);
    }

    Ok(hosts)
}
