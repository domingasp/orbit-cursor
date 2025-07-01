import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";

import Controls from "./controls";

type PreviewPlayerProps = {
  currentTime: number;
  screenPath: string;
  setCurrentTime: (value: number) => void;
  cameraPath?: string;
  microphonePath?: string;
  systemAudioPath?: string;
};
const PreviewPlayer = ({
  cameraPath,
  currentTime,
  microphonePath,
  screenPath,
  setCurrentTime,
  systemAudioPath,
}: PreviewPlayerProps) => {
  const screenRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const systemAudioRef = useRef<HTMLAudioElement>(null);
  const microphoneRef = useRef<HTMLAudioElement>(null);

  const animationFrameId = useRef<number | null>(null);

  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [isVertical, setIsVertical] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [minDuration, setMinDuration] = useState<number | null>(null);

  const computeMinDuration = () => {
    const durations = [
      screenRef.current?.duration,
      cameraRef.current?.duration,
      systemAudioRef.current?.duration,
      microphoneRef.current?.duration,
    ].filter((d) => typeof d === "number" && !isNaN(d)) as number[];

    if (durations.length > 0) {
      return Math.min(...durations);
    }
    return null;
  };

  const updateAllMediaTime = (time: number) => {
    if (screenRef.current) screenRef.current.currentTime = time;
    if (cameraRef.current) cameraRef.current.currentTime = time;
    if (systemAudioRef.current) systemAudioRef.current.currentTime = time;
    if (microphoneRef.current) microphoneRef.current.currentTime = time;
  };

  const stopTimer = () => {
    if (animationFrameId.current !== null) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
  };

  const startTimer = () => {
    // Pre-emptive stop, prevents media overshooting and pinging back
    const EPSILON = 0.02;
    const loop = () => {
      if (screenRef.current) {
        const current = screenRef.current.currentTime;
        setCurrentTime(current);

        if (minDuration !== null && current >= minDuration - EPSILON) {
          pause();
          setHasFinished(true);
          // Ensures deterministic behaviour, consistent stop point
          setCurrentTime(minDuration);
          updateAllMediaTime(minDuration);
          return;
        }
      }

      animationFrameId.current = requestAnimationFrame(loop);
    };

    animationFrameId.current = requestAnimationFrame(loop);
  };

  const backToStart = () => {
    updateAllMediaTime(0);
    setCurrentTime(0);
    setHasFinished(false);
  };

  const play = () => {
    if (hasFinished) backToStart();

    void screenRef.current?.play();
    void cameraRef.current?.play();
    void systemAudioRef.current?.play();
    void microphoneRef.current?.play();

    startTimer();
    setIsPlaying(true);
  };
  const pause = () => {
    screenRef.current?.pause();
    cameraRef.current?.pause();
    systemAudioRef.current?.pause();
    microphoneRef.current?.pause();

    stopTimer();
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (!isPlaying) play();
    else pause();
  };

  useEffect(() => {
    const calculations = () => {
      if (screenRef.current) {
        setIsVertical(
          screenRef.current.videoHeight > screenRef.current.videoWidth
        );

        setAspectRatio(
          screenRef.current.videoWidth / screenRef.current.videoHeight
        );
      }
    };
    screenRef.current?.addEventListener("loadedmetadata", calculations);

    return () => {
      screenRef.current?.removeEventListener("loadedmetadata", calculations);
    };
  }, []);

  useEffect(() => {
    pause();
    backToStart();
  }, [screenPath]);

  useEffect(() => {
    const handleLoaded = () => {
      const min = computeMinDuration();
      setMinDuration(min);
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
            onEnded={() => {
              setIsPlaying(false);
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

      <div className="shrink-0">
        <Controls
          currentTime={currentTime}
          isPlaying={isPlaying}
          onBackToStart={backToStart}
          onTogglePlay={togglePlay}
        />
      </div>
    </div>
  );
};

export default PreviewPlayer;
