import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/app-shell/theme-provider";
import { ToastProvider } from "@/components/design-system";
import "./globals.css";

export const metadata: Metadata = {
  title: "ECDLink | Operating System for Early Childhood Development Centres",
  description:
    "ECDLink is a premium SaaS platform for South African ECD centres, connecting procurement, compliance, funding readiness, suppliers, donors and impact reporting."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <ThemeProvider>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
