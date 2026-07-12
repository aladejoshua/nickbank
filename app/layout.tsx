import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "../components/ConvexClientProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Did Nick Answer My Question?",
  description:
    "A RAG chatbot that answers questions based on Nick's daily update transcripts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-hidden antialiased dark`}
    >
      <body className="h-full overflow-hidden flex flex-col bg-black text-[--text-primary]">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
