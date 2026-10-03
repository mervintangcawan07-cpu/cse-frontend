"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import CSCServicesSheet from "../csc/CSCServicesSheet";
import { APP_ROUTES, isRouteActive } from "./appNavigation";
import { CSCIcon, HomeIcon, LearningIcon, PracticeIcon, ProfileIcon } from "./MobileNavIcons";
import { navigationStyles } from "./navigationStyles";

interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: ReactNode;
}

const homeItem: NavItem = {
  label: "Home",
  href: APP_ROUTES.dashboard,
  icon: <HomeIcon />,
};

const practiceItem: NavItem = {
  label: "Practice",
  href: APP_ROUTES.practice,
  icon: <PracticeIcon />,
};

const learningItem: NavItem = {
  label: "Learning",
  href: APP_ROUTES.learning,
  icon: <LearningIcon />,
};

const profileItem: NavItem = {
  label: "Profile",
  href: APP_ROUTES.profile,
  icon: <ProfileIcon />,
};

function NavLink({
  item,
  pathname,
  onNavigate,
}: Readonly<{
  item: NavItem;
  pathname: string;
  onNavigate: () => void;
}>) {
  const active = isRouteActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`${navigationStyles.itemBase} ${
        active ? navigationStyles.itemActive : navigationStyles.itemInactive
      }`}
    >
      <span className={active ? "scale-105" : ""}>{item.icon}</span>
      <span className="truncate">{item.label}</span>
      {active && <span className={navigationStyles.dot} />}
    </Link>
  );
}

export default function MobileBottomNavigation() {
  const pathname = usePathname();
  const [cscOpen, setCscOpen] = useState(false);
  const closeCsc = () => setCscOpen(false);

  return (
    <>
      <nav
        className={navigationStyles.root}
        aria-label="Primary mobile navigation"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }}
      >
        <div className="mx-auto grid h-[66px] max-w-3xl grid-cols-5 px-1.5 sm:px-3">
          <NavLink item={homeItem} pathname={pathname} onNavigate={closeCsc} />
          <NavLink item={practiceItem} pathname={pathname} onNavigate={closeCsc} />
          <NavLink item={learningItem} pathname={pathname} onNavigate={closeCsc} />

          <button
            type="button"
            onClick={() => setCscOpen(true)}
            aria-expanded={cscOpen}
            aria-controls="csc-services-sheet"
            className={`${navigationStyles.itemBase} ${
              cscOpen ? navigationStyles.itemActive : navigationStyles.itemInactive
            }`}
          >
            <CSCIcon />
            <span>CSC</span>
            {cscOpen && <span className={navigationStyles.dot} />}
          </button>

          <NavLink item={profileItem} pathname={pathname} onNavigate={closeCsc} />
        </div>
      </nav>

      <div id="csc-services-sheet">
        <CSCServicesSheet isOpen={cscOpen} onClose={closeCsc} />
      </div>
    </>
  );
}
