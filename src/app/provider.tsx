import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ToastProvider } from "../components/base/toast/toast-provider";

const QUERY_CLIENT = new QueryClient();

type AppProviderProps = {
  children: React.ReactNode;
};

export const AppProvider = ({ children }: AppProviderProps) => {
  return (
    <QueryClientProvider client={QUERY_CLIENT}>
      <ToastProvider className="top-8">
        <main className="container min-w-dvw min-h-dvh">{children}</main>
      </ToastProvider>
    </QueryClientProvider>
  );
};
