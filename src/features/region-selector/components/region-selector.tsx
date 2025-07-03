import { useState, useRef, useEffect } from "react";
import {
  HandleClasses,
  HandleStyles,
  Rnd,
  RndResizeStartCallback,
} from "react-rnd";
import { useShallow } from "zustand/react/shallow";

import {
  getDockBounds,
  updateDockOpacity,
  resetPanels,
} from "../../../api/windows";
import { cn } from "../../../lib/styling";
import {
  useRecordingStateStore,
  RecordingType,
} from "../../../stores/recording-state.store";
import {
  AppWindow,
  useWindowReopenStore,
} from "../../../stores/window-open-state.store";
import { ResizeDirection } from "../types";
import getRectProximity from "../utils/rect-proximity";

import Magnifier from "./magnifier/magnifier";

const handleStyle: React.CSSProperties = {
  background: "var(--color-content)",
  border: "solid 1px white",
  borderRadius: "100%",
  height: "12px",
  width: "12px",
};
const handleStyles: HandleStyles = {
  bottom: {
    cursor: "ns-resize",
    left: "50%",
    transform: "translateY(2px) translateX(-50%)",
    ...handleStyle,
  },
  bottomLeft: {
    cursor: "nesw-resize",
    transform: "translateX(3px) translateY(-3px)",
    ...handleStyle,
  },
  bottomRight: {
    cursor: "nwse-resize",
    transform: "translateX(-3px) translateY(-3px)",
    ...handleStyle,
  },
  left: {
    cursor: "ew-resize",
    top: "50%",
    transform: "translateX(-2px) translateY(-50%)",
    ...handleStyle,
  },
  right: {
    cursor: "ew-resize",
    top: "50%",
    transform: "translateX(2px) translateY(-50%)",
    ...handleStyle,
  },
  top: {
    cursor: "ns-resize",
    left: "50%",
    transform: "translateY(-2px) translateX(-50%)",
    ...handleStyle,
  },
  topLeft: {
    cursor: "nwse-resize",
    transform: "translateX(3px) translateY(3px)",
    ...handleStyle,
  },
  topRight: {
    cursor: "nesw-resize",
    transform: "translateX(-3px) translateY(3px)",
    ...handleStyle,
  },
};

// Classes to allow querying for element
const handleClasses: HandleClasses = {
  bottom: "bottom",
  bottomLeft: "bottomLeft",
  bottomRight: "bottomRight",
  left: "left",
  right: "right",
  top: "top",
  topLeft: "topLeft",
  topRight: "topRight",
};

const RegionSelector = () => {
  const startRecordingDockOpened = useWindowReopenStore(
    useShallow((state) => state.windows[AppWindow.StartRecordingDock])
  );
  const [region, setRegion, recordingType, selectedMonitor, isRecording] =
    useRecordingStateStore(
      useShallow((state) => [
        state.region,
        state.setRegion,
        state.recordingType,
        state.selectedMonitor,
        state.isRecording,
      ])
    );

  const [resizeDirection, setResizeDirection] = useState<
    ResizeDirection | undefined
  >(undefined);
  const activeResizeHandleRef = useRef<HTMLElement>(null);

  const [ignoreDockBounds, setIgnoreDockBounds] = useState(false);
  const [dockBounds, setDockBounds] =
    useState<Awaited<ReturnType<typeof getDockBounds>>>();
  const [position, setPosition] = useState(region.position);
  const [size, setSize] = useState(region.size);
  const previousProximity = useRef(0);

  // To avoid too many storage updates we only update store at the end
  const onEnd = () => {
    // We offset the position/size by a pixel to match the boundary,
    // otherwise an extra pixel is unexpectedly included
    setRegion({
      position: {
        x: position.x + 1,
        y: position.y + 1,
      },
      size: {
        height: Math.max(1, size.height - 2),
        width: Math.max(1, size.width - 2),
      },
    });
    updateDockOpacity(1);
    previousProximity.current = -1; // ensure calculation happens
  };

  const onResizeStart: RndResizeStartCallback = (_e, dir, _elementRef) => {
    resetPanels();
    setResizeDirection(dir);

    activeResizeHandleRef.current = document.getElementsByClassName(
      dir
    )[0] as HTMLElement;
  };

  const onResizeEnd = () => {
    onEnd();
    setResizeDirection(undefined);
    activeResizeHandleRef.current = null;
  };

  useEffect(() => {
    if (startRecordingDockOpened) {
      void getDockBounds().then((bounds) => {
        if (dockBounds === undefined) setDockBounds(bounds);

        // Dock bounds not relevant when region selector on monitor 2
        setIgnoreDockBounds(
          selectedMonitor !== null && selectedMonitor.id !== bounds.displayId
        );
      });
    }
  }, [startRecordingDockOpened, selectedMonitor]);

  // Fits region into monitor
  useEffect(() => {
    if (!selectedMonitor) return;

    // Make region fit into new monitor
    const maxX = selectedMonitor.size.width - size.width;
    const maxY = selectedMonitor.size.height - size.height;

    const clampedX = Math.max(0, Math.min(position.x, maxX));
    const clampedY = Math.max(0, Math.min(position.y, maxY));

    if (clampedX !== position.x || clampedY !== position.y) {
      setPosition({ x: clampedX, y: clampedY });
    }

    const MARGIN = 20; // Keeps handles accessible
    const clampedWidth = Math.min(
      size.width,
      selectedMonitor.size.width - MARGIN
    );
    const clampedHeight = Math.min(
      size.height,
      selectedMonitor.size.height - MARGIN
    );

    if (clampedWidth !== size.width || clampedHeight !== size.height) {
      setSize({ height: clampedHeight, width: clampedWidth });
    }

    onEnd();
  }, [selectedMonitor]);

  useEffect(() => {
    if (!ignoreDockBounds && dockBounds) {
      const proximity = getRectProximity(
        {
          position,
          size,
        },
        { ...dockBounds }
      );

      if (proximity !== previousProximity.current) {
        updateDockOpacity(proximity);
      }

      previousProximity.current = proximity;
    }
  }, [position, size]);

  if (recordingType !== RecordingType.Region) return;

  return (
    <div
      className={cn(
        "relative w-[100vw] h-[100vh] overflow-hidden",
        resizeDirection && "cursor-none [&_*]:cursor-none!"
      )}
    >
      <svg className="absolute w-full h-full pointer-events-none">
        <defs>
          <mask id="cutout">
            <rect className="fill-white" height="100%" width="100%" />
            <rect
              className="fill-black"
              height={size.height}
              width={size.width}
              x={position.x}
              y={position.y}
            />
          </mask>
        </defs>

        <rect
          height="100%"
          mask="url(#cutout)"
          width="100%"
          className={cn(
            "fill-black/50 transition-colors",
            isRecording && "fill-black/33"
          )}
        />
      </svg>

      <Rnd
        bounds="parent"
        onDragStart={resetPanels}
        onDragStop={onEnd}
        onResizeStart={onResizeStart}
        onResizeStop={onResizeEnd}
        position={{ x: position.x, y: position.y }}
        resizeHandleClasses={handleClasses}
        resizeHandleStyles={handleStyles}
        size={{ height: size.height, width: size.width }}
        className={cn(
          "border-white border-2 border-dashed",
          isRecording && "invisible"
        )}
        onDrag={(_e, d) => {
          setPosition({ x: d.x, y: d.y });
        }}
        // eslint-disable-next-line @typescript-eslint/max-params
        onResize={(_e, _direction, ref, _delta, position) => {
          setSize({
            height: parseInt(ref.style.height, 10),
            width: parseInt(ref.style.width, 10),
          });
          setPosition(position);
        }}
      />

      <Magnifier
        activeHandle={activeResizeHandleRef}
        resizeDirection={resizeDirection}
      />
    </div>
  );
};

export default RegionSelector;
