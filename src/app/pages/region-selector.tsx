import { useEffect, useState } from "react";
import { HandleStyles, Rnd } from "react-rnd";
import { useShallow } from "zustand/react/shallow";

import { resetPanels } from "../../api/windows";
import {
  RecordingType,
  useRecordingPreferencesStore,
} from "../../stores/recording-preferences.store";

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

const RegionSelector = () => {
  const [region, setRegion, recordingType, selectedMonitor] =
    useRecordingPreferencesStore(
      useShallow((state) => [
        state.region,
        state.setRegion,
        state.recordingType,
        state.selectedMonitor,
      ])
    );

  const [position, setPosition] = useState(region.position);
  const [size, setSize] = useState(region.size);

  // To avoid too many storage updates we only update store at the end
  const persist = () => {
    setRegion({ position, size });
  };

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
