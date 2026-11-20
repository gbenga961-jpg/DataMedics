import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: {
    default: "DataMedics",
    template: "%s | DataMedics",
  },
  description: "Controlled CSV data cleaning",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
