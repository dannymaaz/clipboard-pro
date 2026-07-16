import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { updaterService } from "../services/updaterService";
import type { UpdateInfo, UpdateProgress, UpdateStatus } from "../types/clipboard";

export type UpdaterPhase =
  | "idle"
  | "checking"
  | "downloading"
  | "upToDate"
  | "ready"
  | "installing"
  | "error";

export interface AppUpdaterController {
  phase: UpdaterPhase;
  update: UpdateInfo | null;
  progress: UpdateProgress | null;
  currentVersion: string;
  error: string | null;
  showPrompt: boolean;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
  dismissPrompt: () => void;
  showReadyPrompt: () => void;
}

const isTauri =
  typeof window !== "undefined" &&
  "__TAURI_INTERNALS__" in (window as Window & { __TAURI_INTERNALS__?: unknown });

export function useAppUpdater(autoUpdate: boolean): AppUpdaterController {
  const [phase, setPhase] = useState<UpdaterPhase>("idle");
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [currentVersion, setCurrentVersion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const automaticCheckStarted = useRef(false);

  const applyStatus = useCallback((status: UpdateStatus) => {
    setCurrentVersion(status.currentVersion);

    if (status.ready) {
      setUpdate(status.ready);
      setPhase("ready");
      setShowPrompt(true);
      setError(null);
      return;
    }

    if (status.busy) {
      setPhase("downloading");
      return;
    }

    if (status.lastError) {
      setError(status.lastError);
      setPhase("error");
      return;
    }

    setPhase((current) => (current === "checking" ? "upToDate" : current));
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!isTauri) return;
    try {
      const status = await updaterService.getStatus();
      applyStatus(status);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      setPhase("error");
    }
  }, [applyStatus]);

  const checkForUpdates = useCallback(async () => {
    if (!isTauri) {
      setPhase("upToDate");
      return;
    }

    setError(null);
    setProgress(null);
    setPhase("checking");

    try {
      const found = await updaterService.checkAndDownload();
      if (found) {
        setUpdate(found);
        setPhase("ready");
        setShowPrompt(true);
        return;
      }

      const status = await updaterService.getStatus();
      applyStatus(status);
      if (!status.busy && !status.ready && !status.lastError) {
        setPhase("upToDate");
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      setPhase("error");
    }
  }, [applyStatus]);

  const installUpdate = useCallback(async () => {
    if (!isTauri || !update) return;

    setError(null);
    setPhase("installing");

    try {
      await updaterService.installDownloaded();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      setPhase("error");
    }
  }, [update]);

  useEffect(() => {
    if (!isTauri) return;

    let cancelled = false;
    const unlisteners: UnlistenFn[] = [];

    void Promise.all([
      listen<UpdateProgress>("clipboard-pro://update-progress", (event) => {
        if (cancelled) return;
        setProgress(event.payload);
        setPhase("downloading");
      }),
      listen<UpdateInfo>("clipboard-pro://update-ready", (event) => {
        if (cancelled) return;
        setUpdate(event.payload);
        setProgress((current) => ({
          downloaded: current?.total ?? current?.downloaded ?? 0,
          total: current?.total ?? null,
          percentage: 100
        }));
        setError(null);
        setPhase("ready");
        setShowPrompt(true);
      }),
      listen<{ message: string }>("clipboard-pro://update-error", (event) => {
        if (cancelled) return;
        setError(event.payload.message);
        setPhase("error");
      })
    ]).then((handlers) => {
      if (cancelled) {
        handlers.forEach((handler) => handler());
      } else {
        unlisteners.push(...handlers);
      }
    });

    void refreshStatus();

    return () => {
      cancelled = true;
      unlisteners.forEach((handler) => handler());
    };
  }, [refreshStatus]);

  useEffect(() => {
    if (!autoUpdate || automaticCheckStarted.current || !isTauri) return;
    automaticCheckStarted.current = true;

    const timer = window.setTimeout(() => {
      void checkForUpdates();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [autoUpdate, checkForUpdates]);

  return {
    phase,
    update,
    progress,
    currentVersion,
    error,
    showPrompt,
    checkForUpdates,
    installUpdate,
    dismissPrompt: () => setShowPrompt(false),
    showReadyPrompt: () => {
      if (update) setShowPrompt(true);
    }
  };
}
