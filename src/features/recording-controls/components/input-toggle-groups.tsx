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
import { useRecordingStateStore } from "../../../stores/recording-state.store";
import {
  selectedItem,
  StandaloneListBoxes,
  useStandaloneListBoxStore,
} from "../../../stores/standalone-listbox.store";
import {
  AppWindow,
  useWindowReopenStore,
} from "../../../stores/window-open-state.store";
import { listAudioInputs } from "../../audio-inputs/api/audio-listeners";
import { listCameras } from "../../camera-select/api/camera";

import { InputToggle } from "./input-toggle";

export enum WarningType {
  Empty = "empty",
  Disconnected = "disconnected",
}

type InputToggleGroupProps = {
  openRecordingInputOptions: () => Promise<void>;
};

export const InputToggleGroup = ({
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
    setCameraHasWarning,
    setMicrophoneHasWarning,
  ] = useRecordingStateStore(
    useShallow((state) => [
      state.camera,
      state.setCamera,
      state.microphone,
      state.setMicrophone,
      state.systemAudio,
      state.setSystemAudio,
      state.setCameraHasWarning,
      state.setMicrophoneHasWarning,
    ])
  );

  useEffect(() => {
    if (permissions.microphone.hasAccess) {
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
    if (permissions.camera.hasAccess) {
      void listCameras().then((cameras) => {
        if (selectedCamera === null || selectedCamera.id === null) {
          setCameraWarning(WarningType.Empty);
        } else if (!cameras.includes(selectedCamera.id.toString())) {
          setCameraWarning(WarningType.Disconnected);
        } else {
          setCameraWarning(undefined);
        }
      });
    }
  }, [selectedCamera, startRecordingDockOpened, recordingInputOptionsOpened]);

  useEffect(() => {
    setMicrophoneHasWarning(microphoneWarning !== undefined);
  }, [microphoneWarning]);

  useEffect(() => {
    setCameraHasWarning(cameraWarning !== undefined);
  }, [cameraWarning]);

  return (
    <div className="flex flex-row justify-between px-2 text-content-fg">
      {permissions.screen.hasAccess && (
        <InputToggle
          offIcon={<VolumeOff size={16} />}
          onIcon={<Volume2 size={16} />}
          openRecordingInputOptions={openRecordingInputOptions}
          permission={permissions.screen}
          setValue={setSystemAudio}
          value={systemAudio}
        />
      )}

      {permissions.microphone.hasAccess && (
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

      {permissions.camera.hasAccess && (
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
