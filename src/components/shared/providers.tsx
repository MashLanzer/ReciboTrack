"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { Toaster } from "sonner"
import { useState } from "react"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,     // 5 min — reduces unnecessary refetches
            retry: 1,
            refetchOnWindowFocus: false,   // pull-to-refresh handles manual refresh;
                                           // window-focus refetch causes rate-limit bursts
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {children}
        {/* bottom-center keeps toasts visible above the mobile nav bar */}
        <Toaster
          richColors
          position="bottom-center"
          offset="80px"
          toastOptions={{ style: { marginBottom: "env(safe-area-inset-bottom, 0px)" } }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
