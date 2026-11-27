import type { Metadata } from "next";
import { PatConsoleView } from "@/components/pat-console-view";

export const metadata: Metadata = {
  title: "PAT & Ingest Console — ফ্যাক্টনিউজ বাংলাদেশ",
  robots: { index: false, follow: false },
};

export default function PatAdminPage() {
  return <PatConsoleView />;
}
