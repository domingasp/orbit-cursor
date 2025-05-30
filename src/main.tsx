import React from "react";
import { createRoot } from "react-dom/client";

import {
  initRecordingInputOptions,
  InitRecordingSourceSelector,
  initStandaloneListBox,
} from "./api/windows";
import { App } from "./app";
import "./index.css";

initStandaloneListBox();
initRecordingInputOptions();
InitRecordingSourceSelector();

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
