import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Chrome from "@/components/Chrome";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GlobeGL Assistant",
  description: "Prototype: Globe transforms into a speaking assistant orb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-black min-h-dvh`}
        style={{ background: "linear-gradient(180deg, #ffffff 0%, #f6fbff 100%)" }}
      >
        <Chrome>{children}</Chrome>
      </body>
    </html>
  );
}
