// Format seconds (can be fractional) into subparts
export const formatTime = (seconds: number) => {
  const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const secs = String(Math.floor(seconds % 60)).padStart(2, "0");

  const totalSeconds = Math.floor(seconds);
  const ms = String(
    Math.round(Math.floor((seconds - totalSeconds) * 100))
  ).padStart(2, "0");

  return { hrs, mins, ms, secs };
};
