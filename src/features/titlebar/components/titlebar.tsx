import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

import { Button } from "../../../components/button/button";
import { getPlatform } from "../../../stores/hotkeys.store";

type TitlebarProps = {
  children?: React.ReactNode;
};

export const Titlebar = ({ children }: TitlebarProps) => {
  const appWindow = getCurrentWindow();

  return (
    <div
      className="relative flex flex-row justify-center p-1 text-sm"
      data-tauri-drag-region
    >
      {children}

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
