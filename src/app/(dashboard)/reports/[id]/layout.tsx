import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Analysis Report",
};

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
