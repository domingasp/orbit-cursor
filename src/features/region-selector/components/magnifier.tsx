import { Channel } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";

import { startMagnifierCapture, stopMagnifierCapture } from "../api/magnifier";

type MagnifierProps = {
  isVisible: boolean;
};
const Magnifier = ({ isVisible }: MagnifierProps) => {
  const channel = useRef<Channel>(null);

  useEffect(() => {
    if (isVisible) {
      channel.current = new Channel();
      channel.current.onmessage = (message) => {
        // TODO PROCESS
        console.log("frame received", message);
      };

      startMagnifierCapture(channel.current);
    } else {
      stopMagnifierCapture();
    }
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="absolute bg-red-500"
          exit={{ opacity: 0, scale: 0 }}
          initial={{ opacity: 0, scale: 0 }}
        >
          MAGNIFY
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Magnifier;
