import { useQuery } from "@tanstack/react-query";
import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { CircleSlash2, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import Button from "../../../components/button/button";
import { Events } from "../../../types/events";
import { listWindows, WindowDetails } from "../api/recording-sources";

type WindowSelectorProps = {
  isExpanded: boolean;
  onSelect: (window: WindowDetails | null) => void;
  selectedWindow: WindowDetails | null;
};
const WindowSelector = ({
  isExpanded,
  onSelect,
  selectedWindow,
}: WindowSelectorProps) => {
  const [thumbnailsGenerated, setThumbnailsGenerated] = useState(false);

  const { data: windows, isLoading } = useQuery({
    enabled: isExpanded,
    queryFn: async () => {
      const windows = await listWindows(isExpanded);

      return windows.sort((a, b) => {
        const appIconCompare = (a.appIconPath ?? "").localeCompare(
          b.appIconPath ?? ""
        );
        if (appIconCompare !== 0) return appIconCompare;

        return a.title.localeCompare(b.title);
      });
    },
    queryKey: ["windows", isExpanded],
  });

  useEffect(() => {
    const unlisten = listen(Events.WindowThumbnailsGenerated, () => {
      setThumbnailsGenerated(true);
    });

    return () => {
      void unlisten.then((f) => {
        f();
      });
    };
  }, []);

  if (isLoading || !thumbnailsGenerated) {
    return (
      <LoaderCircle
        className="self-center animate-spin text-content-fg"
        size={64}
      />
    );
  }

  if (windows?.length === 0)
    return (
      <div className="self-center flex flex-row items-center gap-4 text-content-fg font-semibold text-2xl">
        <CircleSlash2 size={64} />
        No Windows Found
      </div>
    );

  return (
    <div className="grid grid-cols-4 gap-2 p-4">
      {windows?.map((window) => (
        <Button
          key={window.id}
          className="relative flex flex-col items-start border-content-fg/5 border-1"
          color="info"
          variant={selectedWindow?.id === window.id ? "soft" : "ghost"}
          onPress={() => {
            onSelect(window);
          }}
        >
          <div className="flex flex-row gap-1 items-center max-w-full sticky top-2">
            {window.appIconPath && (
              <img
                height={32}
                src={convertFileSrc(window.appIconPath)}
                width={32}
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

export default WindowSelector;
