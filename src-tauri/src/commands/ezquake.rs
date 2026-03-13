use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

// ============================================================
// Config parser
// ============================================================

/// Known ezQuake cvar defaults (only the ones we care about).
fn default_cvars() -> HashMap<&'static str, &'static str> {
    HashMap::from([
        ("sensitivity", "12"),
        ("m_yaw", "0.022"),
        ("m_pitch", "0.022"),
        ("m_accel", "0"),
        ("fov", "90"),
        ("default_fov", "90"),
        ("vid_fullscreen", "1"),
        ("vid_usedesktopres", "1"),
        ("vid_width", "0"),
        ("vid_height", "0"),
        ("vid_displayfrequency", "0"),
        ("vid_win_width", "0"),
        ("vid_win_height", "0"),
        ("vid_conwidth", "0"),
        ("vid_conheight", "0"),
        ("cl_maxfps", "0"),
        ("name", "player"),
        ("in_raw", "1"),
        ("freelook", "1"),
        ("r_mode", "-1"),
    ])
}

/// Parse an ezQuake config file into a map of cvar → value.
/// Format: `cvar_name  "value"` or `cvar_name  value`
/// Lines starting with // are comments. Commands like bind/alias are ignored.
fn parse_config(content: &str) -> HashMap<String, String> {
    let mut cvars = HashMap::new();
    let skip_commands = [
        "bind", "unbind", "unbindall", "alias", "unaliasall",
        "exec", "set", "tp_pickup", "tp_took", "tp_point",
        "filter", "mapgroup", "skygroup", "floodprot",
        "hud_recalculate", "sb_sourceunmarkall", "sb_sourcemark",
    ];

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("//") || trimmed.starts_with("////") {
            continue;
        }
        // Skip +/- commands (like -moveup, -attack)
        if trimmed.starts_with('+') || trimmed.starts_with('-') {
            continue;
        }

        // Split into first token and rest
        let mut parts = trimmed.splitn(2, char::is_whitespace);
        let key = match parts.next() {
            Some(k) => k,
            None => continue,
        };

        // Skip known commands that aren't cvars
        let key_lower = key.to_lowercase();
        if skip_commands.iter().any(|&cmd| key_lower == cmd) {
            continue;
        }

        if let Some(rest) = parts.next() {
            let value = rest.trim();
            // Strip surrounding quotes if present
            let value = if value.starts_with('"') && value.ends_with('"') && value.len() >= 2 {
                &value[1..value.len() - 1]
            } else {
                value
            };
            cvars.insert(key.to_string(), value.to_string());
        }
    }

    cvars
}

/// Parsed ezQuake settings that we care about.
#[derive(Serialize, Clone)]
pub struct EzQuakeConfig {
    pub player_name: String,
    pub sensitivity: f64,
    pub m_yaw: f64,
    pub m_pitch: f64,
    pub m_accel: f64,
    pub fov: f64,
    pub in_raw: bool,
    pub vid_usedesktopres: bool,
    pub vid_width: u32,
    pub vid_height: u32,
    pub vid_displayfrequency: u32,
    pub cl_maxfps: u32,
    pub raw_cvars: HashMap<String, String>,
}

fn get_cvar<'a>(parsed: &'a HashMap<String, String>, defaults: &'a HashMap<&str, &str>, key: &str) -> &'a str {
    parsed.get(key).map(|s| s.as_str()).unwrap_or_else(|| defaults.get(key).copied().unwrap_or(""))
}

fn build_config(parsed: HashMap<String, String>) -> EzQuakeConfig {
    let defaults = default_cvars();

    let sensitivity = get_cvar(&parsed, &defaults, "sensitivity").parse::<f64>().unwrap_or(12.0);
    let m_yaw = get_cvar(&parsed, &defaults, "m_yaw").parse::<f64>().unwrap_or(0.022);
    let m_pitch = get_cvar(&parsed, &defaults, "m_pitch").parse::<f64>().unwrap_or(0.022);
    let m_accel = get_cvar(&parsed, &defaults, "m_accel").parse::<f64>().unwrap_or(0.0);

    // fov: prefer default_fov if set (it's the "real" fov), fall back to fov
    let fov_str = if parsed.contains_key("default_fov") {
        get_cvar(&parsed, &defaults, "default_fov")
    } else {
        get_cvar(&parsed, &defaults, "fov")
    };
    let fov = fov_str.parse::<f64>().unwrap_or(90.0);

    let in_raw = get_cvar(&parsed, &defaults, "in_raw") != "0";
    let vid_usedesktopres = get_cvar(&parsed, &defaults, "vid_usedesktopres") != "0";
    let vid_fullscreen = get_cvar(&parsed, &defaults, "vid_fullscreen") != "0";

    // Determine effective playing resolution.
    // See docs/EZQUAKE-RESOLUTION.md for full source code analysis.
    //
    // Fullscreen: vid_width/vid_height always reflect the actual res
    //   (ezQuake auto-sets them even when vid_usedesktopres=1)
    // Windowed: vid_win_width/vid_win_height are the window dimensions
    let (vid_width, vid_height) = if vid_fullscreen {
        let w = get_cvar(&parsed, &defaults, "vid_width").parse::<u32>().unwrap_or(0);
        let h = get_cvar(&parsed, &defaults, "vid_height").parse::<u32>().unwrap_or(0);
        (w, h) // 0,0 means desktop res (frontend falls back to detected desktop res)
    } else {
        let w = get_cvar(&parsed, &defaults, "vid_win_width").parse::<u32>().unwrap_or(0);
        let h = get_cvar(&parsed, &defaults, "vid_win_height").parse::<u32>().unwrap_or(0);
        (w, h)
    };

    let vid_displayfrequency = get_cvar(&parsed, &defaults, "vid_displayfrequency")
        .parse::<u32>().unwrap_or(0);
    let cl_maxfps = get_cvar(&parsed, &defaults, "cl_maxfps")
        .parse::<u32>().unwrap_or(0);

    let player_name = get_cvar(&parsed, &defaults, "name").to_string();

    EzQuakeConfig {
        player_name,
        sensitivity,
        m_yaw,
        m_pitch,
        m_accel,
        fov,
        in_raw,
        vid_usedesktopres,
        vid_width,
        vid_height,
        vid_displayfrequency,
        cl_maxfps,
        raw_cvars: parsed,
    }
}

// ============================================================
// Path resolution
// ============================================================

/// Given the path to ezquake.exe, derive the config directory.
/// ezQuake stores configs in `<exe_dir>/ezquake/configs/`
fn config_dir_from_exe(exe_path: &Path) -> PathBuf {
    exe_path.parent().unwrap_or(Path::new(".")).join("ezquake").join("configs")
}

/// Validate that a path points to a real ezQuake executable.
fn validate_exe(path: &Path) -> bool {
    if !path.exists() || !path.is_file() {
        return false;
    }
    let name = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
    name.contains("ezquake") || name.contains("fteqw")
}

// ============================================================
// Tauri commands
// ============================================================

/// Validate an ezQuake exe path and return info about it.
#[derive(Serialize)]
pub struct EzQuakeInstallation {
    pub exe_path: String,
    pub config_dir: String,
    pub config_files: Vec<String>,
    pub valid: bool,
}

#[tauri::command]
pub fn validate_ezquake_path(exe_path: String) -> EzQuakeInstallation {
    let path = PathBuf::from(&exe_path);

    if !validate_exe(&path) {
        return EzQuakeInstallation {
            exe_path,
            config_dir: String::new(),
            config_files: Vec::new(),
            valid: false,
        };
    }

    let cfg_dir = config_dir_from_exe(&path);
    let config_files = if cfg_dir.exists() {
        std::fs::read_dir(&cfg_dir)
            .ok()
            .map(|entries| {
                entries
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().extension().map_or(false, |ext| ext == "cfg"))
                    .map(|e| e.file_name().to_string_lossy().to_string())
                    .collect()
            })
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    EzQuakeInstallation {
        exe_path,
        config_dir: cfg_dir.to_string_lossy().to_string(),
        config_files,
        valid: true,
    }
}

/// Read and parse an ezQuake config file.
#[tauri::command]
pub fn read_ezquake_config(exe_path: String, config_name: String) -> Result<EzQuakeConfig, String> {
    let path = PathBuf::from(&exe_path);
    if !validate_exe(&path) {
        return Err("Invalid ezQuake path".into());
    }

    let cfg_path = config_dir_from_exe(&path).join(&config_name);
    if !cfg_path.exists() {
        return Err(format!("Config file not found: {}", cfg_path.display()));
    }

    // Read as bytes and convert lossy — ezQuake configs may contain
    // non-UTF-8 bytes (QW color codes in player names, etc.)
    let bytes = std::fs::read(&cfg_path)
        .map_err(|e| format!("Failed to read config: {}", e))?;
    let content = String::from_utf8_lossy(&bytes).to_string();

    let parsed = parse_config(&content);
    Ok(build_config(parsed))
}

/// Launch ezQuake with optional parameters.
#[derive(Deserialize)]
pub struct LaunchOptions {
    pub exe_path: String,
    pub action: Option<String>,    // "connect", "observe", "join"
    pub server: Option<String>,    // "ip:port"
    pub extra_args: Option<Vec<String>>,
}

#[tauri::command]
pub fn launch_ezquake(options: LaunchOptions) -> Result<(), String> {
    let path = PathBuf::from(&options.exe_path);
    if !validate_exe(&path) {
        return Err("Invalid ezQuake path".into());
    }

    let mut cmd = std::process::Command::new(&path);

    // Set working directory to the exe's parent (ezQuake expects this)
    if let Some(parent) = path.parent() {
        cmd.current_dir(parent);
    }

    // Add server connection args
    if let (Some(action), Some(server)) = (&options.action, &options.server) {
        match action.as_str() {
            "connect" => { cmd.arg(format!("+connect {}", server)); }
            "observe" => { cmd.arg(format!("+observe {}", server)); }
            "join" => { cmd.arg(format!("+join {}", server)); }
            _ => {}
        }
    }

    // Add any extra args
    if let Some(args) = &options.extra_args {
        for arg in args {
            cmd.arg(arg);
        }
    }

    cmd.spawn().map_err(|e| format!("Failed to launch ezQuake: {}", e))?;
    Ok(())
}
