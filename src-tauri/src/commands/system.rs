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
pub struct AudioDevice {
    pub name: String,
    pub device_type: String,
}

#[derive(Serialize)]
pub struct HidDevice {
    pub name: String,
    pub device_type: String,
}

#[derive(Serialize)]
pub struct AllSpecs {
    pub cpu: CpuInfo,
    pub gpu: Option<GpuInfo>,
    pub ram: RamInfo,
    pub os: OsInfo,
    pub display: DisplayInfo,
    pub audio_devices: Vec<AudioDevice>,
    pub hid_devices: Vec<HidDevice>,
}

/// Single command that gathers all system + peripheral info.
/// Uses one COM initialization to avoid COM re-init bugs,
/// native WMI for GPU/display/audio, and one targeted PowerShell
/// call for USB device bus-reported names (mice/keyboards).
#[tauri::command]
pub fn get_all_specs() -> AllSpecs {
    // --- sysinfo: CPU, RAM, OS (fast, no COM needed) ---
    let mut sys = System::new();
    sys.refresh_cpu_all();
    sys.refresh_memory();

    let cpu = {
        let cpus = sys.cpus();
        let raw_model = cpus
            .first()
            .map(|c| c.brand().to_string())
            .unwrap_or_else(|| "Unknown".into());
        let model = clean_cpu_model(&raw_model);
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

    // --- Platform-specific: GPU, display, peripherals ---
    let (gpu, display, audio_devices, hid_devices) = get_platform_specs();

    AllSpecs {
        cpu,
        gpu,
        ram,
        os,
        display,
        audio_devices,
        hid_devices,
    }
}

// ============================================================
// Windows implementation
// ============================================================

#[cfg(target_os = "windows")]
fn get_platform_specs() -> (Option<GpuInfo>, DisplayInfo, Vec<AudioDevice>, Vec<HidDevice>) {
    let empty_display = DisplayInfo { refresh_hz: None, monitor_name: None };

    let com = match wmi::COMLibrary::new() {
        Ok(c) => c,
        Err(_) => return (None, empty_display, Vec::new(), Vec::new()),
    };
    let conn = match wmi::WMIConnection::new(com) {
        Ok(c) => c,
        Err(_) => return (None, empty_display, Vec::new(), Vec::new()),
    };

    // --- GPU ---
    #[allow(non_snake_case)]
    #[derive(serde::Deserialize)]
    struct GpuRow {
        Name: Option<String>,
        AdapterRAM: Option<u64>,
        DriverVersion: Option<String>,
        CurrentRefreshRate: Option<u32>,
    }

    let gpus: Vec<GpuRow> = conn
        .raw_query("SELECT Name, AdapterRAM, DriverVersion, CurrentRefreshRate FROM Win32_VideoController")
        .unwrap_or_default();
    let best_gpu = gpus.into_iter().max_by_key(|g| g.AdapterRAM.unwrap_or(0));

    let gpu = best_gpu.as_ref().and_then(|g| {
        g.Name.clone().map(|name| GpuInfo {
            model: name,
            vram_mb: g.AdapterRAM.map(|bytes| bytes / (1024 * 1024)),
            driver_version: g.DriverVersion.clone(),
        })
    });
    let refresh_hz = best_gpu.as_ref().and_then(|g| g.CurrentRefreshRate);

    // --- Monitor name (root\WMI namespace) ---
    #[allow(non_snake_case)]
    #[derive(serde::Deserialize)]
    struct MonRow { UserFriendlyName: Option<Vec<u16>> }

    let monitor_name = wmi::WMIConnection::with_namespace_path("root\\WMI", com)
        .ok()
        .and_then(|wmi_root| {
            let monitors: Vec<MonRow> = wmi_root
                .raw_query("SELECT UserFriendlyName FROM WmiMonitorID")
                .unwrap_or_default();
            monitors.into_iter().next().and_then(|m| {
                m.UserFriendlyName.map(|bytes| {
                    bytes.iter().filter(|&&b| b != 0).map(|&b| char::from(b as u8)).collect::<String>()
                })
            })
        })
        .filter(|s| !s.is_empty());

    let display = DisplayInfo { refresh_hz, monitor_name };

    // --- Audio endpoints (native WMI — good names) ---
    #[allow(non_snake_case)]
    #[derive(serde::Deserialize)]
    struct NameOnly { Name: Option<String> }

    let endpoints: Vec<NameOnly> = conn
        .raw_query("SELECT Name FROM Win32_PnPEntity WHERE PNPClass = 'AudioEndpoint'")
        .unwrap_or_default();

    let mut audio_devices = Vec::new();
    for ep in endpoints {
        let name = match ep.Name.as_deref() {
            Some(n) if !n.is_empty() => n,
            _ => continue,
        };
        let lower = name.to_lowercase();
        if lower.contains("voicemeeter") || lower.contains("vb-audio")
            || lower.contains("steam streaming") || lower.contains("virtual")
        {
            continue;
        }
        let device_type = if lower.contains("microphone") || lower.contains("mic") { "input" } else { "output" };
        let short_name = extract_device_name(name);
        audio_devices.push(AudioDevice { name: short_name, device_type: device_type.into() });
    }

    // --- USB HID devices (PowerShell for bus-reported names) ---
    let hid_devices = get_usb_hid_devices();

    (gpu, display, audio_devices, hid_devices)
}

/// Get USB HID device names via PowerShell (DEVPKEY_Device_BusReportedDeviceDesc).
/// This is one targeted call — only gets USB devices with Mouse/Keyboard children.
#[cfg(target_os = "windows")]
fn get_usb_hid_devices() -> Vec<HidDevice> {
    let script = r#"
$results = @()
$usbDevices = Get-PnpDevice -Class 'USB' -Status OK | Where-Object {
    $_.InstanceId -like 'USB\VID_*' -and $_.InstanceId -notlike '*MI_*'
}
foreach ($dev in $usbDevices) {
    try {
        $busName = (Get-PnpDeviceProperty -InstanceId $dev.InstanceId -KeyName DEVPKEY_Device_BusReportedDeviceDesc -ErrorAction SilentlyContinue).Data
        if (-not $busName) { continue }
        if ($busName -like '*Hub*' -or $busName -like '*Host Controller*') { continue }
        $vid_pid = $dev.InstanceId -replace 'USB\\(VID_[0-9A-F]+&PID_[0-9A-F]+)\\.*', '$1'
        $hasMouseChild = $false
        $hasKeyboardChild = $false
        $childDevices = Get-PnpDevice -Status OK | Where-Object {
            ($_.InstanceId -like "HID\$vid_pid*") -and ($_.Class -eq 'Mouse' -or $_.Class -eq 'Keyboard')
        }
        foreach ($child in $childDevices) {
            if ($child.Class -eq 'Mouse') { $hasMouseChild = $true }
            if ($child.Class -eq 'Keyboard') { $hasKeyboardChild = $true }
        }
        $deviceType = $null
        if ($hasKeyboardChild) { $deviceType = "keyboard" }
        elseif ($hasMouseChild) { $deviceType = "mouse" }
        if ($deviceType) {
            $results += [PSCustomObject]@{ name = $busName; device_type = $deviceType }
        }
    } catch {}
}
$results | ConvertTo-Json -Depth 2
"#;

    let output = std::process::Command::new("powershell.exe")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script])
        .output()
        .ok();

    let json = match output {
        Some(ref o) => {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if s.is_empty() || s == "null" { return Vec::new(); }
            s
        }
        None => return Vec::new(),
    };

    #[derive(serde::Deserialize)]
    struct UsbDev { name: Option<String>, device_type: Option<String> }

    // PowerShell returns single object {} for 1 result, array [] for multiple
    #[derive(serde::Deserialize)]
    #[serde(untagged)]
    enum OneOrMany { Many(Vec<UsbDev>), One(UsbDev) }

    let devs: Vec<UsbDev> = match serde_json::from_str::<OneOrMany>(&json) {
        Ok(OneOrMany::Many(v)) => v,
        Ok(OneOrMany::One(d)) => vec![d],
        Err(_) => Vec::new(),
    };

    devs.into_iter()
        .filter_map(|d| {
            let name = d.name.filter(|n| !n.is_empty())?;
            let dtype = d.device_type.filter(|t| !t.is_empty())?;
            Some(HidDevice { name, device_type: dtype })
        })
        .collect()
}

// ============================================================
// Non-Windows stubs
// ============================================================

#[cfg(not(target_os = "windows"))]
fn get_platform_specs() -> (Option<GpuInfo>, DisplayInfo, Vec<AudioDevice>, Vec<HidDevice>) {
    (None, DisplayInfo { refresh_hz: None, monitor_name: None }, Vec::new(), Vec::new())
}

// ============================================================
// Helpers
// ============================================================

/// Extract device name from "Speakers (iBasso DC07 Pro)" → "iBasso DC07 Pro"
fn extract_device_name(endpoint_name: &str) -> String {
    if let Some(start) = endpoint_name.find('(') {
        if let Some(end) = endpoint_name.rfind(')') {
            let inner = endpoint_name[start + 1..end].trim();
            if !inner.is_empty() {
                return inner.to_string();
            }
        }
    }
    endpoint_name.to_string()
}

/// Clean verbose CPU brand strings.
fn clean_cpu_model(raw: &str) -> String {
    let mut s = raw.to_string();
    s = s.replace("(R)", "").replace("(TM)", "").replace("(tm)", "");
    if let Some(idx) = s.find("Gen ") {
        s = s[idx + 4..].to_string();
    }
    if let Some(idx) = s.find("-Core Processor") {
        if let Some(space_idx) = s[..idx].rfind(' ') {
            s = s[..space_idx].to_string();
        }
    }
    if s.ends_with(" Processor") {
        s = s[..s.len() - " Processor".len()].to_string();
    }
    while s.contains("  ") {
        s = s.replace("  ", " ");
    }
    s.trim().to_string()
}
