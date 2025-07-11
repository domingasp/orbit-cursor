import { create } from "zustand";
import { devtools } from "zustand/middleware";

type PlaybackState = {
  currentTime: number;
  pause: () => void;
  play: () => void;
  playing: boolean;
  seek: (time: number) => void;
  seekEventId: number; // Used to allow listening for seek events
  setCurrentTime: (currentTime: number) => void;
  setShortestDuration: (shortestDuration: number | null) => void;
  shortestDuration: number | null;
  togglePlay: () => void;
};

export const usePlaybackStore = create<PlaybackState>()(
  devtools((set, get) => ({
    currentTime: 0,
    pause: () => {
      set({ playing: false });
    },
    play: () => {
      const { currentTime, shortestDuration } = get();

      if (shortestDuration !== null && currentTime >= shortestDuration - 0.01) {
        set({ currentTime: 0 });
      }

      set({ playing: true });
    },
    playing: false,
    seek: (time) => {
      set({ currentTime: time, seekEventId: get().seekEventId + 1 });
    },
    seekEventId: 0,
    setCurrentTime: (currentTime) => {
      set({ currentTime });
    },
    setShortestDuration: (shortestDuration) => {
      set({ shortestDuration });
    },
    shortestDuration: null,
    togglePlay: () => {
      const { pause, play, playing } = get();
      if (playing) pause();
      else play();
    },
  }))
);
