import { RndResizeStartCallback } from "react-rnd";

type RndResizeStartCallbackParams = Parameters<RndResizeStartCallback>;

// react-rnd does not expose `ResizeDirection`...
export type ResizeDirection = RndResizeStartCallbackParams[1];
