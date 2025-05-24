import { Channel } from "@tauri-apps/api/core";
import { Camera, CameraOff } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "../../../../lib/styling";
import {
  Item,
  selectedItem,
} from "../../../../stores/standalone-listbox.store";
import {
  listCameras,
  startCameraStream,
  stopCameraStream,
} from "../../api/camera";
import { ListBoxes } from "../../types";
import InputSelect from "../input-select";

const CameraSelect = () => {
  const channel = useRef<Channel>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageDataRef = useRef<ImageData>(null);
  const [dimensions, setDimensions] = useState({ height: 0, width: 0 });

  const [noDevice, setNoDevice] = useState(false);

  const fetchItems = async (): Promise<Item[]> => {
    const cameras = await listCameras();
    return cameras.map(({ index, name }) => ({ id: index, label: name }));
  };

  const processFrame = (buffer: ArrayBuffer) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: false });
    if (!canvas || !ctx) return;

    // Decode width and height from bytes
    const view = new DataView(buffer);
    const width = view.getUint32(0, true);
    const height = view.getUint32(4, true);

    if (width !== dimensions.width || height !== dimensions.height) {
      setDimensions({ height, width });
      canvas.width = width;
      canvas.height = height;
      imageDataRef.current = new ImageData(width, height);
    }

    if (!imageDataRef.current) return;

    imageDataRef.current.data.set(new Uint8ClampedArray(buffer, 8));
    ctx.putImageData(imageDataRef.current, 0, 0);
  };

  const onChange = async (selectedItems: Item[], isDockOpen: boolean) => {
    await stopCameraStream();
    if (!isDockOpen) return;

    const selectedDevice = selectedItem(selectedItems);
    if (selectedDevice !== null) {
      setNoDevice(false);
      channel.current = new Channel();
      channel.current.onmessage = (message) => {
        processFrame(message as ArrayBuffer);
      };

      startCameraStream(Number(selectedDevice), channel.current);
    } else {
      setNoDevice(true);
    }
  };

  return (
    <div className="flex flex-row min-w-full gap-2 items-center">
      <div className="relative aspect-video w-full max-w-1/4 bg-muted/30 rounded-sm text-muted flex justify-center items-center overflow-hidden">
        <canvas
          ref={canvasRef}
          className={cn(
            "w-full h-full object-contain transform -scale-x-100",
            noDevice && "opacity-0"
          )}
        />

        {noDevice && (
          <div className="absolute">
            <CameraOff size={20} />
          </div>
        )}
      </div>

      <InputSelect
        fetchItems={fetchItems}
        icon={<Camera size={14} />}
        id={ListBoxes.Camera}
        label="Camera"
        onChange={onChange}
        placeholder="No camera"
      />
    </div>
  );
};

export default CameraSelect;
