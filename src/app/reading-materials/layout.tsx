import type { ReactNode } from "react";

export default function ReadingMaterialsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <main className="w-full min-w-0">{children}</main>;
}
