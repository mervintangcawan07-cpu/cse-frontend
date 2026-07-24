"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Reviewer Module", href: "/reviewer" },
  { name: "Reading Materials", href: "/reading-materials" },
];

export default function Sidebar() {
  const pathname = usePathname();
  
  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-screen p-4 flex flex-col justify-between hidden md:flex">
      <div>
        <div className="px-3 py-4 mb-4 border-b border-slate-800">
          <Link href="/" className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span className="bg-blue-600 text-white p-1.5 rounded-lg text-xs">CSS</span> Platform
          </Link>
        </div>
        
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition ${
                  isActive ? "bg-blue-600 text-white font-semibold" : "hover:bg-slate-800 hover:text-white text-slate-400"
                }`}
              >
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      
      <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-800 text-xs">
        <p className="font-semibold text-white">Maria Santos</p>
        <p className="text-slate-400 truncate">maria@example.com</p>
      </div>
    </aside>
  );
}