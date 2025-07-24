import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { usePlaybackStore } from "../../../stores/editor/playback.store";

type PreviewPlayerProps = {
  screenPath: string;
  cameraPath?: string;
  microphonePath?: string;
  systemAudioPath?: string;
};

export const PreviewPlayer = ({
  cameraPath,
  microphonePath,
  screenPath,
  systemAudioPath,
}: PreviewPlayerProps) => {
  const [
    playing,
    currentTime,
    setCurrentTime,
    shortestDuration,
    pause,
    seekEventId,
    setShortestDuration,
  ] = usePlaybackStore(
    useShallow((state) => [
      state.playing,
      state.currentTime,
      state.setCurrentTime,
      state.shortestDuration,
      state.pause,
      state.seekEventId,
      state.setShortestDuration,
    ])
  );

  const screenRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const systemAudioRef = useRef<HTMLAudioElement>(null);
  const microphoneRef = useRef<HTMLAudioElement>(null);
  const refs: React.RefObject<HTMLMediaElement | null>[] = [
    screenRef,
    cameraRef,
    systemAudioRef,
    microphoneRef,
  ];

  const animationFrameId = useRef<number | null>(null);

  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [isVertical, setIsVertical] = useState(false);

  const computeShortestDuration = () => {
    const durations = refs
      .map((ref) => ref.current?.duration)
      .filter((d) => typeof d === "number" && !isNaN(d)) as number[];

    return durations.length > 0 ? Math.min(...durations) : null;
  };

  const updateAllMediaTime = (time: number) => {
    refs.forEach((ref) => {
      if (ref.current) ref.current.currentTime = time;
    });
  };

  const startTimer = () => {
    // Pre-emptive stop, prevents media overshooting and pinging back
    const EPSILON = 0.02;

    const loop = () => {
      if (screenRef.current) {
        const current = screenRef.current.currentTime;
        setCurrentTime(current);

        if (
          shortestDuration !== null &&
          current >= shortestDuration - EPSILON
        ) {
          stopTimer();
          pause();
          // Ensures deterministic behaviour, consistent stop point
          setCurrentTime(shortestDuration);
          updateAllMediaTime(shortestDuration);
          return;
        }
      }

      animationFrameId.current = requestAnimationFrame(loop);
    };

    animationFrameId.current = requestAnimationFrame(loop);
  };

  const stopTimer = () => {
    if (animationFrameId.current !== null) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
  };

  useEffect(() => {
    refs.forEach((ref) => {
      if (ref.current) ref.current.currentTime = currentTime;
    });

    if (playing) {
      refs.forEach((ref) => {
        void ref.current?.play();
      });
      startTimer();
    } else {
      refs.forEach((ref) => {
        ref.current?.pause();
      });
      stopTimer();
    }

    return () => {
      stopTimer();
    };
  }, [playing]);

  useEffect(() => {
    refs.forEach((ref) => {
      if (ref.current) ref.current.currentTime = currentTime;
    });
  }, [seekEventId]);

  useEffect(() => {
    const calculations = () => {
      if (screenRef.current) {
        const { videoHeight: h, videoWidth: w } = screenRef.current;
        setIsVertical(h > w);
        setAspectRatio(w / h);
      }
    };
    screenRef.current?.addEventListener("loadedmetadata", calculations);

    return () => {
      screenRef.current?.removeEventListener("loadedmetadata", calculations);
    };
  }, [setIsVertical, setAspectRatio]);

  useEffect(() => {
    const handleLoaded = () => {
      const min = computeShortestDuration();
      setShortestDuration(min);
    };

    const elements = [
      screenRef.current,
      cameraRef.current,
      systemAudioRef.current,
      microphoneRef.current,
    ].filter(Boolean) as HTMLMediaElement[];

    elements.forEach((el) => {
      el.addEventListener("loadedmetadata", handleLoaded);
    });

    return () => {
      elements.forEach((el) => {
        el.removeEventListener("loadedmetadata", handleLoaded);
      });
    };
  }, [screenPath, cameraPath, microphonePath, systemAudioPath]);

  return (
    <div className="flex flex-col gap-1 bg-neutral-900 items-center p-2 max-h-[600px] h-[70vh]">
      <div className="relative h-full flex justify-center items-center overflow-hidden">
        <div
          className="relative max-h-full w-auto"
          style={aspectRatio ? { aspectRatio } : {}}
        >
          <video
            ref={screenRef}
            className="h-full w-full"
            preload="auto"
            src={convertFileSrc(screenPath)}
            onContextMenu={(e) => {
              e.preventDefault();
            }}
          />

          {cameraPath && (
            <video
              ref={cameraRef}
              className="absolute top-0 left-0"
              preload="auto"
              src={convertFileSrc(cameraPath)}
              onContextMenu={(e) => {
                e.preventDefault();
              }}
              style={{
                maxHeight: !isVertical ? "30%" : undefined,
                maxWidth: isVertical ? "30%" : undefined,
              }}
            />
          )}
        </div>
      </div>

      {systemAudioPath && (
        <audio ref={systemAudioRef} src={convertFileSrc(systemAudioPath)} />
      )}

      {microphonePath && (
        <audio ref={microphoneRef} src={convertFileSrc(microphonePath)} />
      )}
    </div>
  );
};
