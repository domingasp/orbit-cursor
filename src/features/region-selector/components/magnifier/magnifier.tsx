import { PhysicalSize } from "@tauri-apps/api/dpi";
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
  const scaleFactorRef = useRef<number>(1);

  // Keep latest region rect without re-subscribing mouse listeners
  const regionRectRef = useRef(regionRect);
  useEffect(() => {
    regionRectRef.current = regionRect;
  }, [regionRect]);

  // Track last pointer to avoid jumping when effect reruns without an event
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const processFrame = (frame: ArrayBuffer) => {
    if (!fullsizeCanvasRef.current || !magnifiedCanvasRef.current) return;

    const fullsizeCtx = fullsizeCanvasRef.current.getContext("2d");
    const magnifiedCtx = magnifiedCanvasRef.current.getContext("2d");
    if (!fullsizeCtx || !magnifiedCtx) return;

    const rgbaArray = new Uint8ClampedArray(frame);
    const len = rgbaArray.length;

    // Determine the correct dimensions for this frame dynamically
    const candidates: Array<{ h: number; w: number }> = [];

    // Prefer the selected monitor's physical size
    if (selectedMonitor?.physicalSize) {
      const { height: ph, width: pw } = selectedMonitor.physicalSize;
      if (pw > 0 && ph > 0) candidates.push({ h: ph, w: pw });
    }

    if (width > 0 && height > 0) candidates.push({ h: height, w: width });

    if (selectedMonitor?.size) {
      const logicalW = Math.round(selectedMonitor.size.width);
      const logicalH = Math.round(selectedMonitor.size.height);
      const sf = selectedMonitor.scaleFactor;
      const physicalW = Math.round(logicalW * sf);
      const physicalH = Math.round(logicalH * sf);
      if (physicalW > 0 && physicalH > 0)
        candidates.push({ h: physicalH, w: physicalW });
      if (logicalW > 0 && logicalH > 0)
        candidates.push({ h: logicalH, w: logicalW });
    }

    if (
      fullsizeCanvasRef.current.width > 0 &&
      fullsizeCanvasRef.current.height > 0
    ) {
      candidates.push({
        h: fullsizeCanvasRef.current.height,
        w: fullsizeCanvasRef.current.width,
      });
    }

    const matched = candidates.find(({ h, w }) => w * h * 4 === len);
    if (!matched) {
      return;
    }

    if (
      fullsizeCanvasRef.current.width !== matched.w ||
      fullsizeCanvasRef.current.height !== matched.h
    ) {
      fullsizeCanvasRef.current.width = matched.w;
      fullsizeCanvasRef.current.height = matched.h;
    }

    const imageData = new ImageData(rgbaArray, matched.w, matched.h);
    fullsizeCtx.putImageData(imageData, 0, 0);
    latestImageDataRef.current = imageData;
  };

  const updateMagnifierPosition = (e?: MouseEvent) => {
    const factor = selectedMonitor?.scaleFactor ?? 1;

    const rect = regionRectRef.current;
    const minX = rect.x;
    const maxX = rect.x + rect.width;
    const minY = rect.y;
    const maxY = rect.y + rect.height;

    let x = Math.round(rect.x + rect.width / 2);
    let y = Math.round(rect.y + rect.height / 2);

    const dir = resizeDirection?.toLowerCase();
    const lastX = e?.clientX ?? lastPointerRef.current?.x;
    const lastY = e?.clientY ?? lastPointerRef.current?.y;

    if (dir) {
      // Clamping magnifier to region rect
      type Anchor = "min" | "max";
      const directionConfig: Record<
        string,
        {
          allowX?: boolean;
          allowY?: boolean;
          anchorX?: Anchor;
          anchorY?: Anchor;
        }
      > = {
        bottom: { allowX: true, anchorY: "max" },
        bottomleft: { anchorX: "min", anchorY: "max" },
        bottomright: { anchorX: "max", anchorY: "max" },
        left: { allowY: true, anchorX: "min" },
        right: { allowY: true, anchorX: "max" },
        top: { allowX: true, anchorY: "min" },
        topleft: { anchorX: "min", anchorY: "min" },
        topright: { anchorX: "max", anchorY: "min" },
      };

      const cfg = directionConfig[dir] ?? {};

      if (cfg.anchorX === "min") x = minX;
      if (cfg.anchorX === "max") x = maxX;
      if (cfg.anchorY === "min") y = minY;
      if (cfg.anchorY === "max") y = maxY;

      if (cfg.allowX && lastX != null) {
        x = Math.round(Math.max(minX, Math.min(lastX, maxX)));
      }
      if (cfg.allowY && lastY != null) {
        y = Math.round(Math.max(minY, Math.min(lastY, maxY)));
      }
    }

    // Final clamp, just in case
    x = Math.max(minX, Math.min(x, maxX));
    y = Math.max(minY, Math.min(y, maxY));

    setHandlePosition({
      logical: { x, y },
      physical: {
        x: Math.round(x * factor),
        y: Math.round(y * factor),
      },
    });
  };

  useEffect(() => {
    // Keep the last pointer and update magnifier position as the user moves
    const updateCursor = (e: MouseEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      updateMagnifierPosition(e);
    };

    updateMagnifierPosition();
    window.addEventListener("mousemove", updateCursor);
    return () => {
      window.removeEventListener("mousemove", updateCursor);
    };
  }, [resizeDirection]);

  useEffect(() => {
    processFrame(magnifierScreenshot);
  }, [magnifierScreenshot, width, height, selectedMonitor]);

  useEffect(() => {
    scaleFactorRef.current = selectedMonitor?.scaleFactor ?? 1;
  }, [selectedMonitor]);

  useEffect(() => {
    const initPhysical = () => {
      if (!selectedMonitor) return;
      const physicalH = selectedMonitor.physicalSize.height;
      const physicalW = selectedMonitor.physicalSize.width;
      const scaleFactor = selectedMonitor.scaleFactor;
      scaleFactorRef.current = scaleFactor;

      if (physicalW > 0 && physicalH > 0) {
        setSize(new PhysicalSize({ height: physicalH, width: physicalW }));

        fullsizeCanvasRef.current = document.createElement("canvas");
        fullsizeCanvasRef.current.width = physicalW;
        fullsizeCanvasRef.current.height = physicalH;
      }

      latestImageDataRef.current = null;
    };

    if (selectedMonitor) {
      initPhysical();
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

      let imageData = latestImageDataRef.current;
      if (!imageData) {
        processFrame(magnifierScreenshot);
        imageData = latestImageDataRef.current;
        if (!imageData) {
          animationFrameId = requestAnimationFrame(drawMagnifier);
          return;
        }
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
          <canvas
            ref={magnifiedCanvasRef}
            className="max-h-[100px] max-w-[100px] aspect-square"
          />

          <Boundary direction={resizeDirection} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
