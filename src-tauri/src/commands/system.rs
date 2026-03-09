use serde::Serialize;
use sysinfo::System;

#[derive(Serialize)]
pub struct CpuInfo {
    pub model: String,
    pub cores: usize,
    pub threads: usize,
}

#[derive(Serialize)]
pub struct GpuInfo {
    pub model: String,
    pub vram_mb: Option<u64>,
    pub driver_version: Option<String>,
}

#[derive(Serialize)]
pub struct RamInfo {
    pub total_gb: f64,
}

#[derive(Serialize)]
pub struct OsInfo {
    pub name: String,
    pub version: String,
    pub arch: String,
}

#[derive(Serialize)]
pub struct DisplayInfo {
    pub refresh_hz: Option<u32>,
    pub monitor_name: Option<String>,
}

#[derive(Serialize)]
pub struct SystemSpecs {
    pub cpu: CpuInfo,
    pub gpu: Option<GpuInfo>,
    pub ram: RamInfo,
    pub os: OsInfo,
    pub display: DisplayInfo,
}

#[tauri::command]
pub fn get_system_specs() -> SystemSpecs {
    let mut sys = System::new();
    sys.refresh_cpu_all();
    sys.refresh_memory();

    let cpu = {
        let cpus = sys.cpus();
        let model = cpus
            .first()
            .map(|c| c.brand().to_string())
            .unwrap_or_else(|| "Unknown".into());
        let threads = cpus.len();
        let cores = sys.physical_core_count().unwrap_or(threads);
        CpuInfo { model, cores, threads }
    };

    let ram = RamInfo {
        total_gb: (sys.total_memory() as f64) / 1_073_741_824.0,
    };

    let os = OsInfo {
        name: System::name().unwrap_or_else(|| "Unknown".into()),
        version: System::os_version().unwrap_or_else(|| "Unknown".into()),
        arch: std::env::consts::ARCH.to_string(),
    };

    let gpu = get_gpu_info();
    let display = get_display_info();

    SystemSpecs { cpu, gpu, ram, os, display }
}

// --- GPU detection (platform-specific) ---

#[cfg(target_os = "windows")]
fn get_gpu_info() -> Option<GpuInfo> {
    // Sort by VRAM descending to pick the discrete GPU over virtual/USB display adapters
    let output = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_VideoController | Sort-Object AdapterRAM -Descending | Select-Object -First 1 Name, AdapterRAM, DriverVersion | ConvertTo-Json",
        ])
        .output()
        .ok()?;

    let json = String::from_utf8_lossy(&output.stdout);
    let json = json.trim();
    if json.is_empty() {
        return None;
    }

    #[allow(non_snake_case)]
    #[derive(serde::Deserialize)]
    struct GpuResult {
        Name: Option<String>,
        AdapterRAM: Option<u64>,
        DriverVersion: Option<String>,
    }

    let result: GpuResult = serde_json::from_str(json).ok()?;

    Some(GpuInfo {
        model: result.Name.unwrap_or_else(|| "Unknown".into()),
        vram_mb: result.AdapterRAM.map(|bytes| bytes / (1024 * 1024)),
        driver_version: result.DriverVersion,
    })
}

#[cfg(not(target_os = "windows"))]
fn get_gpu_info() -> Option<GpuInfo> {
    None
}

// --- Display refresh rate (platform-specific) ---

#[cfg(target_os = "windows")]
fn get_display_info() -> DisplayInfo {
    // Get refresh rate from the primary GPU (highest VRAM)
    let refresh_hz = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_VideoController | Sort-Object AdapterRAM -Descending | Select-Object -First 1 -ExpandProperty CurrentRefreshRate",
        ])
        .output()
        .ok()
        .and_then(|output| {
            let s = String::from_utf8_lossy(&output.stdout);
            s.trim().parse::<u32>().ok()
        });

    // Get primary monitor name from WmiMonitorID (decodes byte array to string)
    let monitor_name = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-Command",
            "$m = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorID | Select-Object -First 1; if ($m.UserFriendlyName) { ($m.UserFriendlyName | Where-Object {$_ -ne 0} | ForEach-Object {[char]$_}) -join '' }",
        ])
        .output()
        .ok()
        .and_then(|output| {
            let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if s.is_empty() { None } else { Some(s) }
        });

    DisplayInfo { refresh_hz, monitor_name }
}

#[cfg(not(target_os = "windows"))]
fn get_display_info() -> DisplayInfo {
    DisplayInfo { refresh_hz: None, monitor_name: None }
}
