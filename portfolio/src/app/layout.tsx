import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SiteModeWrapper from "@/components/SiteModeWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Your Name - Portfolio",
  description: "Software Engineer Portfolio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SiteModeWrapper>{children}</SiteModeWrapper>
      </body>
    </html>
  );
}