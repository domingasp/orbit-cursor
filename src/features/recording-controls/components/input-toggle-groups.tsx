import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Volume2,
  VolumeOff,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { usePermissionsStore } from "../../../stores/permissions.store";
import { useRecordingPreferencesStore } from "../../../stores/recording-preferences.store";

import InputToggle from "./input-toggle";

type InputToggleGroupProps = {
  openRecordingInputOptions: () => Promise<void>;
};
const InputToggleGroup = ({
  openRecordingInputOptions,
}: InputToggleGroupProps) => {
  const permissions = usePermissionsStore((state) => state.permissions);
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
        />
      )}
    </div>
  );
};

export default InputToggleGroup;
