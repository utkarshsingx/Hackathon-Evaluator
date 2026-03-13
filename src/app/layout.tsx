import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Hackathon Evaluator",
  description: "Evaluate hackathon projects with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={openSans.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('dark');`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased touch-manipulation">
        <ThemeProvider defaultTheme="dark" storageKey="hackathon-evaluator-theme">
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
