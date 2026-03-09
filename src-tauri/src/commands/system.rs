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
/// Uses native WMI for GPU/display/audio, and one targeted PowerShell
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

    // Tauri's thread pool already initializes COM (MTA mode).
    // COMLibrary::new() would fail with RPC_E_CHANGED_MODE.
    // assume_initialized() reuses the existing COM context safely.
    let com = unsafe { wmi::COMLibrary::assume_initialized() };
    let conn = match wmi::WMIConnection::new(com) {
        Ok(c) => c,
        Err(_) => return (None, empty_display, Vec::new(), Vec::new()),
    };

    // --- GPU ---
    #[allow(non_snake_case)]
    #[derive(serde::Deserialize)]
    struct GpuRow {
        Name: Option<String>,
        AdapterRAM: Option<i64>,
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
            vram_mb: g.AdapterRAM.map(|bytes| (bytes as u64) / (1024 * 1024)),
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

    // --- USB HID devices (native SetupAPI — fast, no PowerShell) ---
    let hid_devices = get_usb_hid_devices();

    (gpu, display, audio_devices, hid_devices)
}

/// Get USB HID device names via native Windows SetupAPI.
/// Bottom-up: enumerates Mouse/Keyboard class devices, walks UP to
/// USB parent, reads DEVPKEY_Device_BusReportedDeviceDesc for the real name.
/// Deduplicates USB devices that register both Mouse and Keyboard HID children
/// (common for wireless dongles) and classifies by name heuristics.
#[cfg(target_os = "windows")]
fn get_usb_hid_devices() -> Vec<HidDevice> {
    use std::collections::{HashMap, HashSet};
    use windows::Win32::Devices::DeviceAndDriverInstallation::*;
    use windows::Win32::Devices::Properties::*;

    // Collect: USB device ID → (bus-reported name, set of HID class types)
    let mut usb_map: HashMap<String, (String, HashSet<String>)> = HashMap::new();

    let classes = [
        (&GUID_DEVCLASS_MOUSE, "mouse"),
        (&GUID_DEVCLASS_KEYBOARD, "keyboard"),
    ];

    for (class_guid, hid_type) in &classes {
        unsafe {
            let dev_info = match SetupDiGetClassDevsW(
                Some(*class_guid),
                None,
                None,
                DIGCF_PRESENT,
            ) {
                Ok(h) => h,
                Err(_) => continue,
            };

            let mut index: u32 = 0;
            loop {
                let mut data = SP_DEVINFO_DATA {
                    cbSize: std::mem::size_of::<SP_DEVINFO_DATA>() as u32,
                    ..Default::default()
                };

                if SetupDiEnumDeviceInfo(dev_info, index, &mut data).is_err() {
                    break;
                }
                index += 1;

                // Walk UP the device tree to find a USB\VID_ ancestor
                let mut current = data.DevInst;
                loop {
                    let mut parent: u32 = 0;
                    if CM_Get_Parent(&mut parent, current, 0) != CR_SUCCESS {
                        break;
                    }

                    let mut id_buf = [0u16; 256];
                    if CM_Get_Device_IDW(parent, &mut id_buf, 0) != CR_SUCCESS {
                        break;
                    }
                    let id_str = String::from_utf16_lossy(&id_buf);
                    let id = id_str.trim_end_matches('\0');

                    if id.starts_with("USB\\VID_") && !id.contains("MI_") {
                        let entry = usb_map.entry(id.to_string());
                        let (name, types) = entry.or_insert_with(|| {
                            let name = get_devnode_string_property(
                                parent,
                                &DEVPKEY_Device_BusReportedDeviceDesc,
                            )
                            .unwrap_or_default();
                            (name, HashSet::new())
                        });
                        let _ = name; // already set on first insert
                        types.insert(hid_type.to_string());
                        break;
                    }
                    current = parent;
                }
            }

            let _ = SetupDiDestroyDeviceInfoList(dev_info);
        }
    }

    // Classify each USB device
    usb_map
        .into_values()
        .filter_map(|(name, types)| {
            if name.is_empty() || name.contains("Hub") || name.contains("Host Controller") {
                return None;
            }
            let device_type = if types.len() == 1 {
                types.into_iter().next().unwrap()
            } else {
                // Device has both mouse and keyboard HID children.
                // Use name to pick the primary function.
                let lower = name.to_lowercase();
                if lower.contains("mouse") {
                    "mouse".to_string()
                } else if lower.contains("keyboard") || lower.contains("kbd") {
                    "keyboard".to_string()
                } else {
                    // Ambiguous — default to keyboard (keyboards with extra
                    // HID endpoints are more common than mice with keyboard children)
                    "keyboard".to_string()
                }
            };
            Some(HidDevice { name, device_type })
        })
        .collect()
}

/// Read a string property from a device node (devInst) using CM_Get_DevNode_PropertyW.
#[cfg(target_os = "windows")]
unsafe fn get_devnode_string_property(
    devinst: u32,
    property_key: &windows::Win32::Foundation::DEVPROPKEY,
) -> Option<String> {
    use windows::Win32::Devices::DeviceAndDriverInstallation::*;
    use windows::Win32::Devices::Properties::*;

    let mut prop_type = DEVPROPTYPE::default();
    let mut size: u32 = 0;

    // First call: get required buffer size
    let _ = CM_Get_DevNode_PropertyW(devinst, property_key, &mut prop_type, None, &mut size, 0);
    if size == 0 {
        return None;
    }

    // Second call: read the property
    let mut buffer = vec![0u8; size as usize];
    if CM_Get_DevNode_PropertyW(
        devinst,
        property_key,
        &mut prop_type,
        Some(buffer.as_mut_ptr()),
        &mut size,
        0,
    ) != CR_SUCCESS
    {
        return None;
    }

    if prop_type != DEVPROP_TYPE_STRING {
        return None;
    }

    let wide: Vec<u16> = buffer
        .chunks_exact(2)
        .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
        .collect();
    let text = String::from_utf16_lossy(&wide);
    Some(text.trim_end_matches('\0').to_string())
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
