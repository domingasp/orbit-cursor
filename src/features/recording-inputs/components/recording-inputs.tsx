import { listen } from "@tauri-apps/api/event";
import { Mic } from "lucide-react";
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
import { listAudioInputs } from "../api/audio-listeners";

import GrantAccess from "./grant-access";
import InputAudioSelect from "./input-audio-select";
import SystemAudioToggle from "./system-audio-toggle";

enum ListBoxes {
  MicrophoneAudio = "microphone-audio",
}

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
    <div className="w-full px-2 grid grid-cols-[1fr_auto_1fr]">
      {permissions.microphone?.hasAccess ? (
        <SystemAudioToggle />
      ) : (
        <GrantAccess
          permission={permissions.microphone}
          type={PermissionType.Microphone}
        />
      )}

      <Separator
        className="h-[30px] ml-6"
        orientation="vertical"
        spacing="md"
      />

      {permissions.microphone?.hasAccess ? (
        <InputAudioSelect
          fetchItems={listAudioInputs}
          icon={<Mic size={14} />}
          id={ListBoxes.MicrophoneAudio}
          label="Microphone audio"
          placeholder="No microphone"
        />
      ) : (
        <GrantAccess
          permission={permissions.microphone}
          type={PermissionType.Microphone}
        />
      )}
    </div>
  );
};

export default RecordingInputs;
