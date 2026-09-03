import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata: Metadata = { title: "BalkanGuess", description: "One Balkan song. Six tries." };
export const viewport: Viewport = { themeColor: "#030303", colorScheme: "dark" };
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
