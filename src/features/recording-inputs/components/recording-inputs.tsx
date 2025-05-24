import { listen } from "@tauri-apps/api/event";
import { Camera, Mic, Volume2Icon } from "lucide-react";
import { useEffect } from "react";

import Separator from "../../../components/separator/separator";
import {
  PermissionType,
  usePermissionsStore,
} from "../../../stores/permissions.store";
import {
  updateStandaloneListBoxStore,
  useStandaloneListBoxStore,
} from "../../../stores/standalone-listbox.store";
import { Events } from "../../../types/events";

import InputAudioSelect from "./audio/input-audio-select";
import SystemAudioToggle from "./audio/system-audio-toggle";
import CameraSelect from "./camera/camera-select";
import GrantAccess from "./grant-access";

const RecordingInputs = () => {
  const permissions = usePermissionsStore((state) => state.permissions);
  const { closeListBox } = useStandaloneListBoxStore((state) => state);

  useEffect(() => {
    const unlistenStandaloneListBox = listen(
      Events.ClosedStandaloneListBox,
      () => {
        closeListBox();
      }
    );

    window.addEventListener("storage", updateStandaloneListBoxStore);
    return () => {
      window.removeEventListener("storage", updateStandaloneListBoxStore);
      void unlistenStandaloneListBox.then((f) => {
        f();
      });
    };
  }, []);

  return (
    <div className="w-full px-2 grid grid-cols-[1fr_auto_1fr_auto_1fr]">
      {permissions.screen?.hasAccess ? (
        <SystemAudioToggle />
      ) : (
        <GrantAccess
          icon={<Volume2Icon size={12} />}
          permission={permissions.screen}
          type={PermissionType.Screen}
        />
      )}

      <Separator
        className="h-[30px] ml-6"
        orientation="vertical"
        spacing="md"
      />

      {permissions.microphone?.hasAccess ? (
        <InputAudioSelect />
      ) : (
        <GrantAccess
          icon={<Mic size={12} />}
          permission={permissions.microphone}
          type={PermissionType.Microphone}
        />
      )}

      <Separator
        className="h-[30px] ml-6"
        orientation="vertical"
        spacing="md"
      />

      {permissions.camera?.hasAccess ? (
        <CameraSelect />
      ) : (
        <GrantAccess
          icon={<Camera size={12} />}
          permission={permissions.camera}
          type={PermissionType.Camera}
        />
      )}
    </div>
  );
};

export default RecordingInputs;
