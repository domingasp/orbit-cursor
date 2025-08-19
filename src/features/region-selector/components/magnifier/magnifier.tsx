import { LogicalSize, PhysicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AnimatePresence, motion } from "motion/react";
import { RefObject, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useRecordingStateStore } from "../../../../stores/recording-state.store";
import { ResizeDirection } from "../../types";

import { Boundary } from "./boundary";

type MagnifierProps = {
  activeHandle: RefObject<HTMLElement | null>;
  magnifierScreenshot: ArrayBuffer;
  regionRect: { height: number; width: number; x: number; y: number };
  resizeDirection: ResizeDirection | undefined;
  zoomFactor?: number;
};

export const Magnifier = ({
  activeHandle,
  magnifierScreenshot,
  regionRect,
  resizeDirection,
  zoomFactor = 5,
}: MagnifierProps) => {
  const selectedMonitor = useRecordingStateStore(
    useShallow((state) => state.selectedMonitor)
  );

  const [{ height, width }, setSize] = useState<PhysicalSize>(
    new PhysicalSize({ height: 1080, width: 1920 })
  );
  const [handlePosition, setHandlePosition] = useState({
    logical: { x: 0, y: 0 },
    physical: { x: 0, y: 0 },
  });
  const fullsizeCanvasRef = useRef<HTMLCanvasElement>(null);
  const latestImageDataRef = useRef<ImageData | null>(null);
  const magnifiedCanvasRef = useRef<HTMLCanvasElement>(null);

  const processFrame = (frame: ArrayBuffer) => {
    if (!fullsizeCanvasRef.current || !magnifiedCanvasRef.current) return;

    const fullsizeCtx = fullsizeCanvasRef.current.getContext("2d");
    const magnifiedCtx = magnifiedCanvasRef.current.getContext("2d");
    if (!fullsizeCtx || !magnifiedCtx) return;

    if (
      fullsizeCanvasRef.current.width !== width ||
      fullsizeCanvasRef.current.height !== height
    ) {
      fullsizeCanvasRef.current.width = width;
      fullsizeCanvasRef.current.height = height;
    }
    // Put full size image in canvas
    const rgbaArray = new Uint8ClampedArray(frame);
    const imageData = new ImageData(rgbaArray, width, height);
    fullsizeCtx.putImageData(imageData, 0, 0);
    latestImageDataRef.current = imageData;
  };

  const updateMagnifierPosition = (e?: MouseEvent) => {
    void getCurrentWindow()
      .scaleFactor()
      .then((scaleFactor) => {
        if (!activeHandle.current) return;
        const bounds = activeHandle.current.getBoundingClientRect();
        // Default to handle center
        let x = Math.round(bounds.x + bounds.width / 2);
        let y = Math.round(bounds.y + bounds.height / 2);

        // Allow moving along a cardinal axis
        if (e && resizeDirection) {
          const dir = resizeDirection.toLowerCase();
          if (dir === "top" || dir === "bottom") {
            const minX = regionRect.x;
            const maxX = regionRect.x + regionRect.width;
            x = Math.max(minX, Math.min(e.clientX, maxX));
          } else if (dir === "left" || dir === "right") {
            const minY = regionRect.y;
            const maxY = regionRect.y + regionRect.height;
            y = Math.max(minY, Math.min(e.clientY, maxY));
          }
        }

        setHandlePosition({
          logical: { x, y },
          physical: {
            x: x * scaleFactor,
            y: y * scaleFactor,
          },
        });
      });
  };

  useEffect(() => {
    processFrame(magnifierScreenshot);
    const updateCursor = (e: MouseEvent) => {
      updateMagnifierPosition(e);
    };

    updateMagnifierPosition();
    window.addEventListener("mousemove", updateCursor);
    return () => {
      window.removeEventListener("mousemove", updateCursor);
    };
  }, [resizeDirection]);

  useEffect(() => {
    // Pixel data is physical size
    const toPhysical = async (size: LogicalSize) => {
      const scaleFactor = await getCurrentWindow().scaleFactor();
      const physicalHeight = size.height * scaleFactor;
      const physicalWidth = size.width * scaleFactor;

      setSize(
        new PhysicalSize({
          height: physicalHeight,
          width: physicalWidth,
        })
      );

      fullsizeCanvasRef.current = document.createElement("canvas");
      fullsizeCanvasRef.current.width = physicalWidth;
      fullsizeCanvasRef.current.height = physicalHeight;
    };

    if (selectedMonitor) {
      void toPhysical(selectedMonitor.size);
    }
  }, [selectedMonitor]);

  useEffect(() => {
    let animationFrameId: number;

    const drawMagnifier = () => {
      if (!magnifiedCanvasRef.current || activeHandle.current === null) return;
      const magnifiedCtx = magnifiedCanvasRef.current.getContext("2d");
      if (!magnifiedCtx || !fullsizeCanvasRef.current) {
        animationFrameId = requestAnimationFrame(drawMagnifier);
        return;
      }

      const imageData = latestImageDataRef.current;
      if (!imageData) {
        animationFrameId = requestAnimationFrame(drawMagnifier);
        return;
      }

      const { x, y } = handlePosition.physical;
      const cropSize = 40;
      const zoomedSize = cropSize * zoomFactor;

      // Draw the last image frame to the fullsize canvas for extraction
      const fullsizeCtx = fullsizeCanvasRef.current.getContext("2d");
      if (fullsizeCtx) {
        fullsizeCtx.putImageData(imageData, 0, 0);
      }

      if (
        magnifiedCanvasRef.current.width !== zoomedSize ||
        magnifiedCanvasRef.current.height !== zoomedSize
      ) {
        magnifiedCanvasRef.current.width = zoomedSize;
        magnifiedCanvasRef.current.height = zoomedSize;
      }

      magnifiedCtx.clearRect(0, 0, zoomedSize, zoomedSize);
      magnifiedCtx.imageSmoothingEnabled = false;
      magnifiedCtx.drawImage(
        // Source
        fullsizeCanvasRef.current,
        x - cropSize / 2,
        y - cropSize / 2,
        cropSize,
        cropSize,
        // Destination
        0,
        0,
        zoomedSize,
        zoomedSize
      );

      animationFrameId = requestAnimationFrame(drawMagnifier);
    };

    animationFrameId = requestAnimationFrame(drawMagnifier);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [handlePosition]);

  return (
    <AnimatePresence>
      {resizeDirection && (
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="absolute pointer-events-none shadow-md rounded-sm overflow-hidden border-1 border-content-fg/10 select-none"
          exit={{ opacity: 0, scale: 0 }}
          initial={{ opacity: 0, scale: 0, x: "-50%", y: "-50%" }}
          style={{
            left: `${handlePosition.logical.x.toString()}px`,
            position: "fixed",
            top: `${handlePosition.logical.y.toString()}px`,
          }}
        >
          <canvas ref={magnifiedCanvasRef} className="max-h-[100px]" />

          <Boundary direction={resizeDirection} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
