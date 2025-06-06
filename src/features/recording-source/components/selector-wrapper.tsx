import { cn } from "../../../lib/styling";

type SelectorWrapperProps = {
  children?: React.ReactNode;
  className?: string;
};
const SelectorWrapper = ({ children, className }: SelectorWrapperProps) => {
  return (
    <div
      className={cn(
        "flex justify-center items-center w-full h-full inset-shadow-full rounded-md relative overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
};

export default SelectorWrapper;
