import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FableLoop Cinema — Idea to AI Movie",
  description: "Turn one idea into a cinematic, acted short movie with dialogue, sound and downloadable MP4 output.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
