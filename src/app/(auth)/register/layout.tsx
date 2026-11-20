import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Create Account",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
