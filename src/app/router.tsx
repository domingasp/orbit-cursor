import { createBrowserRouter, RouterProvider } from "react-router";

import { Editor } from "./pages/editor";
import { StandaloneListBox } from "./pages/listbox-standalone";
import { RecordingDock } from "./pages/recording-dock";
import { RecordingInputOptions } from "./pages/recording-input-options";
import { RecordingSourceSelector } from "./pages/recording-source-selector";
import { Region } from "./pages/region";
import { RequestPermissions } from "./pages/request-permissions/request-permissions";
import { StartRecordingDock } from "./pages/start-recording-dock";

const router = createBrowserRouter([
  {
    element: <RequestPermissions />,
    path: "/request-permissions",
  },
  {
    element: <StartRecordingDock />,
    path: "/start-recording-dock",
  },
  {
    element: <StandaloneListBox />,
    path: "/standalone-listbox",
  },
  {
    element: <RecordingInputOptions />,
    path: "/recording-input-options",
  },
  {
    element: <Region />,
    path: "/region-selector",
  },
  {
    element: <RecordingSourceSelector />,
    path: "/recording-source-selector",
  },
  {
    element: <RecordingDock />,
    path: "/recording-dock",
  },
  {
    element: <Editor />,
    path: "/editor",
  },
]);

export const AppRouter = () => <RouterProvider router={router} />;
