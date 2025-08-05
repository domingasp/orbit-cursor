import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { CircleSlash2, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../../../components/button/button";
import { Events } from "../../../types/events";
import { listWindows, WindowDetails } from "../api/recording-sources";

type WindowSelectorProps = {
  isExpanded: boolean;
  onSelect: (window: WindowDetails | null) => void;
  selectedWindow: WindowDetails | null;
  windows: WindowDetails[];
};

export const WindowSelector = ({
  isExpanded,
  onSelect,
  selectedWindow,
  windows,
}: WindowSelectorProps) => {
  const [thumbnailsGenerated, setThumbnailsGenerated] = useState(false);

  useEffect(() => {
    const unlisten = listen(Events.WindowThumbnailsGenerated, () => {
      setThumbnailsGenerated(true); // Parent responsible for providing windows
    });

    return () => {
      void unlisten.then((f) => {
        f();
      });
    };
  }, []);

  useEffect(() => {
    setThumbnailsGenerated(false);
    if (isExpanded) {
      void listWindows(true);
    }
  }, [isExpanded]);

  if (!thumbnailsGenerated) {
    return (
      <LoaderCircle
        className="self-center animate-spin text-content-fg"
        size={64}
      />
    );
  }

  if (windows.length === 0)
    return (
      <div className="self-center flex flex-row items-center gap-4 text-content-fg font-semibold text-2xl">
        <CircleSlash2 size={64} />
        No Windows Found
      </div>
    );

  return (
    <div className="grid grid-cols-4 gap-2 p-4">
      {windows.map((window, i) => (
        <Button
          key={`${window.id.toString()}-${i.toString()}`}
          className="relative flex flex-col items-start border-content-fg/5 border-1"
          color="info"
          variant={selectedWindow?.id === window.id ? "soft" : "ghost"}
          onPress={() => {
            onSelect(window);
          }}
        >
          <div className="flex flex-row gap-2 items-center max-w-full sticky top-2">
            {window.appIconPath && (
              <img
                height={18}
                src={convertFileSrc(window.appIconPath)}
                width={18}
              />
            )}
            <span className="truncate text-content-fg text-xs">
              {window.title}
            </span>
          </div>

          {window.thumbnailPath && (
            <img
              className="shadow-md rounded-sm max-h-30 self-center"
              src={convertFileSrc(window.thumbnailPath)}
            />
          )}
        </Button>
      ))}
    </div>
  );
};
