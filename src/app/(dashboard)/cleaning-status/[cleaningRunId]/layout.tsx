import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Cleaning Status & Preview",
};

export default function CleaningStatusLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
