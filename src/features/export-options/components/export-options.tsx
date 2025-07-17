import { zodResolver } from "@hookform/resolvers/zod";
import { documentDir, join, sep } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { FolderSearch, Info, Upload } from "lucide-react";
import { useEffect } from "react";
import { Heading } from "react-aria-components";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { useShallow } from "zustand/react/shallow";

import Button from "../../../components/button/button";
import Checkbox from "../../../components/checkbox/checkbox";
import OverflowShadow from "../../../components/overflow-shadow/overflow-shadow";
import { useExportPreferencesStore } from "../../../stores/editor/export-preferences.store";
import { pathExists } from "../api/export";

import MakeDefaultButton from "./make-default-button";

const exportInputSchema = z.object({
  filePath: z.string(),
  openFolderAfterExport: z.boolean(),
  separateAudioTracks: z.boolean(),
  separateCameraTrack: z.boolean(),
});

type ExportInputSchema = z.infer<typeof exportInputSchema>;

type ExportOptionsProps = {
  fileName: string;
  onCancel?: () => void;
};
const ExportOptions = ({ fileName, onCancel }: ExportOptionsProps) => {
  const state = useExportPreferencesStore(useShallow((state) => state));

  console.log(state);

  const { control, getValues, handleSubmit, setValue, watch } =
    useForm<ExportInputSchema>({
      defaultValues: {
        filePath: state.defaultExportPath ?? "",
        openFolderAfterExport: state.openFolderAfterExport,
        separateAudioTracks: state.separateAudioTracks,
        separateCameraTrack: state.separateCameraTrack,
      },
      resolver: zodResolver(exportInputSchema),
    });

  const filePath = watch("filePath", "");

  const openFolderPicker = () => {
    void save({
      defaultPath: filePath,
      filters: [{ extensions: ["mp4"], name: "Video" }],
    }).then((path) => {
      setValue("filePath", path ?? filePath);
    });
  };

  const onSubmit: SubmitHandler<ExportInputSchema> = (data) => {
    console.log(data);
  };

  const onMakeDefault = () => {
    state.setDefaultExportPath(
      getValues("filePath").split(sep()).slice(0, -1).join(sep())
    );
    state.setSeparateAudioTracks(getValues("separateAudioTracks"));
    state.setSeparateCameraTrack(getValues("separateCameraTrack"));
    state.setOpenFolderAfterExport(getValues("openFolderAfterExport"));
  };

  useEffect(() => {
    void documentDir().then(async (path) => {
      let basePath = path;

      if (
        state.defaultExportPath &&
        (await pathExists(state.defaultExportPath))
      ) {
        basePath = state.defaultExportPath;
      }

      setValue("filePath", await join(basePath, fileName + ".mp4"));
    });
  }, []);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
    >
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
                <span className="text-xs">Separate audio tracks</span>
              </Checkbox>
            )}
          />

          <Controller
            control={control}
            name="separateCameraTrack"
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
                <span className="text-xs">Separate camera track</span>
              </Checkbox>
            )}
          />

          <span className="col-span-2 text-xxs text-muted flex flex-row items-center gap-1">
            <Info size={12} />
            Separate tracks in a single file - ideal for editing, not for
            sharing.
          </span>
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
