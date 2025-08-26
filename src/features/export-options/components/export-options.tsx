import { zodResolver } from "@hookform/resolvers/zod";
import { sep } from "@tauri-apps/api/path";
import { Upload } from "lucide-react";
import { useState } from "react";
import { Heading } from "react-aria-components";
import { SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { useShallow } from "zustand/react/shallow";

import { Button } from "../../../components/base/button/button";
import { CheckboxControlled } from "../../../components/base/checkbox/checkbox-controlled";
import { CheckOnClickButton } from "../../../components/shared/check-on-click-button/check-on-click-button";
import { useExportPreferencesStore } from "../../../stores/editor/export-preferences.store";
import { cancelExport, exportRecording } from "../api/export";

import { ExportProgressOverlay } from "./export-progress-overlay";
import { OutputPath } from "./output-path";

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

export const ExportOptions = ({
  defaultFilename,
  hasCamera,
  onCancel,
  recordingDirectory,
}: ExportOptionsProps) => {
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

  const [exporting, setExporting] = useState(false);

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

  return (
    <form
      className="flex flex-col gap-3 relative"
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
    >
      <ExportProgressOverlay
        isOpen={exporting}
        requiresCameraState={hasCamera && separateCameraFile}
        onCancel={() => {
          setExporting(false);
          cancelExport();
        }}
        onComplete={() => {
          onCancel?.(); // Close modal
        }}
      />

      <Heading className="text-lg font-thin" slot="title">
        Export
      </Heading>

      <div className="flex flex-col gap-4">
        <OutputPath
          defaultFilename={defaultFilename}
          filePath={filePath}
          hasCamera={hasCamera}
          separateCameraFile={separateCameraFile}
          onUpdate={(path) => {
            setValue("filePath", path);
          }}
        />

        <div className="grid grid-cols-2 gap-2 px-2">
          <div>
            <CheckboxControlled
              control={control}
              name="separateAudioTracks"
              size="sm"
            >
              <div>
                <span className="text-xs">Separate audio tracks</span>
                <span className="col-span-2 text-xxs text-muted flex flex-row items-center gap-1">
                  Bundled in main file as multiple tracks.
                </span>
              </div>
            </CheckboxControlled>
          </div>

          <CheckboxControlled
            control={control}
            isDisabled={!hasCamera}
            name="separateCameraFile"
            size="sm"
          >
            <span className="text-xs">Separate file for camera</span>
          </CheckboxControlled>
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
            <CheckOnClickButton
              className="font-light"
              onPress={onMakeDefault}
              size="sm"
              type="button"
              variant="ghost"
            >
              Make default
            </CheckOnClickButton>

            <Button color="info" size="sm" type="submit">
              Export
              <Upload size={16} />
            </Button>
          </div>

          <CheckboxControlled
            control={control}
            name="openFolderAfterExport"
            size="sm"
          >
            <span className="text-xs text-muted">Open folder after export</span>
          </CheckboxControlled>
        </div>
      </div>
    </form>
  );
};
