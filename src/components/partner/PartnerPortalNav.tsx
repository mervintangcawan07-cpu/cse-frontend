// Relative Path: src/components/partner/PartnerPortalNav.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  TrendingUp,
  FileText,
  DollarSign,
  CreditCard,
  User,
  Shield,
  LogOut,
  Sparkles,
  ExternalLink,
  Layers,
  Menu,
  X,
} from "lucide-react";

interface PartnerPortalNavProps {
  partner?: {
    name?: string;
    partnerId?: string;
    code?: string;
    badgeText?: string;
    slug?: string | null;
  } | null;
}

export default function PartnerPortalNav({ partner }: PartnerPortalNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/partner-portal/dashboard", label: "Dashboard", icon: TrendingUp },
    { href: "/partner-portal/transactions", label: "Transactions", icon: Layers },
    { href: "/partner-portal/commissions", label: "Commissions", icon: DollarSign },
    { href: "/partner-portal/statements", label: "Statements", icon: FileText },
    { href: "/partner-portal/payouts", label: "Payouts", icon: CreditCard },
    { href: "/partner-portal/profile", label: "Profile", icon: User },
    { href: "/partner-portal/security", label: "Security", icon: Shield },
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/partner/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    router.push("/partner-portal/login");
  };

  const displayPartnerId = partner?.partnerId || partner?.code || "PT-000000";

  return (
    <>
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/partner-portal/dashboard" className="flex items-center gap-2.5">
              <Image
                src="/brand/govstudyx-icon.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 object-contain"
              />
              <div>
                <div className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                  <span>GovStudyX</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                    PARTNER PORTAL
                  </span>
                </div>
              </div>
            </Link>

            {partner?.name && (
              <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs">
                <span className="font-bold text-slate-300 truncate max-w-[200px]">{partner.name}</span>
                <span className="font-mono text-[11px] font-black text-emerald-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {displayPartnerId}
                </span>
              </div>
            )}
          </div>

          {/* Desktop Quick Actions */}
          <div className="hidden lg:flex items-center gap-2">
            <Link
              href={`/p/${partner?.slug || displayPartnerId}`}
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 transition"
            >
              <span>Landing Page</span>
              <ExternalLink className="w-3 h-3" />
            </Link>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <div className="hidden lg:block border-t border-slate-900 bg-slate-950/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto py-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 whitespace-nowrap ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 bg-slate-950 px-4 py-3 space-y-1">
            {partner && (
              <div className="p-3 mb-2 bg-slate-900 rounded-xl border border-slate-800 text-xs flex justify-between items-center">
                <span className="font-bold text-white">{partner.name}</span>
                <span className="font-mono text-emerald-400 font-bold">{displayPartnerId}</span>
              </div>
            )}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-900"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="pt-2 border-t border-slate-900">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 font-bold"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
