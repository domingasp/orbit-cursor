import { LogicalPosition } from "@tauri-apps/api/dpi";
import { useEffect, useRef, useState } from "react";
import { HandleStyles, Rnd } from "react-rnd";
import { useShallow } from "zustand/react/shallow";

import {
  getDockBounds,
  resetPanels,
  updateDockOpacity,
} from "../../api/windows";
import {
  RecordingType,
  useRecordingPreferencesStore,
} from "../../stores/recording-preferences.store";
import {
  AppWindow,
  useWindowReopenStore,
} from "../../stores/window-open-state.store";

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

/**
 * Return a proximity value from 0 to 1 on how close two rects are.
 *
 * - Return 0 when intersecting,
 * - Return 1 when distance more than `maxProximity`,
 * - Return between 0 and 1 when distance is less then `maxProximity`
 * but not intersecting.
 *
 * @param rect1 Position and size of rect.
 * @param rect2 Start and end position of rect.
 * @param maxProximity Distance from which to calculate value between 0 and 1.
 * Any distance more than this will return 1.
 * @returns Value between 0 and 1 - 0 meaning intersecting and 1 meaning further
 * than `maxProximity`
 */
const getRectProximity = (
  rect1: {
    position: { x: number; y: number };
    size: { height: number; width: number };
  },
  rect2: {
    endPoint: LogicalPosition;
    startPoint: LogicalPosition;
  },
  maxProximity = 25
) => {
  const r1Left = rect1.position.x;
  const r1Top = rect1.position.y;
  const r1Right = r1Left + rect1.size.width;
  const r1Bottom = r1Top + rect1.size.height;

  const r2Left = rect2.startPoint.x;
  const r2Top = rect2.startPoint.y;
  const r2Right = rect2.endPoint.x;
  const r2Bottom = rect2.endPoint.y;

  // Minimum distance between rectangles
  const dx = Math.max(r2Left - r1Right, r1Left - r2Right, 0);
  const dy = Math.max(r2Top - r1Bottom, r1Top - r2Bottom, 0);

  const distance = Math.hypot(dx, dy);

  // When dock inside region
  if (
    r2Left >= r1Left &&
    r2Right <= r1Right &&
    r2Top >= r1Top &&
    r2Bottom <= r1Bottom
  ) {
    const toLeft = r2Left - r1Left;
    const toRight = r1Right - r2Right;
    const toTop = r2Top - r1Top;
    const toBottom = r1Bottom - r2Bottom;
    const minEdgeDist = Math.min(toLeft, toRight, toTop, toBottom);
    return Math.min(1, minEdgeDist / maxProximity);
  }

  return Math.min(1, distance / maxProximity);
};

const RegionSelector = () => {
  const startRecordingDockOpened = useWindowReopenStore(
    useShallow((state) => state.windows[AppWindow.StartRecordingDock])
  );
  const [region, setRegion, recordingType, selectedMonitor] =
    useRecordingPreferencesStore(
      useShallow((state) => [
        state.region,
        state.setRegion,
        state.recordingType,
        state.selectedMonitor,
      ])
    );

  const [dockBounds, setDockBounds] =
    useState<Awaited<ReturnType<typeof getDockBounds>>>();
  const [position, setPosition] = useState(region.position);
  const [size, setSize] = useState(region.size);
  const previousProximity = useRef(0);

  // To avoid too many storage updates we only update store at the end
  const persist = () => {
    setRegion({ position, size });
    updateDockOpacity(1);
    previousProximity.current = -1; // ensure calculation happens
  };

  useEffect(() => {
    if (startRecordingDockOpened) {
      void getDockBounds().then((bounds) => {
        setDockBounds(bounds);
      });
    }
  }, [startRecordingDockOpened]);

  // Fits region into monitor
  useEffect(() => {
    if (!selectedMonitor) return;

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

    persist();
  }, [selectedMonitor]);

  useEffect(() => {
    if (dockBounds) {
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
    <div className="relative w-[100vw] h-[100vh] overflow-hidden">
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
          className="fill-black/50"
          height="100%"
          mask="url(#cutout)"
          width="100%"
        />
      </svg>

      <Rnd
        bounds="parent"
        className="border-white border-2 border-dashed"
        onDragStart={resetPanels}
        onDragStop={persist}
        onResizeStart={resetPanels}
        onResizeStop={persist}
        position={{ x: position.x, y: position.y }}
        resizeHandleStyles={handleStyles}
        size={{ height: size.height, width: size.width }}
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
    </div>
  );
};

export default RegionSelector;
