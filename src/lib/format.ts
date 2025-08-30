export const oneGB = 1024 ** 3;

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";

  const units = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  return `${size.toFixed(1)} ${units[i]}`;
};

export const formatMilliseconds = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

export const formatDate = (dateInput: Date | string): string => {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year.toString()}`;
};

export const retentionTag = (
  deletedAt: Date,
  retentionDays: number
): { formatted: string; unit: "days" | "hours" | "minutes"; value: number } => {
  const expiry = new Date(
    deletedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000
  );
  const diffMs = expiry.getTime() - Date.now();

  if (diffMs <= 0) return { formatted: "0 minutes", unit: "minutes", value: 0 }; // already expired

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) {
    return { formatted: `${days.toString()} days`, unit: "days", value: days };
  }

  if (hours >= 1) {
    return {
      formatted: `${hours.toString()} hours`,
      unit: "hours",
      value: hours,
    };
  }

  return {
    formatted: `${minutes.toString()} minutes`,
    unit: "minutes",
    value: minutes,
  };
};

export const pluralize = (
  word: string,
  count: number,
  pluralForm = word + "s"
) => {
  return count === 1 ? word : pluralForm;
};
