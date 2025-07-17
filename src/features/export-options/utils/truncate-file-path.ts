import { sep } from "@tauri-apps/api/path";

/**
 * Truncate a file path to fit within `maxLength` characters.
 *
 * Attempts to keep the root, last folder, and filename.
 *
 * Truncation types depending on `maxLength`:
 *
 * | In                                                     | Out                         | `maxLength` |
 * |--------------------------------------------------------|-----------------------------|-------------|
 * | `C:\Users\John\file.mp4`                               | `C:\...\John\file.mp4`      | 20          |
 * | `C:\Documents\Work\Reports\file.mp4`                   | `...\Reports\file.mp4`      | 22          |
 * | `C:\Documents\Work\Reports\verylongfilenameindeed.mp4` | `...\Reports\...indeed.mp4` | 30          |
 * | `verylongfilenameindeed.mp4`                           | `very...deed.mp4`           | 20          |
 *
 * @param path Full path to truncate.
 * @param delimiter Path separator, defaults to system separator.
 * @param maxLength Max string length in output.
 * @returns Truncated file path.
 */
const truncateFilePath = (
  path: string,
  delimiter = sep(),
  maxLength = 45
): string => {
  if (!path || path.length <= maxLength) return path;

  const folderParts = path.split(delimiter);
  const filename = folderParts.pop() || "";

  const extensionIndex = filename.lastIndexOf(".");
  const hasExtension = extensionIndex !== -1;
  const name = hasExtension ? filename.slice(0, extensionIndex) : filename;
  const extension = hasExtension ? filename.slice(extensionIndex) : "";

  if (folderParts.length === 0) {
    const availableLength = maxLength - extension.length - 3; // 3 for "..."
    if (availableLength <= 0) return "..." + filename.slice(-maxLength + 3);

    const start = Math.ceil(availableLength / 2);
    const end = Math.floor(availableLength / 2);
    return `${name.slice(0, start)}...${name.slice(-end)}${extension}`;
  } else {
    const start = folderParts[0];
    const end = folderParts[folderParts.length - 1];

    const attempt1 = [start, "...", end, filename].join(delimiter);
    if (attempt1.length <= maxLength) return attempt1;

    const attempt2 = ["...", end, filename].join(delimiter);
    if (attempt2.length <= maxLength) return attempt2;

    const prefix = ["...", end].join(delimiter);
    const untruncatedAttempt = [prefix, filename].join(delimiter);
    if (untruncatedAttempt.length <= maxLength) return untruncatedAttempt;

    const remainingLength = maxLength - prefix.length - extension.length;
    const tail = name.slice(-remainingLength);
    const shortenedFilename = `...${tail}${extension}`;

    return [prefix, shortenedFilename].join(delimiter);
  }
};

export default truncateFilePath;
