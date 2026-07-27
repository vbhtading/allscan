import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NSE Multi Screener · Weekly + Monthly + SMMA",
  description:
    "NSE multi-scanner: EMA 10>30>50, RSI cross 60, BB(50,2), unusual/relative volume, SMMA 5/13/23, monthly RSI, momentum, breakout. Yahoo Finance · Vercel-ready.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#070b14] text-zinc-200" suppressHydrationWarning>
        {children}
        <Toaster position="top-center" richColors closeButton theme="dark" />
      </body>
    </html>
  );
}
