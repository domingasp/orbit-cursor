const Editor = () => {
  // top level background color
  document.documentElement.classList.add("bg-content");

  return (
    <div className="text-content-fg bg-transparent">
      <div
        className="flex flex-row justify-center p-1 font-semibold"
        data-tauri-drag-region
      >
        [RECORDING NAME]
      </div>

      <div>Editor goes here...</div>
    </div>
  );
};

export default Editor;
