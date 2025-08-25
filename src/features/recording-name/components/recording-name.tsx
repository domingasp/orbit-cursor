import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { RecordingDetails } from "../../../api/recording-management";
import { TextField } from "../../../components/base/input-fields/text-field";
import { updateRecordingName } from "../api/recording-name";

// Regex provided for validating recording names. Built via constructor to avoid linter complaining about control chars.
const recordingNameRegex = new RegExp(
  String.raw`^(?!\s)(?!^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$)[^<>:"/\\|?*\u0000-\u001F]{1,255}(?<!\s)$`,
  "i"
);

const nameSchema = z.string().regex(recordingNameRegex, "Invalid file name");

type RecordingNameProps = {
  name: string;
  recordingId: number;
};

export const RecordingName = ({ name, recordingId }: RecordingNameProps) => {
  const queryClient = useQueryClient();

  const [value, setValue] = useState(name);
  const [isInvalid, setIsInvalid] = useState(false);
  const validateTimer = useRef<number | null>(null);

  const validate = useCallback((val: string) => {
    const result = nameSchema.safeParse(val);
    setIsInvalid(!result.success);
    return result.success;
  }, []);

  const { mutate } = useMutation({
    mutationFn: ({ id, newName }: { id: number; newName: string }) =>
      updateRecordingName(id, newName),
    onError: (_err, { id }, ctx: { prev?: RecordingDetails } | undefined) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["recordingDetails", id], ctx.prev);
      }
    },
    onMutate: ({ id, newName }: { id: number; newName: string }) => {
      const key = ["recordingDetails", id];
      const prev = queryClient.getQueryData<RecordingDetails>(key);
      if (prev) {
        queryClient.setQueryData<RecordingDetails>(key, {
          ...prev,
          name: newName,
        });
      }
      return { prev };
    },
    onSuccess: (_data, { id, newName }) => {
      const key = ["recordingDetails", id];
      queryClient.setQueryData<RecordingDetails | undefined>(key, (old) =>
        old ? { ...old, name: newName } : old
      );
    },
  });

  const scheduleValidation = (next: string) => {
    if (validateTimer.current) {
      window.clearTimeout(validateTimer.current);
    }

    // Clear invalid state on next change, avoids potential error flicker while user types
    if (isInvalid) setIsInvalid(false);

    validateTimer.current = window.setTimeout(() => {
      validate(next);
    }, 300);
  };

  const onChange = (next: string) => {
    setValue(next);
    scheduleValidation(next);
  };

  const handleBlur = () => {
    if (validateTimer.current) {
      window.clearTimeout(validateTimer.current);
      validateTimer.current = null;
    }

    const trimmed = value.trim();
    const valid = validate(trimmed);

    if (!valid) {
      // Revert to original name when invalid
      setValue(name);
      setIsInvalid(false);
      return;
    }

    if (trimmed !== name) {
      mutate({ id: recordingId, newName: trimmed });
    }
  };

  useEffect(() => {
    return () => {
      if (validateTimer.current) window.clearTimeout(validateTimer.current);
    };
  }, []);

  useEffect(() => {
    setValue(name);
  }, [name]);

  return (
    <TextField
      aria-label="Recording name"
      isInvalid={isInvalid}
      onBlur={handleBlur}
      onChange={onChange}
      size="sm"
      value={value}
      variant="line"
      centered
      compact
    />
  );
};
