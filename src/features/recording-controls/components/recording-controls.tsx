import { getCurrentWindow } from "@tauri-apps/api/window";
import { Circle, CircleX, Sparkle } from "lucide-react";
import { ComponentProps, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  hideStartRecordingDock,
  showRecordingInputOptions,
} from "../../../api/windows";
import Button from "../../../components/button/button";
import Keyboard from "../../../components/keyboard/keyboard";
import Separator from "../../../components/separator/separator";
import Sparkles from "../../../components/sparkles/sparkles";
import { clearInteractionAttributes } from "../../../lib/styling";
import { useRecordingStateStore } from "../../../stores/recording-state.store";
import {
  AppWindow,
  useWindowReopenStore,
} from "../../../stores/window-open-state.store";
import { startRecording } from "../api/recording-state";

import InputToggleGroup from "./input-toggle-groups";
import RecordingTypeRadioGroup from "./recording-type-radio-group";

const KEYBOARD_STYLE: ComponentProps<typeof Keyboard> = {
  size: "xs",
  variant: "ghost",
};

const RecordingControls = () => {
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const setWindowOpenState = useWindowReopenStore(
    useShallow((state) => state.setWindowOpenState)
  );

  const setIsRecording = useRecordingStateStore(
    useShallow((state) => state.setIsRecording)
  );

  const onCancel = () => {
    clearInteractionAttributes();
    setWindowOpenState(AppWindow.StartRecordingDock, false);
    hideStartRecordingDock();
  };

  const openRecordingInputOptions = async () => {
    if (!optionsButtonRef.current) return;
    clearInteractionAttributes();

    const { left, width } = optionsButtonRef.current.getBoundingClientRect();
    const currentWindow = getCurrentWindow();
    const scaleFactor = await currentWindow.scaleFactor();
    const { x } = (await currentWindow.outerPosition()).toLogical(scaleFactor);

    // Position at center x of options button,
    showRecordingInputOptions(x + (left + width / 2));
  };

  const onStartRecording = () => {
    onCancel(); // Closes dock
    startRecording();
    setIsRecording(true);
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

      <RecordingTypeRadioGroup />

      <Separator className="h-[60px]" orientation="vertical" spacing="sm" />

      <div className="flex flex-col min-w-24 mr-2">
        <InputToggleGroup
          openRecordingInputOptions={openRecordingInputOptions}
        />

        <Button
          ref={optionsButtonRef}
          className="justify-center transition-transform transform data-[hovered]:scale-110"
          showFocus={false}
          size="sm"
          variant="ghost"
          onPress={() => {
            void openRecordingInputOptions();
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
          onPress={() => {
            onStartRecording();
          }}
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
