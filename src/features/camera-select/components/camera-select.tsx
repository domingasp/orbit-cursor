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
  PermissionType,
  usePermissionsStore,
} from "../../../stores/permissions.store";
import { useRecordingStateStore } from "../../../stores/recording-state.store";
import {
  Item,
  selectedItem,
  StandaloneListBoxes,
  useStandaloneListBoxStore,
} from "../../../stores/standalone-listbox.store";
import {
  AppWindow,
  useWindowReopenStore,
} from "../../../stores/window-open-state.store";
import { Events } from "../../../types/events";
import {
  listCameras,
  startCameraStream,
  stopCameraStream,
} from "../api/camera";

export const CameraSelect = () => {
  const permission = usePermissionsStore((state) => state.permissions.camera);
  const recordingInputOptionsOpened = useWindowReopenStore(
    useShallow((state) => state.windows[AppWindow.RecordingInputOptions])
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

    const pixels = new Uint8ClampedArray(buffer, 8);
    void createImageBitmap(new ImageData(pixels, width, height)).then((bmp) => {
      ctx.drawImage(bmp, 0, 0);
    });
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
        onFrameMessage(message as ArrayBuffer);
      };

      startCameraStream(selectedDevice.toString(), channel.current);
    } else {
      setIsDeviceSelected(false);
      // Give time for channel message to end
      setTimeout(clearCanvas, 30);
    }
  };

  const onFrameMessage = (message: ArrayBuffer) => {
    latestFrameRef.current = message;
  };

  useEffect(() => {
    const unlistenStandaloneListBox = listen(
      Events.ClosedStandaloneListBox,
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
        "relative flex flex-col gap-2 items-center rounded-md",
        !permission.hasAccess && "bg-content"
      )}
    >
      <GrantAccessOverlay
        icon={<Camera size={12} />}
        permission={permission}
        type={PermissionType.Camera}
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
        id={StandaloneListBoxes.Camera}
        label="Camera"
        onChange={onChange}
        placeholder="No camera"
      />
    </div>
  );
};
