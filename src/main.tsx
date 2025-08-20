import React from "react";
import { createRoot } from "react-dom/client";

import {
  initRecordingInputOptions,
  initRegionSelector,
  initRecordingSourceSelector,
  initStandaloneListBox,
} from "./api/windows";
import { App } from "./app";
import "overlayscrollbars/styles/overlayscrollbars.css";
import "./index.css";

// Ensures backend is ready
initStandaloneListBox();
initRecordingInputOptions();
initRegionSelector();
initRecordingSourceSelector();

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
