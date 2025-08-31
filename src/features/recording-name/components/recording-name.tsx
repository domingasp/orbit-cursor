import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { TextField } from "../../../components/base/input-fields/text-field";
import { useUpdateRecordingName } from "../hooks/use-update-recording-name";

const recordingNameRegex = new RegExp(
  String.raw`^(?!\s)(?!^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$)[^<>:"/\\|?*\u0000-\u001F]{1,255}(?<!\s)$`,
  "i"
);

const nameSchema = z.string().regex(recordingNameRegex, "Invalid file name");

type RecordingNameProps = {
  name: string;
  recordingId: number;
  className?: string;
};

export const RecordingName = ({
  className,
  name,
  recordingId,
}: RecordingNameProps) => {
  const [value, setValue] = useState(name);
  const [isInvalid, setIsInvalid] = useState(false);
  const validateTimer = useRef<number | null>(null);

  const validate = useCallback((val: string) => {
    const result = nameSchema.safeParse(val);
    setIsInvalid(!result.success);
    return result.success;
  }, []);

  const { mutate: updateNameMutate } = useUpdateRecordingName();

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
      updateNameMutate({ id: recordingId, newName: trimmed });
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
      className={className}
      isInvalid={isInvalid}
      lineClassName="-bottom-0.5 shadow-content-fg/50"
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
