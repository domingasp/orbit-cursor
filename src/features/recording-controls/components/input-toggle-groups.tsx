import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  MousePointer2,
  Volume2,
  VolumeOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { ToggleButton } from "../../../components/base/button/toggle-button";
import { MousePointer2Off } from "../../../components/icons/mouse-pointer-2-off";
import { usePermissionsStore } from "../../../stores/permissions.store";
import { useRecordingStateStore } from "../../../stores/recording-state.store";
import {
  selectedItem,
  standaloneListBoxes,
  useStandaloneListBoxStore,
} from "../../../stores/standalone-listbox.store";
import {
  appWindow,
  useWindowReopenStore,
} from "../../../stores/window-open-state.store";
import { listAudioInputs } from "../../audio-inputs/api/audio-listeners";
import { listCameras } from "../../camera-select/api/camera";

import { InputToggle } from "./input-toggle";

export const warningType = {
  DISCONNECTED: "disconnected",
  EMPTY: "empty",
  NO_PERMISSION: "noPermission",
} as const;

export type WarningType = (typeof warningType)[keyof typeof warningType];

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
        state.windows[appWindow.START_RECORDING_DOCK],
        state.windows[appWindow.RECORDING_INPUT_OPTIONS],
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
        state.getListBox(standaloneListBoxes.MICROPHONE_AUDIO)?.selectedItems ??
          []
      ),
      selectedItem(
        state.getListBox(standaloneListBoxes.CAMERA)?.selectedItems ?? []
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
    showSystemCursor,
    setShowSystemCursor,
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
      state.showSystemCursor,
      state.setShowSystemCursor,
    ])
  );

  useEffect(() => {
    if (permissions.microphone.hasAccess) {
      void listAudioInputs().then((microphones) => {
        if (selectedMicrophone === null || selectedMicrophone.id === null) {
          setMicrophoneWarning(warningType.EMPTY);
        } else if (!microphones.includes(selectedMicrophone.id.toString())) {
          setMicrophoneWarning(warningType.DISCONNECTED);
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
          setCameraWarning(warningType.EMPTY);
        } else if (!cameras.includes(selectedCamera.id.toString())) {
          setCameraWarning(warningType.DISCONNECTED);
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
      <InputToggle
        offIcon={<VolumeOff size={16} />}
        onIcon={<Volume2 size={16} />}
        openRecordingInputOptions={openRecordingInputOptions}
        permission={permissions.screen}
        setValue={setSystemAudio}
        value={systemAudio}
      />

      <InputToggle
        offIcon={<MicOff size={16} />}
        onIcon={<Mic size={16} />}
        openRecordingInputOptions={openRecordingInputOptions}
        permission={permissions.microphone}
        setValue={setMicrophone}
        value={microphone}
        warning={
          permissions.microphone.hasAccess
            ? microphoneWarning
            : warningType.NO_PERMISSION
        }
      />

      <InputToggle
        offIcon={<CameraOff size={16} />}
        onIcon={<Camera size={16} />}
        openRecordingInputOptions={openRecordingInputOptions}
        permission={permissions.camera}
        setValue={setCamera}
        value={camera}
        warning={
          permissions.camera.hasAccess
            ? cameraWarning
            : warningType.NO_PERMISSION
        }
      />

      <ToggleButton
        isSelected={showSystemCursor}
        off={<MousePointer2Off size={16} />}
        onChange={setShowSystemCursor}
        size="sm"
        variant="ghost"
      >
        <MousePointer2 size={16} />
      </ToggleButton>
    </div>
  );
};
