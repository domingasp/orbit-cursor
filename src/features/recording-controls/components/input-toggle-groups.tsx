import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Volume2,
  VolumeOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { usePermissionsStore } from "../../../stores/permissions.store";
import { useRecordingPreferencesStore } from "../../../stores/recording-preferences.store";
import {
  selectedItem,
  StandaloneListBoxes,
  updateStandaloneListBoxStore,
  useStandaloneListBoxStore,
} from "../../../stores/standalone-listbox.store";
import {
  AppWindow,
  rehydrateWindowReopenState,
  useWindowReopenStore,
} from "../../../stores/window-open-state.store";
import { listAudioInputs } from "../../audio-inputs/api/audio-listeners";
import { listCameras } from "../../camera-select/api/camera";

import InputToggle from "./input-toggle";

export enum WarningType {
  Empty = "empty",
  Disconnected = "disconnected",
}

type InputToggleGroupProps = {
  openRecordingInputOptions: () => Promise<void>;
};
const InputToggleGroup = ({
  openRecordingInputOptions,
}: InputToggleGroupProps) => {
  const permissions = usePermissionsStore((state) => state.permissions);
  const [startRecordingDockOpened, recordingInputOptionsOpened] =
    useWindowReopenStore(
      useShallow((state) => [
        state.windows[AppWindow.StartRecordingDock],
        state.windows[AppWindow.RecordingInputOptions],
      ])
    );

  const [microphoneWarning, setMicrophoneWarning] = useState<
    WarningType | undefined
  >(undefined);
  const [cameraWarning, setCameraWarning] = useState<WarningType | undefined>(
    undefined
  );
  const [selectedMicrophone, selectedCamera] = useStandaloneListBoxStore(
    useShallow((state) => [
      selectedItem(
        state.getListBox(StandaloneListBoxes.MicrophoneAudio)?.selectedItems ??
          []
      ),
      selectedItem(
        state.getListBox(StandaloneListBoxes.Camera)?.selectedItems ?? []
      ),
    ])
  );

  const [
    camera,
    setCamera,
    microphone,
    setMicrophone,
    systemAudio,
    setSystemAudio,
  ] = useRecordingPreferencesStore(
    useShallow((state) => [
      state.camera,
      state.setCamera,
      state.microphone,
      state.setMicrophone,
      state.systemAudio,
      state.setSystemAudio,
    ])
  );

  const rehydrateStores = (e: StorageEvent) => {
    updateStandaloneListBoxStore(e);
    rehydrateWindowReopenState(e);
  };

  useEffect(() => {
    window.addEventListener("storage", rehydrateStores);
    return () => {
      window.removeEventListener("storage", rehydrateStores);
    };
  }, []);

  useEffect(() => {
    if (permissions.microphone?.hasAccess) {
      void listAudioInputs().then((microphones) => {
        if (selectedMicrophone === null || selectedMicrophone.id === null) {
          setMicrophoneWarning(WarningType.Empty);
        } else if (!microphones.includes(selectedMicrophone.id.toString())) {
          setMicrophoneWarning(WarningType.Disconnected);
        } else {
          setMicrophoneWarning(undefined);
        }
      });
    }
  }, [
    selectedMicrophone,
    startRecordingDockOpened,
    recordingInputOptionsOpened,
  ]);

  useEffect(() => {
    if (permissions.camera?.hasAccess) {
      void listCameras().then((cameras) => {
        if (selectedCamera === null || selectedCamera.id === null) {
          setCameraWarning(WarningType.Empty);
        } else if (!cameras.includes(selectedCamera.id.toString())) {
          setCameraWarning(WarningType.Empty);
        } else {
          setCameraWarning(undefined);
        }
      });
    }
  }, [selectedCamera, startRecordingDockOpened, recordingInputOptionsOpened]);

  return (
    <div className="flex flex-row justify-between px-2 text-content-fg">
      {permissions.screen && (
        <InputToggle
          offIcon={<VolumeOff size={16} />}
          onIcon={<Volume2 size={16} />}
          openRecordingInputOptions={openRecordingInputOptions}
          permission={permissions.screen}
          setValue={setSystemAudio}
          value={systemAudio}
        />
      )}

      {permissions.microphone && (
        <InputToggle
          offIcon={<MicOff size={16} />}
          onIcon={<Mic size={16} />}
          openRecordingInputOptions={openRecordingInputOptions}
          permission={permissions.microphone}
          setValue={setMicrophone}
          value={microphone}
          warning={microphoneWarning}
        />
      )}

      {permissions.camera && (
        <InputToggle
          offIcon={<CameraOff size={16} />}
          onIcon={<Camera size={16} />}
          openRecordingInputOptions={openRecordingInputOptions}
          permission={permissions.camera}
          setValue={setCamera}
          value={camera}
          warning={cameraWarning}
        />
      )}
    </div>
  );
};

export default InputToggleGroup;
