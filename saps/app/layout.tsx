import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAPS — Student Academic Planning System",
  description:
    "Plan your 4-year course path. Track your GPA. Graduate on track.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
