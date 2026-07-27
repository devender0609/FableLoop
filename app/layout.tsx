import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpineDx-Tx AI",
  description: "Physician-controlled spine diagnostic concordance and treatment decision support prototype",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
