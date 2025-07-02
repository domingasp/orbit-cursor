import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import { checkPermissions } from "../api/permissions";
import { rehydrateHotkeyStore } from "../stores/hotkeys.store";
import { Permissions, usePermissionsStore } from "../stores/permissions.store";
import { rehydrateRecordingStateStore } from "../stores/recording-state.store";
import { updateStandaloneListBoxStore } from "../stores/standalone-listbox.store";
import { rehydrateWindowReopenState } from "../stores/window-open-state.store";
import { Events } from "../types/events";

import { AppProvider } from "./provider";
import { AppRouter } from "./router";

export const App = () => {
  const { permissions, setCanUnlock, setPermissions } = usePermissionsStore(
    (state) => state
  );
  const [unlisten, setUnlisten] = useState<UnlistenFn | null>(null);

  const setupPermissions = async () => {
    const prefetch = await checkPermissions();
    setPermissions(prefetch);
    setCanUnlock(prefetch);

    const unlistenFn = await listen<Permissions>(
      Events.MonitorPermissions,
      (event) => {
        setPermissions(event.payload);
      }
    );

    setUnlisten(() => unlistenFn);
  };

  // Ensure stores are kept to date for all windows
  const rehydrateStores = (e: StorageEvent) => {
    updateStandaloneListBoxStore(e);
    rehydrateRecordingStateStore(e);
    rehydrateWindowReopenState(e);
    rehydrateHotkeyStore(e);
  };

  useEffect(() => {
    window.addEventListener("storage", rehydrateStores);
    return () => {
      window.removeEventListener("storage", rehydrateStores);
    };
  }, []);

  useEffect(() => {
    void setupPermissions();
  }, [setPermissions]);

  useEffect(() => {
    if (Object.values(permissions).every((p) => p.hasAccess) && unlisten)
      unlisten();
  }, [permissions]);

  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
};
