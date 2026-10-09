import type { ReactNode } from "react";

export default function ReviewerLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <main className="w-full min-w-0">{children}</main>;
}
