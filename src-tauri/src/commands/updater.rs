use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use reqwest::header::USER_AGENT;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sysinfo::System;
use tauri::Emitter;

use super::ezquake::read_exe_version;

// ─── Client definitions ────────────────────────────────────────────────────

/// Defines a QW client for update purposes — generic across ezQuake, unezQuake, etc.
pub struct ClientDef {
    pub name: &'static str,
    pub github_owner: &'static str,
    pub github_repo: &'static str,
    pub windows_asset: &'static str,
    pub exe_name: &'static str,
    pub snapshot_url: Option<&'static str>,
}

pub const EZQUAKE: ClientDef = ClientDef {
    name: "ezQuake",
    github_owner: "QW-Group",
    github_repo: "ezquake-source",
    windows_asset: "ezQuake-windows-x64.zip",
    exe_name: "ezquake.exe",
    snapshot_url: Some("https://builds.quakeworld.nu/ezquake/snapshots/windows/x64/"),
};

pub const UNEZQUAKE: ClientDef = ClientDef {
    name: "unezQuake",
    github_owner: "dusty-qw",
    github_repo: "unezquake",
    windows_asset: "unezQuake-windows-x64.zip",
    exe_name: "unezquake.exe",
    snapshot_url: None,
};

// Read-only projects — changelog browsing only, no install
pub const KTX: ClientDef = ClientDef {
    name: "KTX",
    github_owner: "QW-Group",
    github_repo: "ktx",
    windows_asset: "",
    exe_name: "",
    snapshot_url: None,
};

pub const MVDSV: ClientDef = ClientDef {
    name: "MVDSV",
    github_owner: "QW-Group",
    github_repo: "mvdsv",
    windows_asset: "",
    exe_name: "",
    snapshot_url: None,
};

fn get_client_def(name: &str) -> Result<&'static ClientDef, String> {
    match name.to_lowercase().as_str() {
        "ezquake" => Ok(&EZQUAKE),
        "unezquake" => Ok(&UNEZQUAKE),
        "ktx" => Ok(&KTX),
        "mvdsv" => Ok(&MVDSV),
        _ => Err(format!("Unknown client: {}", name)),
    }
}

// ─── Data structures ───────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct ReleaseNote {
    pub version: String,
    pub published_at: String,
    pub body: String,
    pub is_newer: bool,
}

#[derive(Serialize, Clone)]
pub struct SnapshotCommit {
    pub sha: String,
    pub message: String,
    pub date: String,
}

#[derive(Serialize, Clone)]
pub struct SnapshotInfo {
    pub available: bool,
    pub filename: String,
    pub date: String,
    pub commit: String,
    pub download_url: String,
    pub checksum_url: String,
    pub newer_than_stable: bool,
    pub commits_since_stable: Vec<SnapshotCommit>,
    pub ahead_by: u32,
}

#[derive(Serialize, Clone)]
pub struct UpdateCheckResult {
    pub update_available: bool,
    pub current_version: Option<String>,
    pub current_build: Option<String>,
    pub latest_version: String,
    pub download_url: String,
    pub checksums_url: Option<String>,
    pub release_notes: Vec<ReleaseNote>,
    pub channel: String,
    pub snapshot: Option<SnapshotInfo>,
}

#[derive(Serialize, Clone)]
pub struct UpdateProgress {
    pub stage: String,
    pub percent: Option<f64>,
    pub message: String,
}

#[derive(Serialize, Clone)]
pub struct UpdateResult {
    pub success: bool,
    pub new_version: Option<String>,
    pub backup_path: Option<String>,
    pub error: Option<String>,
}

// GitHub API response types
#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    published_at: Option<String>,
    body: Option<String>,
    assets: Vec<GitHubAsset>,
}

#[derive(Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

// ─── Helper functions ──────────────────────────────────────────────────────

/// Parse PE version "3.6.6.7947" into (semver "3.6.6", build "7947")
fn parse_pe_version(pe_version: &str) -> Option<(semver::Version, String)> {
    let parts: Vec<&str> = pe_version.split('.').collect();
    if parts.len() < 3 {
        return None;
    }
    let major: u64 = parts[0].parse().ok()?;
    let minor: u64 = parts[1].parse().ok()?;
    let patch: u64 = parts[2].parse().ok()?;
    let build = parts.get(3).unwrap_or(&"0").to_string();
    Some((semver::Version::new(major, minor, patch), build))
}

/// Fetch all releases from GitHub for a client
async fn fetch_github_releases(client: &ClientDef) -> Result<Vec<GitHubRelease>, String> {
    let url = format!(
        "https://api.github.com/repos/{}/{}/releases",
        client.github_owner, client.github_repo
    );

    let http = reqwest::Client::new();
    let resp = http
        .get(&url)
        .header(USER_AGENT, "slipgate-app/0.1")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if resp.status() == 403 {
        return Err("Rate limited by GitHub. Try again in a few minutes.".into());
    }
    if resp.status() == 404 {
        return Err("Repository not found.".into());
    }
    if !resp.status().is_success() {
        return Err(format!("GitHub API error: {}", resp.status()));
    }

    resp.json::<Vec<GitHubRelease>>()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {}", e))
}

/// Parse snapshot filename: "20260301-211256_b13f585_ezquake.exe" -> (date, commit)
fn parse_snapshot_filename(filename: &str) -> Option<(String, String)> {
    // Pattern: YYYYMMDD-HHMMSS_{commit}_{exename}.exe
    let parts: Vec<&str> = filename.splitn(3, '_').collect();
    if parts.len() < 2 {
        return None;
    }
    let date_part = parts[0]; // "20260301-211256"
    let commit = parts[1]; // "b13f585"

    // Parse date to readable format
    if date_part.len() >= 8 {
        let year = &date_part[0..4];
        let month = &date_part[4..6];
        let day = &date_part[6..8];
        let date = format!("{}-{}-{}", year, month, day);
        return Some((date, commit.to_string()));
    }
    None
}

/// Fetch commits between a stable tag and a snapshot commit via GitHub compare API
async fn fetch_commits_since_stable(
    client: &ClientDef,
    stable_tag: &str,
    snapshot_commit: &str,
) -> Result<(Vec<SnapshotCommit>, u32), String> {
    let url = format!(
        "https://api.github.com/repos/{}/{}/compare/{}...{}",
        client.github_owner, client.github_repo, stable_tag, snapshot_commit
    );

    let http = reqwest::Client::new();
    let resp = http
        .get(&url)
        .header(USER_AGENT, "slipgate-app/0.1")
        .send()
        .await
        .map_err(|e| format!("Compare API error: {}", e))?;

    if !resp.status().is_success() {
        return Ok((vec![], 0)); // Non-fatal — just show no commits
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Compare parse error: {}", e))?;

    let ahead_by = json["ahead_by"].as_u64().unwrap_or(0) as u32;

    let commits = json["commits"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|c| {
                    let sha = c["sha"]
                        .as_str()
                        .unwrap_or("")
                        .chars()
                        .take(7)
                        .collect::<String>();
                    let message = c["commit"]["message"]
                        .as_str()
                        .unwrap_or("")
                        .lines()
                        .next()
                        .unwrap_or("")
                        .to_string();
                    let date = c["commit"]["author"]["date"]
                        .as_str()
                        .unwrap_or("")
                        .to_string();
                    SnapshotCommit { sha, message, date }
                })
                .collect()
        })
        .unwrap_or_default();

    Ok((commits, ahead_by))
}

/// Scrape latest snapshot info from builds.quakeworld.nu directory listing
async fn fetch_latest_snapshot(
    client: &ClientDef,
    latest_stable_date: Option<&str>,
    latest_stable_tag: Option<&str>,
) -> Result<SnapshotInfo, String> {
    let base_url = client
        .snapshot_url
        .ok_or("No snapshot URL configured for this client")?;

    let http = reqwest::Client::new();
    let html = http
        .get(base_url)
        .header(USER_AGENT, "slipgate-app/0.1")
        .send()
        .await
        .map_err(|e| format!("Snapshot server unreachable: {}", e))?
        .text()
        .await
        .map_err(|e| format!("Failed to read snapshot listing: {}", e))?;

    // Parse all .exe links from the HTML directory listing
    // Links look like: href="20260301-211256_b13f585_ezquake.exe"
    let mut snapshots: Vec<String> = Vec::new();
    for part in html.split("href=\"") {
        if let Some(end) = part.find('"') {
            let href = &part[..end];
            if href.ends_with(".exe") && !href.ends_with(".md5") && href.contains('_') {
                snapshots.push(href.to_string());
            }
        }
    }

    if snapshots.is_empty() {
        return Err("No snapshots found.".into());
    }

    // Sort by name (date-based names sort chronologically)
    snapshots.sort();
    let latest = snapshots.last().unwrap();

    let (date, commit) = parse_snapshot_filename(latest)
        .ok_or_else(|| format!("Cannot parse snapshot filename: {}", latest))?;

    let download_url = format!("{}{}", base_url, latest);
    let checksum_url = format!("{}{}.md5", base_url, latest);

    // Check if snapshot is newer than latest stable release
    let newer_than_stable = latest_stable_date
        .map(|stable_date| {
            let stable_short = &stable_date[..10];
            date.as_str() > stable_short
        })
        .unwrap_or(true);

    // Fetch commits between stable tag and snapshot commit
    let (commits_since_stable, ahead_by) = if let Some(tag) = latest_stable_tag {
        fetch_commits_since_stable(client, tag, &commit)
            .await
            .unwrap_or((vec![], 0))
    } else {
        (vec![], 0)
    };

    Ok(SnapshotInfo {
        available: true,
        filename: latest.clone(),
        date,
        commit,
        download_url,
        checksum_url,
        newer_than_stable,
        commits_since_stable,
        ahead_by,
    })
}

/// Download checksums.txt and parse into a map of filename -> SHA-256 hex
async fn fetch_checksums(url: &str) -> Result<std::collections::HashMap<String, String>, String> {
    let http = reqwest::Client::new();
    let text = http
        .get(url)
        .header(USER_AGENT, "slipgate-app/0.1")
        .send()
        .await
        .map_err(|e| format!("Failed to download checksums: {}", e))?
        .text()
        .await
        .map_err(|e| format!("Failed to read checksums: {}", e))?;

    let mut map = std::collections::HashMap::new();
    for line in text.lines() {
        // Format: "hash  ./filename" or "hash  filename"
        let parts: Vec<&str> = line.splitn(2, char::is_whitespace).collect();
        if parts.len() == 2 {
            let hash = parts[0].trim();
            let filename = parts[1].trim().trim_start_matches("./");
            map.insert(filename.to_string(), hash.to_string());
        }
    }
    Ok(map)
}

/// Download a file with progress events emitted to the Tauri window
async fn download_with_progress(
    url: &str,
    dest: &Path,
    window: &tauri::Window,
) -> Result<u64, String> {
    use futures_util::StreamExt;

    let http = reqwest::Client::new();
    let resp = http
        .get(url)
        .header(USER_AGENT, "slipgate-app/0.1")
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Download failed with status: {}", resp.status()));
    }

    let total_size = resp.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut file = std::fs::File::create(dest)
        .map_err(|e| format!("Cannot create file {}: {}", dest.display(), e))?;

    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download interrupted: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Write error: {}", e))?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let percent = (downloaded as f64 / total_size as f64) * 100.0;
            let _ = window.emit(
                "update-progress",
                UpdateProgress {
                    stage: "downloading".into(),
                    percent: Some(percent),
                    message: format!(
                        "Downloading... {:.1} / {:.1} MB",
                        downloaded as f64 / 1_048_576.0,
                        total_size as f64 / 1_048_576.0
                    ),
                },
            );
        }
    }

    Ok(downloaded)
}

/// Verify SHA-256 checksum of a file
fn verify_sha256(file_path: &Path, expected_hex: &str) -> Result<bool, String> {
    let mut file =
        std::fs::File::open(file_path).map_err(|e| format!("Cannot open file: {}", e))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let n = file
            .read(&mut buffer)
            .map_err(|e| format!("Read error: {}", e))?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    let hash = format!("{:x}", hasher.finalize());
    Ok(hash == expected_hex.to_lowercase())
}

/// Verify MD5 checksum of a file
fn verify_md5(file_path: &Path, expected_hex: &str) -> Result<bool, String> {
    use md5::Digest as Md5Digest;
    let mut file =
        std::fs::File::open(file_path).map_err(|e| format!("Cannot open file: {}", e))?;
    let mut hasher = md5::Md5::new();
    let mut buffer = [0u8; 8192];
    loop {
        let n = file
            .read(&mut buffer)
            .map_err(|e| format!("Read error: {}", e))?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    let hash = format!("{:x}", hasher.finalize());
    Ok(hash == expected_hex.to_lowercase())
}

/// Extract the exe from a zip file
fn extract_exe_from_zip(zip_path: &Path, exe_name: &str, dest: &Path) -> Result<(), String> {
    let file =
        std::fs::File::open(zip_path).map_err(|e| format!("Cannot open zip: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Invalid zip file: {}", e))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Zip read error: {}", e))?;
        if entry.name().eq_ignore_ascii_case(exe_name) {
            let mut out = std::fs::File::create(dest)
                .map_err(|e| format!("Cannot create {}: {}", dest.display(), e))?;
            std::io::copy(&mut entry, &mut out)
                .map_err(|e| format!("Extract error: {}", e))?;
            return Ok(());
        }
    }

    Err(format!("'{}' not found in zip archive", exe_name))
}

/// Rename exe to include version: ezquake.exe → ezquake-3.6.6.exe
fn backup_exe(exe_path: &Path, version: &str) -> Result<PathBuf, String> {
    let parent = exe_path.parent().ok_or("Cannot determine exe directory")?;
    let stem = exe_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("ezquake");

    let backup_name = format!("{}-{}.exe", stem, version);
    let mut backup_path = parent.join(&backup_name);

    // If that name already exists, append a timestamp
    if backup_path.exists() {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let backup_name = format!("{}-{}-{}.exe", stem, version, ts);
        backup_path = parent.join(&backup_name);
    }

    std::fs::rename(exe_path, &backup_path).map_err(|e| {
        format!(
            "Cannot rename {} to {}: {}",
            exe_path.display(),
            backup_path.display(),
            e
        )
    })?;

    Ok(backup_path)
}

/// Check if a process with the given exe name is running
fn is_process_running(exe_name: &str) -> bool {
    let mut sys = System::new();
    sys.refresh_processes(
        sysinfo::ProcessesToUpdate::All,
        true,
    );
    let target = exe_name.to_lowercase();
    sys.processes().values().any(|p| {
        p.name()
            .to_str()
            .map(|n| n.to_lowercase() == target)
            .unwrap_or(false)
    })
}

// ─── Tauri commands ────────────────────────────────────────────────────────

/// Check for available updates (stable channel via GitHub Releases)
#[tauri::command]
pub async fn check_for_update(
    exe_path: String,
    client_name: String,
    channel: String,
) -> Result<UpdateCheckResult, String> {
    let client = get_client_def(&client_name)?;
    let path = Path::new(&exe_path);

    // Read current version from PE header
    let pe_version = read_exe_version(path);
    let (current_semver, current_build) = pe_version
        .as_ref()
        .and_then(|v| parse_pe_version(v))
        .map(|(sv, b)| (Some(sv), Some(b)))
        .unwrap_or((None, None));

    let current_version_str = current_semver.as_ref().map(|v| v.to_string());

    if channel == "stable" {
        let releases = fetch_github_releases(client).await?;

        if releases.is_empty() {
            return Err("No releases found.".into());
        }

        // Find latest release (first in list — GitHub returns newest first)
        let latest = &releases[0];
        let latest_version: semver::Version = latest
            .tag_name
            .parse()
            .map_err(|e| format!("Cannot parse version tag '{}': {}", latest.tag_name, e))?;

        // Find the download URL for the Windows asset
        let download_asset = latest
            .assets
            .iter()
            .find(|a| a.name == client.windows_asset)
            .ok_or_else(|| {
                format!(
                    "No Windows build found in release {} (expected {})",
                    latest.tag_name, client.windows_asset
                )
            })?;

        // Find checksums.txt URL
        let checksums_asset = latest
            .assets
            .iter()
            .find(|a| a.name == "checksums.txt");

        // Determine if update is available
        let update_available = match &current_semver {
            Some(current) => latest_version > *current,
            None => true, // Can't read version — assume update available
        };

        // Collect all release notes, tagging which are newer than current
        let mut release_notes = Vec::new();
        for release in &releases {
            if let Ok(rv) = release.tag_name.parse::<semver::Version>() {
                let is_newer = current_semver
                    .as_ref()
                    .map(|c| rv > *c)
                    .unwrap_or(true);
                release_notes.push(ReleaseNote {
                    version: release.tag_name.clone(),
                    published_at: release
                        .published_at
                        .clone()
                        .unwrap_or_default(),
                    body: release.body.clone().unwrap_or_default(),
                    is_newer,
                });
            }
        }

        // Also check for latest snapshot (non-blocking — don't fail if unavailable)
        let snapshot = if client.snapshot_url.is_some() {
            let stable_date = latest.published_at.as_deref();
            let stable_tag = Some(latest.tag_name.as_str());
            fetch_latest_snapshot(client, stable_date, stable_tag).await.ok()
        } else {
            None
        };

        Ok(UpdateCheckResult {
            update_available,
            current_version: current_version_str,
            current_build,
            latest_version: latest.tag_name.clone(),
            download_url: download_asset.browser_download_url.clone(),
            checksums_url: checksums_asset.map(|a| a.browser_download_url.clone()),
            release_notes,
            channel: "stable".into(),
            snapshot,
        })
    } else {
        // Snapshot-only check
        let snapshot = fetch_latest_snapshot(client, None, None).await?;
        Ok(UpdateCheckResult {
            update_available: true,
            current_version: current_version_str,
            current_build,
            latest_version: snapshot.filename.clone(),
            download_url: snapshot.download_url.clone(),
            checksums_url: Some(snapshot.checksum_url.clone()),
            release_notes: vec![],
            channel: "snapshot".into(),
            snapshot: Some(snapshot),
        })
    }
}

/// Download and install an update
#[tauri::command]
pub async fn download_and_install_update(
    exe_path: String,
    client_name: String,
    channel: String,
    download_url: String,
    checksums_url: Option<String>,
    window: tauri::Window,
) -> Result<UpdateResult, String> {
    let client_def = get_client_def(&client_name)?;
    let exe = Path::new(&exe_path);
    let exe_dir = exe
        .parent()
        .ok_or("Cannot determine exe directory")?;

    // 1. Check if running
    if is_process_running(client_def.exe_name) {
        return Err(format!(
            "{} is currently running. Close it before updating.",
            client_def.name
        ));
    }

    // 2. Download to temp file in same directory (ensures same-fs rename)
    let temp_download = exe_dir.join(".slipgate-update-download.tmp");
    let _ = window.emit(
        "update-progress",
        UpdateProgress {
            stage: "downloading".into(),
            percent: Some(0.0),
            message: "Starting download...".into(),
        },
    );

    if let Err(e) = download_with_progress(&download_url, &temp_download, &window).await {
        let _ = std::fs::remove_file(&temp_download);
        return Err(e);
    }

    // 3. Verify checksum
    let _ = window.emit(
        "update-progress",
        UpdateProgress {
            stage: "verifying".into(),
            percent: None,
            message: "Verifying download...".into(),
        },
    );

    if channel == "stable" {
        if let Some(ref cs_url) = checksums_url {
            match fetch_checksums(cs_url).await {
                Ok(checksums) => {
                    if let Some(expected) = checksums.get(client_def.windows_asset) {
                        match verify_sha256(&temp_download, expected) {
                            Ok(true) => {} // checksum OK
                            Ok(false) => {
                                let _ = std::fs::remove_file(&temp_download);
                                return Err(
                                    "Checksum verification failed. Download may be corrupted."
                                        .into(),
                                );
                            }
                            Err(e) => {
                                let _ = std::fs::remove_file(&temp_download);
                                return Err(format!("Checksum verification error: {}", e));
                            }
                        }
                    }
                }
                Err(_) => {
                    // Could not fetch checksums — continue without verification
                }
            }
        }
    }

    // 4. Extract exe from zip (stable) or use directly (snapshot)
    let new_exe_temp = exe_dir.join(".slipgate-update-exe.tmp");
    if channel == "stable" {
        let _ = window.emit(
            "update-progress",
            UpdateProgress {
                stage: "installing".into(),
                percent: None,
                message: "Extracting update...".into(),
            },
        );
        if let Err(e) = extract_exe_from_zip(&temp_download, client_def.exe_name, &new_exe_temp) {
            let _ = std::fs::remove_file(&temp_download);
            let _ = std::fs::remove_file(&new_exe_temp);
            return Err(e);
        }
        let _ = std::fs::remove_file(&temp_download);
    } else {
        // Snapshot: downloaded file is the exe itself
        std::fs::rename(&temp_download, &new_exe_temp)
            .map_err(|e| format!("Failed to prepare update: {}", e))?;
    }

    // 5. Backup current exe
    let _ = window.emit(
        "update-progress",
        UpdateProgress {
            stage: "backing_up".into(),
            percent: None,
            message: "Backing up current version...".into(),
        },
    );

    // Read current version for backup filename
    let current_version = read_exe_version(exe);
    let version_for_backup = current_version
        .as_ref()
        .and_then(|v| parse_pe_version(v))
        .map(|(sv, _)| sv.to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let backup_path = match backup_exe(exe, &version_for_backup) {
        Ok(p) => p,
        Err(e) => {
            // Cannot backup — restore state and abort
            let _ = std::fs::remove_file(&new_exe_temp);
            return Err(format!("Cannot backup current exe: {}", e));
        }
    };

    // 6. Move new exe into place
    let _ = window.emit(
        "update-progress",
        UpdateProgress {
            stage: "installing".into(),
            percent: None,
            message: "Installing new version...".into(),
        },
    );

    // Target path: canonical name in the same directory
    let target_path = exe_dir.join(client_def.exe_name);
    if let Err(e) = std::fs::rename(&new_exe_temp, &target_path) {
        // Install failed — restore backup
        let _ = std::fs::rename(&backup_path, exe);
        let _ = std::fs::remove_file(&new_exe_temp);
        return Err(format!("Failed to install new version: {}", e));
    }

    // 7. Read new version to confirm
    let new_version = read_exe_version(&target_path);
    let new_version_str = new_version
        .as_ref()
        .and_then(|v| parse_pe_version(v))
        .map(|(sv, _)| sv.to_string());

    let _ = window.emit(
        "update-progress",
        UpdateProgress {
            stage: "done".into(),
            percent: Some(100.0),
            message: format!(
                "Updated to {}",
                new_version_str.as_deref().unwrap_or("new version")
            ),
        },
    );

    Ok(UpdateResult {
        success: true,
        new_version: new_version_str,
        backup_path: Some(backup_path.to_string_lossy().into_owned()),
        error: None,
    })
}

/// Check if a client exe is currently running
#[tauri::command]
pub fn check_client_running(exe_name: Option<String>) -> bool {
    let name = exe_name.as_deref().unwrap_or("ezquake.exe");
    is_process_running(name)
}

/// Fetch release changelog for a client
#[tauri::command]
pub async fn get_release_changelog(
    client_name: String,
    from_version: Option<String>,
) -> Result<Vec<ReleaseNote>, String> {
    let client = get_client_def(&client_name)?;
    let releases = fetch_github_releases(client).await?;

    let from_semver = from_version
        .as_ref()
        .and_then(|v| v.parse::<semver::Version>().ok());

    let mut notes = Vec::new();
    for release in &releases {
        if let Ok(rv) = release.tag_name.parse::<semver::Version>() {
            let dominated = from_semver
                .as_ref()
                .map(|from| rv > *from)
                .unwrap_or(true);
            if dominated {
                notes.push(ReleaseNote {
                    version: release.tag_name.clone(),
                    published_at: release.published_at.clone().unwrap_or_default(),
                    body: release.body.clone().unwrap_or_default(),
                    is_newer: true,
                });
            }
        }
    }
    Ok(notes)
}
