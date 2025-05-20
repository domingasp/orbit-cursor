import { invoke } from "@tauri-apps/api/core";
import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app";
import { Commands } from "./types/api";

import "./index.css";

void invoke(Commands.InitStandaloneListBox);

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
