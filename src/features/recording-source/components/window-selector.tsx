import { useEffect } from "react";

import { listWindows } from "../api/recording-sources";

const WindowSelector = () => {
  useEffect(() => {
    void listWindows().then((windows) => {
      console.log(windows);
    });
  }, []);

  return <div>WINDOW SELECT</div>;
};

export default WindowSelector;
