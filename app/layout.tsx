import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Project Hub",
  description: "A private place to organise projects and get things done.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
