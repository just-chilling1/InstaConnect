"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconPhoto,
  IconSquarePlus,
  IconBell,
  IconUserCircle,
  IconSettings,
  IconLogout2,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconMessageCircle,
} from "@tabler/icons-react";
import db from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import BrandMark from "@/components/BrandMark";
import ThemeToggle from "@/components/ThemeToggle";
import UserSearch from "@/components/UserSearch";

const DESKTOP_BREAKPOINT = 1024;
const STORAGE_KEY = "instaconnect:sidebar-collapsed";

function readStoredPreference(): boolean | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return null;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile } = useProfile();

  const [collapsed, setCollapsed] = useState(() => {
    const stored = readStoredPreference();
    if (stored !== null) return stored;
    if (typeof window === "undefined") return false;
    return window.innerWidth < DESKTOP_BREAKPOINT;
  });
  const [hasPreference, setHasPreference] = useState(
    () => readStoredPreference() !== null
  );

  useEffect(() => {
    if (hasPreference) return;
    function handleResize() {
      setCollapsed(window.innerWidth < DESKTOP_BREAKPOINT);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [hasPreference]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      setHasPreference(true);
      return next;
    });
  }

  // Unread notification count.
  const { data: notifData } = db.useQuery(
    user
      ? { notifications: { $: { where: { "recipient.id": user.id, read: false } } } }
      : null
  );
  const unreadCount = notifData?.notifications?.length ?? 0;

  // Unread message badge — a lightweight query that only fetches conversation
  // metadata (no messages), then checks the denormalised lastMessageRead flag.
  const { data: convData } = db.useQuery(
    user
      ? { conversations: { $: { where: { "participants.id": user.id } } } }
      : null
  );
  const hasUnreadMessages = (convData?.conversations ?? []).some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c: any) =>
      c.lastMessageSenderId &&
      c.lastMessageSenderId !== user?.id &&
      c.lastMessageRead === false
  );
  const unreadMessages = hasUnreadMessages ? 1 : 0;

  async function handleSignOut() {
    await db.auth.signOut();
    router.push("/login");
  }

  const profileHref = profile ? `/profile/${profile.username}` : "/feed";

  const navItems = [
    { href: "/feed", label: "Feed", Icon: IconPhoto, exact: true },
    { href: "/create", label: "Create", Icon: IconSquarePlus, exact: true },
    {
      href: "/notifications",
      label: "Activity",
      Icon: IconBell,
      exact: true,
      badge: unreadCount,
    },
    { href: profileHref, label: "Profile", Icon: IconUserCircle, exact: false },
    {
      href: "/messages",
      label: "Messages",
      Icon: IconMessageCircle,
      exact: false,
      badge: unreadMessages,
    },
    { href: "/settings", label: "Settings", Icon: IconSettings, exact: true },
  ];

  return (
    <aside
      className={`hidden md:flex md:flex-col md:sticky md:top-0 md:h-screen flex-shrink-0
        border-r border-border bg-surface px-3 py-5 transition-[width] duration-300 ease-in-out
        ${collapsed ? "md:w-[72px]" : "md:w-60"}`}
    >
      <div
        className={`flex items-center mb-6 ${
          collapsed ? "flex-col gap-3" : "justify-between gap-2"
        }`}
      >
        <Link
          href="/feed"
          className="flex items-center gap-2 text-text font-display font-semibold text-lg tracking-tight"
        >
          <BrandMark className="w-6 h-6 text-accent flex-shrink-0" />
          {!collapsed && <span className="whitespace-nowrap">InstaConnect</span>}
        </Link>
        <button
          onClick={toggleCollapsed}
          className="flex items-center justify-center w-8 h-8 rounded-lg
            text-text-muted hover:bg-surface-2 hover:text-text transition-colors flex-shrink-0"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <IconLayoutSidebarLeftExpand size={18} />
          ) : (
            <IconLayoutSidebarLeftCollapse size={18} />
          )}
        </button>
      </div>

      {!collapsed && <UserSearch className="mb-4" />}

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`relative flex items-center rounded-lg px-3 py-2.5 text-sm font-medium
                transition-colors ${collapsed ? "justify-center" : "gap-3"}
                ${
                  active
                    ? "bg-accent-soft text-accent-strong"
                    : "text-text-muted hover:bg-surface-2 hover:text-text"
                }`}
            >
              <span className="relative flex-shrink-0 flex items-center justify-center">
                <item.Icon size={20} aria-hidden="true" />
                {Boolean(item.badge) && (
                  <span className="absolute -right-0.5 -top-0.5 w-2 h-2 rounded-full bg-accent" />
                )}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div
        className={`mt-auto flex items-center px-1 ${
          collapsed ? "flex-col gap-2" : "justify-between"
        }`}
      >
        <ThemeToggle />
        <button
          onClick={handleSignOut}
          className="flex items-center justify-center w-10 h-10 rounded-lg
            text-text-muted hover:bg-surface-2 hover:text-negative transition-colors"
          aria-label="Log out"
          title={collapsed ? "Log out" : undefined}
        >
          <IconLogout2 size={20} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
