import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import OfflineAutoSync from "@/components/OfflineAutoSync";
import Toaster from "@/components/Toaster";
import LaunchSplash from "@/components/LaunchSplash";
import AppFeel from "@/components/AppFeel";

export const metadata: Metadata = {
  title: "Saranya Prep",
  description: "தொகுதி 1, 2, 4 தேர்வுகளுக்கான தமிழ்வழிப் பயிற்சி",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "Saranya Prep", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#7a1414", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ta">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Mukta+Malar:wght@400;500;600;700&family=Noto+Sans+Tamil:wght@400;600;700&family=Noto+Serif+Tamil:wght@400;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <LaunchSplash />
        <Nav />
        <OfflineAutoSync />
        <Toaster />
        <AppFeel />
        <main className="mx-auto max-w-3xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 md:pb-10">{children}</main>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__bip=e;});if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`,
          }}
        />
      </body>
    </html>
  );
}
