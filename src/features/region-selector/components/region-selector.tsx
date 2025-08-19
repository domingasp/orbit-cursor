import { Channel } from "@tauri-apps/api/core";
import { Check, SquareDot } from "lucide-react";
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
  setRegionSelectorPassthrough,
  takeDisplayScreenshot,
  setRegionSelectorOpacity,
} from "../../../api/windows";
import { Button } from "../../../components/button/button";
import { AspectRatio } from "../../../components/shared/aspect-ratio/aspect-ratio";
import { CheckOnClickButton } from "../../../components/shared/check-on-click-button/check-on-click-button";
import { cn } from "../../../lib/styling";
import { getPlatform } from "../../../stores/hotkeys.store";
import {
  useRecordingStateStore,
  RecordingType,
} from "../../../stores/recording-state.store";
import { useRegionSelectorStore } from "../../../stores/region-selector.store";
import { ResizeDirection } from "../types";

import { Magnifier } from "./magnifier/magnifier";

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

export const RegionSelector = () => {
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
  const [isEditing, setIsEditing] = useRegionSelectorStore(
    useShallow((state) => [state.isEditing, state.setIsEditing])
  );

  const [resizeDirection, setResizeDirection] = useState<
    ResizeDirection | undefined
  >(undefined);
  const activeResizeHandleRef = useRef<HTMLElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useState<Awaited<ReturnType<typeof getDockBounds>>>();
  const [position, setPosition] = useState(region.position);
  const [size, setSize] = useState(region.size);

  const magnifierChannel = useRef<Channel<ArrayBuffer>>(null);
  const [magnifierScreenshot, setMagnifierScreenshot] =
    useState<ArrayBuffer | null>(null);

  const showRnd = !isRecording && isEditing;
  const showActionButtons =
    isEditing &&
    !isRecording &&
    activeResizeHandleRef.current == null &&
    !isDragging;

  const centerRegion = () => {
    if (!selectedMonitor) return;

    // Center within selected monitor keeping even coordinates (YUV sub-sampling constraint)
    const centeredXRaw = (selectedMonitor.size.width - size.width) / 2;
    const centeredYRaw = (selectedMonitor.size.height - size.height) / 2;

    let centeredX = Math.floor(centeredXRaw);
    let centeredY = Math.floor(centeredYRaw);

    if (centeredX % 2 !== 0) centeredX -= 1;
    if (centeredY % 2 !== 0) centeredY -= 1;
    if (centeredX < 0) centeredX = 0;
    if (centeredY < 0) centeredY = 0;

    setPosition({ x: centeredX, y: centeredY });
    setRegion({
      position: { x: centeredX + 1, y: centeredY + 1 },
      size: {
        height: Math.max(1, size.height - 2),
        width: Math.max(1, size.width - 2),
      },
    });
  };

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
    updateDockOpacity(isEditing ? 0 : 1);
    if (selectedMonitor) {
      magnifierChannel.current = new Channel();
      magnifierChannel.current.onmessage = (message) => {
        setMagnifierScreenshot(message);
      };

      setRegionSelectorPassthrough(!isEditing);

      // Cannot do it in one-shot rust side due to MacOS event loop. It does not
      // allow hide, take screenshot, and show in one function
      if (isEditing) {
        void setRegionSelectorOpacity(0).then(() => {
          if (magnifierChannel.current) {
            takeDisplayScreenshot(selectedMonitor.id, magnifierChannel.current);
            void setRegionSelectorOpacity(1);
          }
        });
      }
    }
  }, [isEditing]);

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
        // YUV420p requires even values for both size and position
        // for chroma subsampling - if any are odd, color bleeding will occur
        dragGrid={[2, 2]}
        onResizeStart={onResizeStart}
        onResizeStop={onResizeEnd}
        position={{ x: position.x, y: position.y }}
        resizeGrid={[2, 2]}
        resizeHandleClasses={handleClasses}
        resizeHandleStyles={handleStyles}
        size={{ height: size.height, width: size.width }}
        className={cn(
          "border-white border-2 border-dashed relative select-none transition-opacity",
          !showRnd && "opacity-0 invisible"
        )}
        onDrag={(_e, d) => {
          setPosition({ x: d.x, y: d.y });
        }}
        onDragStart={() => {
          resetPanels();
          setIsDragging(true);
        }}
        onDragStop={() => {
          onEnd();
          setIsDragging(false);
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

      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 top-0 transition-opacity opacity-0 cursor-move",
          "select-none flex items-center justify-center",
          getPlatform() === "macos" ? "top-12" : "top-2", // Lower on Mac cause NOTCH
          showActionButtons && "opacity-100 cursor-auto"
        )}
      >
        <div
          className={cn(
            "flex flex-row gap-2 p-2 bg-content rounded-md border-1 border-muted/25 pointer-events-none",
            showActionButtons && "pointer-events-auto"
          )}
        >
          <CheckOnClickButton onPress={centerRegion} size="sm" variant="ghost">
            <SquareDot size={14} />
            Center
          </CheckOnClickButton>

          <AspectRatio height={size.height} width={size.width} />

          <Button
            color="success"
            showFocus={false}
            size="sm"
            onPress={() => {
              setIsEditing(false);
            }}
          >
            <Check size={18} />
            Finish
          </Button>
        </div>
      </div>

      {magnifierScreenshot && (
        <Magnifier
          activeHandle={activeResizeHandleRef}
          magnifierScreenshot={magnifierScreenshot}
          resizeDirection={resizeDirection}
          regionRect={{
            height: size.height,
            width: size.width,
            x: position.x,
            y: position.y,
          }}
        />
      )}
    </div>
  );
};
