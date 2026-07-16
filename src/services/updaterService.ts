import { invoke } from "@tauri-apps/api/core";
import type { UpdateInfo, UpdateStatus } from "../types/clipboard";

const isTauri =
  typeof window !== "undefined" &&
  "__TAURI_INTERNALS__" in (window as Window & { __TAURI_INTERNALS__?: unknown });

const browserStatus: UpdateStatus = {
  currentVersion: "web-preview",
  busy: false,
  ready: null,
  lastError: null
};

export const updaterService = {
  getStatus: () =>
    isTauri ? invoke<UpdateStatus>("get_update_status") : Promise.resolve(browserStatus),
  checkAndDownload: () =>
    isTauri
      ? invoke<UpdateInfo | null>("check_and_download_update")
      : Promise.resolve<UpdateInfo | null>(null),
  installDownloaded: () =>
    isTauri ? invoke<void>("install_downloaded_update") : Promise.resolve()
};
