import { zodResolver } from "@hookform/resolvers/zod";
import { listen } from "@tauri-apps/api/event";
import { documentDir, join, sep } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { Camera, FolderSearch, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Heading } from "react-aria-components";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { useShallow } from "zustand/react/shallow";

import Button from "../../../components/button/button";
import Checkbox from "../../../components/checkbox/checkbox";
import CircularProgressBar from "../../../components/circular-progress-bar/circular-progress-bar";
import OverflowShadow from "../../../components/overflow-shadow/overflow-shadow";
import Overlay from "../../../components/overlay/overlay";
import { useExportPreferencesStore } from "../../../stores/editor/export-preferences.store";
import { usePlaybackStore } from "../../../stores/editor/playback.store";
import { Events } from "../../../types/events";
import { exportRecording, pathExists } from "../api/export";
import { getFilenameAndDirFromPath } from "../utils/file";

import MakeDefaultButton from "./make-default-button";

const FILE_EXTENSION = "mp4";

const exportInputSchema = z.object({
  filePath: z.string(),
  openFolderAfterExport: z.boolean(),
  separateAudioTracks: z.boolean(),
  separateCameraFile: z.boolean(),
});

export type ExportInputSchema = z.infer<typeof exportInputSchema>;

type ExportOptionsProps = {
  defaultFilename: string;
  hasCamera: boolean;
  recordingDirectory: string;
  onCancel?: () => void;
};
const ExportOptions = ({
  defaultFilename,
  hasCamera,
  onCancel,
  recordingDirectory,
}: ExportOptionsProps) => {
  const duration = usePlaybackStore(
    useShallow((state) => state.shortestDuration)
  );
  const state = useExportPreferencesStore(useShallow((state) => state));

  const { control, getValues, handleSubmit, setValue, watch } =
    useForm<ExportInputSchema>({
      defaultValues: {
        filePath: "",
        openFolderAfterExport: state.openFolderAfterExport,
        separateAudioTracks: state.separateAudioTracks,
        separateCameraFile: state.separateCameraFile,
      },
      resolver: zodResolver(exportInputSchema),
    });

  // Enables support of camera toggle
  const [existingBaseDir, setExistingBaseDir] = useState<string | null>(
    state.defaultExportDirectory
  );

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const filePath = watch("filePath", "");
  const separateCameraFile = watch("separateCameraFile");

  const onSubmit: SubmitHandler<ExportInputSchema> = ({
    filePath,
    openFolderAfterExport,
    separateAudioTracks,
    separateCameraFile,
  }) => {
    setExporting(true);
    exportRecording({
      destinationFilePath: filePath,
      openFolderAfterExport,
      separateAudioTracks,
      separateCameraFile: hasCamera && separateCameraFile,
      sourceFolderPath: recordingDirectory,
    });
  };

  const onMakeDefault = () => {
    state.setDefaultExportDirectory(
      getValues("filePath").split(sep()).slice(0, -1).join(sep())
    );
    state.setSeparateAudioTracks(getValues("separateAudioTracks"));
    state.setSeparateCameraFile(getValues("separateCameraFile"));
    state.setOpenFolderAfterExport(getValues("openFolderAfterExport"));
  };

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
        state.defaultExportDirectory &&
        (await pathExists(state.defaultExportDirectory))
      ) {
        directory = state.defaultExportDirectory;
      } else {
        directory = await documentDir();
      }

      filename = defaultFilename;
    }

    const withExtension = `${filename}.${FILE_EXTENSION}`;

    setValue(
      "filePath",
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

    const unlistenProgress = listen(Events.ExportProgress, (data) => {
      const millisecondsProcessed = data.payload as number;
      if (duration) {
        setExportProgress((millisecondsProcessed / 1000 / duration) * 100);
      }
    });
    const unlistenExportComplete = listen(Events.ExportComplete, () => {
      setExporting(false);
      setExportProgress(0);
      onCancel?.();
    });

    return () => {
      void unlistenProgress.then((f) => {
        f();
      });
      void unlistenExportComplete.then((f) => {
        f();
      });
    };
  }, []);

  useEffect(() => {
    void updateExportPath();
  }, [separateCameraFile]);

  // TODO export banner of location
  // TODO warning message if path exists, telling user a unique path will be generated

  return (
    <form
      className="flex flex-col gap-3 relative"
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
    >
      <Overlay blur="lg" isOpen={exporting}>
        <div className="flex flex-col items-center justify-center gap-2">
          <CircularProgressBar
            aria-label="Export progress"
            value={exportProgress}
            indeterminate={
              exportProgress === 0 && hasCamera && separateCameraFile
            }
            renderLabel={
              exportProgress === 0 && hasCamera && separateCameraFile
                ? () => (
                    <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                      <Camera size={28} />
                    </div>
                  )
                : undefined
            }
          />
          <span className="text-muted font-thin">
            {exportProgress === 0 && hasCamera && separateCameraFile
              ? "Exporting camera..."
              : "Exporting recording..."}
          </span>
        </div>
      </Overlay>

      <Heading className="text-lg font-thin" slot="title">
        Export
      </Heading>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 justify-between max-w-full">
          <span className="w-full text-sm overflow-hidden relative border border-muted/20 rounded-md">
            <OverflowShadow
              className="px-2 py-1"
              orientation="horizontal"
              noScrollbar
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

        <div className="grid grid-cols-2 gap-2 px-2">
          <div>
            <Controller
              control={control}
              name="separateAudioTracks"
              render={({ field }) => (
                <Checkbox
                  {...field}
                  isSelected={field.value}
                  size="sm"
                  value={field.name}
                  onChange={(isSelected) => {
                    field.onChange(isSelected);
                  }}
                >
                  <div>
                    <span className="text-xs">Separate audio tracks</span>
                    <span className="col-span-2 text-xxs text-muted flex flex-row items-center gap-1">
                      Bundled in main file as multiple tracks.
                    </span>
                  </div>
                </Checkbox>
              )}
            />
          </div>

          <Controller
            control={control}
            name="separateCameraFile"
            render={({ field }) => (
              <Checkbox
                {...field}
                isDisabled={!hasCamera}
                isSelected={field.value}
                size="sm"
                value={field.name}
                onChange={(isSelected) => {
                  field.onChange(isSelected);
                }}
              >
                <span className="text-xs">Separate file for camera</span>
              </Checkbox>
            )}
          />
        </div>
      </div>

      <div className="flex flex-row gap-2 items-end justify-between mt-4">
        <Button
          className="font-light"
          onPress={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>

        <div className="flex flex-col gap-2 items-center">
          <div className="flex gap-2">
            <MakeDefaultButton
              className="font-light"
              onPress={onMakeDefault}
              size="sm"
              type="button"
              variant="ghost"
            >
              Make default
            </MakeDefaultButton>

            <Button color="info" size="sm" type="submit">
              Export
              <Upload size={16} />
            </Button>
          </div>

          <Controller
            control={control}
            name="openFolderAfterExport"
            render={({ field }) => (
              <Checkbox
                {...field}
                isSelected={field.value}
                size="xs"
                value={field.name}
                onChange={(isSelected) => {
                  field.onChange(isSelected);
                }}
              >
                <span className="text-xs text-muted">
                  Open folder after export
                </span>
              </Checkbox>
            )}
          />
        </div>
      </div>
    </form>
  );
};

export default ExportOptions;
