import { Channel } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Camera, CameraOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { GrantAccessOverlay } from "../../../components/shared/grant-access-overlay/grant-access-overlay";
import { InputSelect } from "../../../components/shared/input-select/input-select";
import { cn } from "../../../lib/styling";
import {
  permissionType,
  usePermissionsStore,
} from "../../../stores/permissions.store";
import { useRecordingStateStore } from "../../../stores/recording-state.store";
import {
  Item,
  selectedItem,
  standaloneListBoxes,
  useStandaloneListBoxStore,
} from "../../../stores/standalone-listbox.store";
import {
  appWindow,
  useWindowReopenStore,
} from "../../../stores/window-open-state.store";
import { events } from "../../../types/events";
import {
  listCameras,
  startCameraStream,
  stopCameraStream,
} from "../api/camera";

export const CameraSelect = () => {
  const permission = usePermissionsStore((state) => state.permissions.camera);
  const recordingInputOptionsOpened = useWindowReopenStore(
    useShallow((state) => state.windows[appWindow.RECORDING_INPUT_OPTIONS])
  );
  const cameraHasWarning = useRecordingStateStore(
    useShallow((state) => state.cameraHasWarning)
  );

  const { closeListBox } = useStandaloneListBoxStore((state) => state);

  const channel = useRef<Channel>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ height: 0, width: 0 });

  const latestFrameRef = useRef<ArrayBuffer | null>(null);

  const [isDeviceSelected, setIsDeviceSelected] = useState(false);

  const fetchItems = async (): Promise<Item[]> => {
    const cameras = await listCameras();
    return cameras.map((name) => ({ id: name, label: name }));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: false });
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const processFrame = (buffer: ArrayBuffer) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: false });
    if (!canvas || !ctx) return;

    // Decode width and height from byte header
    const view = new DataView(buffer);
    const width = view.getUint32(0, true);
    const height = view.getUint32(4, true);

    if (width !== dimensions.width || height !== dimensions.height) {
      setDimensions({ height, width });
      canvas.width = width;
      canvas.height = height;
    }

    const imageData = buffer.slice(8);

    if (isMJPEG(imageData)) {
      void renderJPEGFrame(imageData);
    } else if (isRGBA(imageData)) {
      const pixels = new Uint8ClampedArray(buffer, 8);
      void createImageBitmap(new ImageData(pixels, width, height)).then(
        (bmp) => {
          ctx.drawImage(bmp, 0, 0);
        }
      );
    } else {
      console.warn("Unrecognized frame format");
    }
  };

  const renderJPEGFrame = async (buffer: ArrayBuffer) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const blob = new Blob([buffer], { type: "image/jpeg" });

    try {
      const imgBitmap = await createImageBitmap(blob);
      ctx.drawImage(imgBitmap, 0, 0);
    } catch {
      /* ignore failed frames */
    }
  };

  const isRGBA = (data: ArrayBuffer) => {
    const uint8Array = new Uint8Array(data);
    return uint8Array.length % 4 === 0;
  };

  const isMJPEG = (data: ArrayBuffer) => {
    const uint8Array = new Uint8Array(data);
    return uint8Array[0] === 0xff && uint8Array[1] === 0xd8;
  };

  const onChange = async (selectedItems: Item[], isPanelOpen: boolean) => {
    await stopCameraStream();

    const selectedDevice = selectedItem(selectedItems)?.id;
    if (
      isPanelOpen &&
      selectedDevice !== null &&
      selectedDevice !== undefined
    ) {
      setIsDeviceSelected(true);
      channel.current = new Channel();
      channel.current.onmessage = (message) => {
        processFrame(message as ArrayBuffer);
      };

      startCameraStream(selectedDevice.toString(), channel.current);
    } else {
      setIsDeviceSelected(false);
      // Give time for channel message to end
      setTimeout(clearCanvas, 30);
    }
  };

  useEffect(() => {
    const unlistenStandaloneListBox = listen(
      events.CLOSED_STANDALONE_LIST_BOX,
      () => {
        closeListBox();
      }
    );

    return () => {
      void unlistenStandaloneListBox.then((f) => {
        f();
      });
    };
  }, []);

  useEffect(() => {
    let frameLoopId: number;

    const renderLatestFrame = () => {
      if (latestFrameRef.current) {
        processFrame(latestFrameRef.current);
        latestFrameRef.current = null;
      }
      frameLoopId = requestAnimationFrame(renderLatestFrame);
    };

    frameLoopId = requestAnimationFrame(renderLatestFrame);

    return () => {
      cancelAnimationFrame(frameLoopId);
    };
  }, []);

  useEffect(() => {
    clearCanvas();
  }, [recordingInputOptionsOpened]);

  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 overflow-hidden rounded-md",
        !permission.hasAccess && "bg-content"
      )}
    >
      <GrantAccessOverlay
        icon={<Camera size={12} />}
        permission={permission}
        type={permissionType.CAMERA}
      />

      <div className="w-40 aspect-video relative bg-content-fg/10 text-muted flex justify-center items-center rounded-md overflow-hidden shadow-sm">
        <canvas
          ref={canvasRef}
          className={cn(
            "w-full h-full object-contain transform -scale-x-100 rounded-md",
            (!isDeviceSelected || cameraHasWarning) && "opacity-0"
          )}
        />

        <AnimatePresence>
          {(!isDeviceSelected || cameraHasWarning) && (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="absolute"
              exit={{ opacity: 0, scale: 0 }}
              initial={{ opacity: 0, scale: 0 }}
            >
              <CameraOff size={20} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <InputSelect
        fetchItems={fetchItems}
        icon={<Camera size={14} />}
        id={standaloneListBoxes.CAMERA}
        label="Camera"
        onChange={onChange}
        placeholder="No camera"
      />
    </div>
  );
};
