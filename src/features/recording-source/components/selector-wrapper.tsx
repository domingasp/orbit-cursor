type SelectorWrapperProps = {
  children?: React.ReactNode;
};
const SelectorWrapper = ({ children }: SelectorWrapperProps) => {
  return (
    <div className="flex justify-center items-center w-full h-full inset-shadow-full rounded-md relative overflow-hidden">
      {children}
    </div>
  );
};

export default SelectorWrapper;
