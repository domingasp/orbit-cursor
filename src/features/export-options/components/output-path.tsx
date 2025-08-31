import { documentDir, join } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { FolderSearch, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "../../../components/base/button/button";
import { OverflowShadow } from "../../../components/base/overflow-shadow/overflow-shadow";
import { useExportPreferencesStore } from "../../../stores/editor/export-preferences.store";
import { pathExists } from "../api/export";
import { getFilenameAndDirFromPath } from "../utils/file";

const FILE_EXTENSION = "mp4";

type OutputPathProps = {
  defaultFilename: string;
  filePath: string;
  hasCamera: boolean;
  onUpdate: (path: string) => void;
  separateCameraFile: boolean;
};

export const OutputPath = ({
  defaultFilename,
  filePath,
  hasCamera,
  onUpdate,
  separateCameraFile,
}: OutputPathProps) => {
  const defaultExportDirectory = useExportPreferencesStore(
    useShallow((state) => state.defaultExportDirectory)
  );

  const [showPathWarning, setShowPathWarning] = useState(false);

  // Enables support of camera toggle
  const [existingBaseDir, setExistingBaseDir] = useState<string | null>(
    defaultExportDirectory
  );

  const openFolderPicker = () => {
    void save({
      defaultPath: filePath,
      filters: [{ extensions: [FILE_EXTENSION], name: "Video" }],
    }).then(async (selectedPath) => {
      if (!selectedPath) return;
      const { dir } = await getFilenameAndDirFromPath(selectedPath);
      setExistingBaseDir(dir); // This is a real path

      await updateExportPath(selectedPath);
    });
  };

  const updateExportPath = async (selectedPath?: string) => {
    let directory: string;
    let filename: string;

    try {
      const { dir, file } = await getFilenameAndDirFromPath(
        selectedPath ?? filePath
      );

      if (selectedPath) directory = dir;
      // We use `existingBaseDir` instead of filePath as otherwise
      // it would cause filename to keep being appended on toggle
      else directory = existingBaseDir ?? dir;

      filename = selectedPath || filePath ? file : defaultFilename;
    } catch {
      if (
        defaultExportDirectory &&
        (await pathExists(defaultExportDirectory))
      ) {
        directory = defaultExportDirectory;
      } else {
        directory = await documentDir();
      }

      filename = defaultFilename;
    }

    const withExtension = `${filename}.${FILE_EXTENSION}`;

    onUpdate(
      await join(
        directory,
        ...(hasCamera && separateCameraFile
          ? // Additional subdirectory (to be created on export)
            [filename, withExtension]
          : [withExtension])
      )
    );
  };

  useEffect(() => {
    void updateExportPath();
  }, []);

  useEffect(() => {
    void updateExportPath();
  }, [separateCameraFile]);

  useEffect(() => {
    void pathExists(filePath).then((exists) => {
      setShowPathWarning(exists);
    });
  }, [filePath]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 justify-between max-w-full">
        <span className="w-full text-sm overflow-hidden relative border border-muted/20 rounded-md">
          <OverflowShadow
            className="px-2 py-1"
            orientation="horizontal"
            hideScrollbar
            startAtEnd
          >
            {filePath}
          </OverflowShadow>
        </span>

        <Button className="self-stretch" onPress={openFolderPicker} size="sm">
          Destination
          <FolderSearch size={16} />
        </Button>
      </div>

      {showPathWarning && (
        <span className="flex flex-row items-center text-muted text-xxs gap-1 pl-1">
          <TriangleAlert className="text-warning" size={12} />
          File with name already exists. A unique suffix will be automatically
          added.
        </span>
      )}
    </div>
  );
};
