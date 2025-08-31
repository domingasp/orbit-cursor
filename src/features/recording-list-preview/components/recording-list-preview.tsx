import { Hammer, Telescope } from "lucide-react";
import { AnimatePresence, motion, MotionProps } from "motion/react";

import { ContentRotate } from "../../../components/base/content-rotate/content-rotate";
import { cn } from "../../../lib/styling";
import { RecordingName } from "../../recording-name/components/recording-name";
import { RecordingMetadata } from "../../recordings-list/api/recordings";

import { Controls } from "./controls";

const scaleAndFade: MotionProps = {
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0 },
  initial: { opacity: 0, scale: 0 },
};

const NonPreviewPlayerState = ({
  children,
  visible,
}: {
  visible: boolean;
  children?: React.ReactNode;
}) => {
  return (
    <AnimatePresence mode="popLayout">
      {visible && (
        <motion.div
          {...scaleAndFade}
          className="flex flex-col items-center gap-1 text-muted text-lg font-light"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

type RecordingListPreviewProps = {
  selected: RecordingMetadata[];
  onDelete?: () => void;
  onHardDelete?: () => void;
  recentlyDeletedVisible?: boolean;
  setRecentlyDeletedVisible?: (isVisible: boolean) => void;
};

export const RecordingListPreview = ({
  onDelete,
  onHardDelete,
  recentlyDeletedVisible,
  selected,
  setRecentlyDeletedVisible,
}: RecordingListPreviewProps) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-error-fg">
      <Controls
        className="absolute top-2"
        onDelete={onDelete}
        onHardDelete={onHardDelete}
        recentlyDeletedVisible={recentlyDeletedVisible}
        selected={selected}
        setRecentlyDeletedVisible={setRecentlyDeletedVisible}
      />

      <NonPreviewPlayerState visible={selected.length > 1}>
        <ContentRotate
          contentKey={selected.length.toString()}
          className={cn(
            "font-bold text-6xl text-shadow-lg px-1",
            recentlyDeletedVisible
              ? "text-error text-shadow-error/10"
              : "text-info text-shadow-info/10"
          )}
        >
          {selected.length}
        </ContentRotate>
        <span>Recordings Selected</span>
      </NonPreviewPlayerState>

      <NonPreviewPlayerState visible={selected.length === 0}>
        <Telescope size={70} />
        <span>No Recording Selected</span>
      </NonPreviewPlayerState>

      <AnimatePresence mode="popLayout">
        {selected.length === 1 && (
          <motion.div
            {...scaleAndFade}
            className="w-full flex flex-col items-center gap-2"
          >
            <div className="w-[90%] aspect-video flex justify-center items-center bg-neutral/50 rounded-md inset-shadow-full text-muted">
              <Hammer size={80} />
            </div>

            <RecordingName
              className="w-40"
              name={selected[0].name}
              recordingId={selected[0].id}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
