import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { CircleSlash2, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../../../components/base/button/button";
import { OverflowShadow } from "../../../components/base/overflow-shadow/overflow-shadow";
import { events } from "../../../types/events";
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
    const unlisten = listen(events.WINDOW_THUMBNAILS_GENERATED, () => {
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
      listWindows(true);
    }
  }, [isExpanded]);

  if (!thumbnailsGenerated) {
    return (
      <div className="h-full w-full inset-shadow-full text-content-fg flex items-center justify-center">
        <LoaderCircle className="animate-spin" size={64} />
      </div>
    );
  }

  if (windows.length === 0)
    return (
      <div className="w-full h-full inset-shadow-full flex flex-row items-center justify-center gap-4 text-content-fg font-semibold text-2xl">
        <CircleSlash2 size={64} />
        No Windows Found
      </div>
    );

  return (
    <OverflowShadow orientation="vertical" insetShadow>
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
    </OverflowShadow>
  );
};
