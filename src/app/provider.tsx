import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const QUERY_CLIENT = new QueryClient();

type AppProviderProps = {
  children: React.ReactNode;
};

export const AppProvider = ({ children }: AppProviderProps) => {
  return (
    <QueryClientProvider client={QUERY_CLIENT}>
      <main className="container">{children}</main>
    </QueryClientProvider>
  );
};
