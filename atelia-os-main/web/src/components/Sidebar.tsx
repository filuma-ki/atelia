"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Users,
  FolderKanban,
  Calendar,
  FileText,
  Settings,
  UserCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
} from "lucide-react";

const ICON_SIZE = 18;
const ICON_STROKE = 1.25;

const mainNav = [
  { label: "Dashboard", href: "/app", icon: LayoutDashboard },
  { label: "Clients", href: "/app/clients", icon: Users },
  { label: "Projects", href: "/app/projects", icon: FolderKanban },
  { label: "Appointments", href: "/app/appointments", icon: Calendar },
  { label: "Invoices", href: "/app/invoices", icon: FileText },
];

const bottomNav = [
  { label: "Settings", href: "/app/settings", icon: Settings },
  { label: "Account", href: "/app/account", icon: UserCircle },
];

export default function Sidebar({
  collapsed,
  onToggle,
  onLogout,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const active = (href: string) => pathname === href;

  const asideW = collapsed ? "w-[96px]" : "w-[260px]";
  const navX = collapsed ? "px-4" : "px-3";

  const Row = ({
    href,
    label,
    Icon,
  }: {
    href: string;
    label: string;
    Icon: any;
  }) => {
    const isActive = active(href);

    // Expanded: row highlight (rounded-lg)
    if (!collapsed) {
      return (
        <Link
          href={href}
          className={[
            "group flex items-center gap-3",
            "px-4 py-2.5 text-[14px] font-light",
            "rounded-lg transition-colors",
            isActive
              ? "bg-neutral-800/70 text-white"
              : "text-neutral-300 hover:bg-neutral-800/40 hover:text-neutral-100",
          ].join(" ")}
        >
          <Icon
            size={ICON_SIZE}
            strokeWidth={ICON_STROKE}
            className="text-neutral-300 group-hover:text-neutral-100"
          />
          <span>{label}</span>
        </Link>
      );
    }

    // Collapsed: square highlight around icon (square)
    return (
      <Link
        href={href}
        className="flex justify-center"
        aria-label={label}
        title={label}
      >
        <div
          className={[
            "flex items-center justify-center",
            "h-12 w-12 rounded-lg", // <- square
            "transition-colors",
            isActive
              ? "bg-neutral-800/70 text-white"
              : "text-neutral-300 hover:bg-neutral-800/40 hover:text-neutral-100",
          ].join(" ")}
        >
          <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
        </div>
      </Link>
    );
  };

  return (
    <aside
      className={[
        "h-screen flex flex-col",
        "bg-neutral-900 border-r border-neutral-800",
        "transition-all duration-300 ease-in-out",
        asideW,
      ].join(" ")}
    >
      {/* Header */}
      <div className="px-4 pt-4">
        <div className="relative flex items-center h-10">
          {!collapsed && (
            <div className="text-[12px] font-light tracking-[0.28em] text-neutral-300">
              ATELIA
            </div>
          )}

          {/* Toggle */}
          <button
            onClick={onToggle}
            className={[
              "h-9 w-9 flex items-center justify-center",
              collapsed ? "mx-auto" : "ml-auto", // <- expanded: right edge
              "rounded-lg text-neutral-300",
              "hover:bg-neutral-800/40 hover:text-neutral-100 transition",
            ].join(" ")}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            {collapsed ? (
              <ChevronRight size={18} strokeWidth={1.25} />
            ) : (
              <ChevronLeft size={18} strokeWidth={1.25} />
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="mt-4 h-px bg-neutral-800" />
      </div>

      {/* Main */}
      <nav className={[navX, "pt-5", collapsed ? "space-y-3" : "space-y-2"].join(" ")}>
        {mainNav.map((item) => (
          <Row
            key={item.href}
            href={item.href}
            label={item.label}
            Icon={item.icon}
          />
        ))}
      </nav>

      {/* Bottom */}
      <div
        className={[
          "mt-auto pb-4",
          navX,
          collapsed ? "space-y-3" : "space-y-2",
        ].join(" ")}
      >
        {bottomNav.map((item) => (
          <Row
            key={item.href}
            href={item.href}
            label={item.label}
            Icon={item.icon}
          />
        ))}

        {/* Logout */}
        {!collapsed ? (
          <button
            onClick={onLogout}
            className={[
              "w-full group flex items-center gap-3",
              "px-4 py-2.5 text-[14px] font-light",
              "rounded-lg transition-colors",
              "text-neutral-300 hover:bg-neutral-800/40 hover:text-neutral-100",
            ].join(" ")}
          >
            <LogOut size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            <span>Log out</span>
          </button>
        ) : (
          <button
            onClick={onLogout}
            className="flex justify-center w-full"
            aria-label="Log out"
            title="Log out"
          >
            <div className="flex items-center justify-center h-12 w-12 rounded-none text-neutral-300 hover:bg-neutral-800/40 hover:text-neutral-100 transition-colors">
              <LogOut size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            </div>
          </button>
        )}
      </div>
    </aside>
  );
}