import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenSTAAD Design Reporter",
  description: "Structural design suite with OpenSTAAD bridge integration",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
