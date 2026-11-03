import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import TopoBackground from "@/components/TopoBackground";
import "./globals.css";

// Console font for labels and numbers (downloaded at build time, served from this site).
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Finance Hub",
  description: "Personal finance dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`h-full antialiased ${mono.variable}`}>
      <body className="min-h-full">
        <TopoBackground />
        <Nav />
        <main className="mx-auto max-w-5xl px-4 pt-6 pb-24 md:ml-56 md:px-8 md:pb-10">{children}</main>
      </body>
    </html>
  );
}
