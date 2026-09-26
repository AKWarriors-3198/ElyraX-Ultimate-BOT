import type { Metadata, Viewport } from "next";
import "./globals.css";
import { InitialExperience } from "@/components/initial-experience";

export const metadata: Metadata = {
  title: { default: "ELYRAX — Discord, in control", template: "%s · ELYRAX" },
  description: "A focused control center for configuring and monitoring ELYRAX across your Discord servers.",
  applicationName: "ELYRAX Dashboard",
};

export const viewport: Viewport = { themeColor: "#08090b", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><InitialExperience>{children}</InitialExperience></body></html>;
}
