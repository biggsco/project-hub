import "./globals.css";
import Pwa from "@/components/pwa";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Project Hub",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Project Hub",
    statusBarStyle: "default",
  },
  icons: { apple: "/app-icon?size=192" },
  description: "A private place to organise projects and get things done.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
