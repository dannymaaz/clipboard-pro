use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_updater::{Update, UpdaterExt};

pub const UPDATE_PROGRESS_EVENT: &str = "clipboard-pro://update-progress";
pub const UPDATE_READY_EVENT: &str = "clipboard-pro://update-ready";
pub const UPDATE_ERROR_EVENT: &str = "clipboard-pro://update-error";

#[derive(Default)]
pub struct UpdaterState {
    inner: Mutex<UpdaterStateInner>,
}

#[derive(Default)]
struct UpdaterStateInner {
    busy: bool,
    ready: Option<DownloadedUpdate>,
    last_error: Option<String>,
}

struct DownloadedUpdate {
    update: Update,
    bytes: Vec<u8>,
    info: UpdateInfo,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub notes: Option<String>,
    pub date: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub current_version: String,
    pub busy: bool,
    pub ready: Option<UpdateInfo>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateProgress {
    downloaded: u64,
    total: Option<u64>,
    percentage: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateError {
    message: String,
}

impl UpdateInfo {
    fn from_update(update: &Update) -> Self {
        Self {
            version: update.version.clone(),
            current_version: update.current_version.clone(),
            notes: update.body.clone(),
            date: update.date.map(|value| value.to_string()),
        }
    }
}

#[tauri::command]
pub fn get_update_status(
    app: AppHandle,
    state: State<'_, UpdaterState>,
) -> Result<UpdateStatus, String> {
    snapshot(&app, &state)
}

#[tauri::command]
pub async fn check_and_download_update(
    app: AppHandle,
    state: State<'_, UpdaterState>,
) -> Result<Option<UpdateInfo>, String> {
    check_and_download(&app, &state).await
}

#[tauri::command]
pub fn install_downloaded_update(
    app: AppHandle,
    state: State<'_, UpdaterState>,
) -> Result<(), String> {
    let downloaded = {
        let mut inner = state.inner.lock().map_err(|error| error.to_string())?;
        inner
            .ready
            .take()
            .ok_or_else(|| "No hay una actualizacion descargada".to_string())?
    };

    if let Err(error) = downloaded.update.install(&downloaded.bytes) {
        let message = error.to_string();
        let mut inner = state.inner.lock().map_err(|lock_error| lock_error.to_string())?;
        inner.last_error = Some(message.clone());
        inner.ready = Some(downloaded);
        return Err(message);
    }

    app.restart();
}

async fn check_and_download(
    app: &AppHandle,
    state: &UpdaterState,
) -> Result<Option<UpdateInfo>, String> {
    {
        let mut inner = state.inner.lock().map_err(|error| error.to_string())?;

        if let Some(downloaded) = inner.ready.as_ref() {
            return Ok(Some(downloaded.info.clone()));
        }

        if inner.busy {
            return Ok(None);
        }

        inner.busy = true;
        inner.last_error = None;
    }

    let result = check_and_download_inner(app, state).await;

    if let Err(error) = &result {
        let message = error.clone();
        if let Ok(mut inner) = state.inner.lock() {
            inner.busy = false;
            inner.last_error = Some(message.clone());
        }
        let _ = app.emit(UPDATE_ERROR_EVENT, UpdateError { message });
    }

    result
}

async fn check_and_download_inner(
    app: &AppHandle,
    state: &UpdaterState,
) -> Result<Option<UpdateInfo>, String> {
    let Some(update) = app
        .updater()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())?
    else {
        let mut inner = state.inner.lock().map_err(|error| error.to_string())?;
        inner.busy = false;
        inner.last_error = None;
        return Ok(None);
    };

    let info = UpdateInfo::from_update(&update);
    let progress_app = app.clone();
    let finished_app = app.clone();
    let mut downloaded = 0_u64;

    let bytes = update
        .download(
            move |chunk_length, content_length| {
                downloaded = downloaded.saturating_add(chunk_length as u64);
                let percentage = content_length
                    .filter(|total| *total > 0)
                    .map(|total| ((downloaded as f64 / total as f64) * 100.0).min(100.0));

                let _ = progress_app.emit(
                    UPDATE_PROGRESS_EVENT,
                    UpdateProgress {
                        downloaded,
                        total: content_length,
                        percentage,
                    },
                );
            },
            move || {
                let _ = finished_app.emit(
                    UPDATE_PROGRESS_EVENT,
                    UpdateProgress {
                        downloaded: 0,
                        total: None,
                        percentage: Some(100.0),
                    },
                );
            },
        )
        .await
        .map_err(|error| error.to_string())?;

    {
        let mut inner = state.inner.lock().map_err(|error| error.to_string())?;
        inner.busy = false;
        inner.last_error = None;
        inner.ready = Some(DownloadedUpdate {
            update,
            bytes,
            info: info.clone(),
        });
    }

    let _ = app.emit(UPDATE_READY_EVENT, info.clone());
    let _ = app
        .notification()
        .builder()
        .title("Clipboard Pro")
        .body(format!(
            "La version {} ya se descargo. Abre Clipboard Pro para instalarla ahora o despues.",
            info.version
        ))
        .show();

    Ok(Some(info))
}

fn snapshot(app: &AppHandle, state: &UpdaterState) -> Result<UpdateStatus, String> {
    let inner = state.inner.lock().map_err(|error| error.to_string())?;

    Ok(UpdateStatus {
        current_version: app.package_info().version.to_string(),
        busy: inner.busy,
        ready: inner.ready.as_ref().map(|downloaded| downloaded.info.clone()),
        last_error: inner.last_error.clone(),
    })
}
