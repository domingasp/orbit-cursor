import { createBrowserRouter, RouterProvider } from "react-router";

import StandaloneListBox from "./pages/listbox-standalone";
import RecordingInputOptions from "./pages/recording-input-options";
import RequestPermissions from "./pages/request-permissions/request-permissions";
import StartRecordingDock from "./pages/start-recording-dock";

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
]);

export const AppRouter = () => <RouterProvider router={router} />;
