import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, TvMinimalPlay, X } from "lucide-react";

import { Button } from "../../../components/base/button/button";
import { cn } from "../../../lib/styling";
import { getPlatform } from "../../../stores/hotkeys.store";

type TitlebarProps = {
  children?: React.ReactNode;
  onPressRecordings?: () => void;
};

export const Titlebar = ({ children, onPressRecordings }: TitlebarProps) => {
  const appWindow = getCurrentWindow();

  return (
    <div
      className="relative flex flex-row justify-center items-center p-1 text-sm z-1"
      data-tauri-drag-region
    >
      <div
        className={cn(
          "absolute left-0.5 top-0.75 flex flex-row gap-1.5",
          getPlatform() === "macos" && "left-17.5"
        )}
      >
        <Button
          className="font-light"
          onPress={onPressRecordings}
          size="sm"
          variant="ghost"
        >
          <TvMinimalPlay size={12} />
          Recordings
        </Button>
      </div>

      <div>{children}</div>

      {getPlatform() === "windows" && (
        <div className="absolute right-0.5 top-0.5 flex flex-row gap-1.5">
          <Button
            color="muted"
            size="sm"
            variant="ghost"
            onPress={() => {
              void appWindow.minimize();
            }}
            icon
          >
            <Minus />
          </Button>

          <Button
            color="muted"
            size="sm"
            variant="ghost"
            onPress={() => {
              void appWindow.toggleMaximize();
            }}
            icon
          >
            <Square size={13} />
          </Button>

          <Button
            color="error"
            size="sm"
            variant="ghost"
            onPress={() => {
              void appWindow.close();
            }}
            icon
          >
            <X />
          </Button>
        </div>
      )}
    </div>
  );
};
