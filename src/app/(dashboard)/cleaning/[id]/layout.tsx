import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Controlled Cleaning",
};

export default function CleaningLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
