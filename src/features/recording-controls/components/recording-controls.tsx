import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  AppWindowMac,
  Camera,
  CameraOff,
  Circle,
  CircleX,
  Mic,
  MicOff,
  Monitor,
  Sparkle,
  SquareDashed,
  Volume2,
  VolumeOff,
} from "lucide-react";
import { ComponentProps, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  hideStartRecordingDock,
  showRecordingInputOptions,
} from "../../../api/windows";
import Button from "../../../components/button/button";
import Keyboard from "../../../components/keyboard/keyboard";
import RadioGroup from "../../../components/radio-group/radio-group";
import Separator from "../../../components/separator/separator";
import Sparkles from "../../../components/sparkles/sparkles";
import { clearInteractionAttributes } from "../../../lib/styling";
import { usePermissionsStore } from "../../../stores/permissions.store";
import {
  RecordingType,
  useRecordingPreferencesStore,
} from "../../../stores/recording-preferences.store";
import {
  AppWindow,
  useWindowReopenStore,
} from "../../../stores/window-open-state.store";

import IconRadio from "./icon-radio";
import InputToggle from "./input-toggle";

const KEYBOARD_STYLE: ComponentProps<typeof Keyboard> = {
  size: "xs",
  variant: "ghost",
};

const RecordingControls = () => {
  const permissions = usePermissionsStore((state) => state.permissions);
  const [
    recordingType,
    setRecordingType,
    camera,
    setCamera,
    microphone,
    setMicrophone,
    systemAudio,
    setSystemAudio,
  ] = useRecordingPreferencesStore(
    useShallow((state) => [
      state.recordingType,
      state.setRecordingType,
      state.camera,
      state.setCamera,
      state.microphone,
      state.setMicrophone,
      state.systemAudio,
      state.setSystemAudio,
    ])
  );

  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const setWindowOpenState = useWindowReopenStore(
    useShallow((state) => state.setWindowOpenState)
  );

  const onCancel = () => {
    clearInteractionAttributes();
    setWindowOpenState(AppWindow.StartRecordingDock, false);
    hideStartRecordingDock();
  };

  const onClickOptions = async () => {
    if (!optionsButtonRef.current) return;
    clearInteractionAttributes();

    const { left, width } = optionsButtonRef.current.getBoundingClientRect();
    const currentWindow = getCurrentWindow();
    const { x } = await currentWindow.outerPosition();

    // Position at center x of options button,
    showRecordingInputOptions(x + (left + width / 2) * window.devicePixelRatio);
  };

  return (
    <div className="flex items-center justify-center">
      <Button
        className="self-stretch cursor-default group"
        onPress={onCancel}
        showFocus={false}
        variant="ghost"
      >
        <div className="flex flex-col gap-1 items-center">
          <CircleX className="text-muted transition-[colors_transform] group-data-[hovered]:text-content-fg group-data-[hovered]:scale-110 transform" />
          <Keyboard {...KEYBOARD_STYLE}>Esc</Keyboard>
        </div>
      </Button>

      <Separator className="h-[60px]" orientation="vertical" spacing="sm" />

      <RadioGroup
        aria-label="Recording type"
        className="grow"
        orientation="horizontal"
        value={recordingType}
        onChange={(value) => {
          setRecordingType(value as RecordingType);
        }}
      >
        <IconRadio
          aria-label="Region"
          icon={<SquareDashed size={30} />}
          shortcut={<Keyboard {...KEYBOARD_STYLE}>1</Keyboard>}
          subtext="Region"
          value={RecordingType.Region}
        />

        <IconRadio
          aria-label="Window"
          icon={<AppWindowMac size={30} />}
          shortcut={<Keyboard {...KEYBOARD_STYLE}>2</Keyboard>}
          subtext="Window"
          value={RecordingType.Window}
        />

        <IconRadio
          aria-label="Screen"
          icon={<Monitor size={30} />}
          shortcut={<Keyboard {...KEYBOARD_STYLE}>3</Keyboard>}
          subtext="Screen"
          value={RecordingType.Screen}
        />
      </RadioGroup>

      <Separator className="h-[60px]" orientation="vertical" spacing="sm" />

      <div className="flex flex-col min-w-24 mr-2">
        <div className="flex flex-row justify-between px-2 text-content-fg">
          {permissions.screen && (
            <InputToggle
              offIcon={<VolumeOff size={16} />}
              onIcon={<Volume2 size={16} />}
              permission={permissions.screen}
              setValue={setSystemAudio}
              value={systemAudio}
              showRecordingInputOptions={() => {
                void onClickOptions();
              }}
            />
          )}

          {permissions.microphone && (
            <InputToggle
              offIcon={<MicOff size={16} />}
              onIcon={<Mic size={16} />}
              permission={permissions.microphone}
              setValue={setMicrophone}
              value={microphone}
              showRecordingInputOptions={() => {
                void onClickOptions();
              }}
            />
          )}

          {permissions.camera && (
            <InputToggle
              offIcon={<CameraOff size={16} />}
              onIcon={<Camera size={16} />}
              permission={permissions.camera}
              setValue={setCamera}
              value={camera}
              showRecordingInputOptions={() => {
                void onClickOptions();
              }}
            />
          )}
        </div>

        <Button
          ref={optionsButtonRef}
          className="justify-center transition-transform transform data-[hovered]:scale-110"
          showFocus={false}
          size="sm"
          variant="ghost"
          onPress={() => {
            void onClickOptions();
          }}
        >
          Options
        </Button>
      </div>

      <Sparkles
        icon={Sparkle}
        offset={{ x: { max: 70, min: 0 }, y: { max: 50, min: -10 } }}
        scale={{ max: 0.5, min: 0.2 }}
        sparklesCount={2}
      >
        <Button
          className="self-stretch cursor-default group"
          showFocus={false}
          variant="ghost"
        >
          <div className="flex flex-col gap-1 items-center">
            <Circle
              className="group-data-[hovered]:scale-110 transform transition-transform"
              size={40}
            />
            <Keyboard {...KEYBOARD_STYLE}>Enter</Keyboard>
          </div>
        </Button>
      </Sparkles>
    </div>
  );
};

export default RecordingControls;
