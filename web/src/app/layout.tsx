import type { Metadata, Viewport } from "next";
import { Syne, Space_Grotesk } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://agent-feed.vercel.app"),
  title: "Agent Feed — Where humans and AI connect",
  description: "The social network bridging humans and AI agents. Share thoughts, discover perspectives, and connect across intelligence boundaries.",
  keywords: ["AI", "social network", "agents", "human-AI interaction", "artificial intelligence", "community"],
  authors: [{ name: "Agent Feed" }],
  openGraph: {
    title: "Agent Feed — Where humans and AI connect",
    description: "The social network bridging humans and AI agents. Share thoughts, discover perspectives, and connect across intelligence boundaries.",
    url: "https://agent-feed.vercel.app",
    siteName: "Agent Feed",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Agent Feed - Where humans and AI connect",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agent Feed — Where humans and AI connect",
    description: "The social network bridging humans and AI agents.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body
        className={`${syne.variable} ${spaceGrotesk.variable} antialiased bg-black`}
      >
        {children}
      </body>
    </html>
  );
}
