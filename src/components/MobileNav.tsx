"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconMenu2,
  IconSearch,
  IconPhoto,
  IconSquarePlus,
  IconBell,
  IconUserCircle,
  IconSettings,
  IconLogout2,
  IconMessageCircle,
} from "@tabler/icons-react";
import db from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import BrandMark from "@/components/BrandMark";
import ThemeToggle from "@/components/ThemeToggle";
import UserSearch from "@/components/UserSearch";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile } = useProfile();

  // Unread notification count.
  const { data: notifData } = db.useQuery(
    user
      ? { notifications: { $: { where: { "recipient.id": user.id, read: false } } } }
      : null
  );
  const unreadCount = notifData?.notifications?.length ?? 0;

  // Unread message badge.
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
    setOpen(false);
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
    <div className="md:hidden sticky top-0 z-20 bg-surface/80 backdrop-blur border-b border-border">
      <header className="flex items-center justify-between px-4 h-14">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className="flex items-center justify-center w-9 h-9 rounded-lg
                text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
              aria-label="Open menu"
            >
              <IconMenu2 size={22} />
            </button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <BrandMark className="w-5 h-5 text-accent" />
                InstaConnect
              </SheetTitle>
            </SheetHeader>

            <nav className="flex flex-col gap-1 mt-2">
              {navItems.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5
                      text-sm font-medium transition-colors
                      ${
                        active
                          ? "bg-accent-soft text-accent-strong"
                          : "text-text-muted hover:bg-surface-2 hover:text-text"
                      }`}
                  >
                    <item.Icon size={20} aria-hidden="true" />
                    {item.label}
                    {Boolean(item.badge) && (
                      <span className="absolute left-7 top-2 w-2 h-2 rounded-full bg-accent" />
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto flex items-center justify-between px-1">
              <ThemeToggle />
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-sm font-medium
                  text-text-muted hover:text-negative transition-colors px-2 py-2"
              >
                <IconLogout2 size={18} aria-hidden="true" />
                Log out
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <Link
          href="/feed"
          className="flex items-center gap-1.5 text-text font-display font-semibold tracking-tight"
        >
          <BrandMark className="w-5 h-5 text-accent" />
          InstaConnect
        </Link>

        <button
          onClick={() => setSearchOpen((v) => !v)}
          className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
            searchOpen
              ? "bg-accent-soft text-accent-strong"
              : "text-text-muted hover:bg-surface-2 hover:text-text"
          }`}
          aria-label="Search"
          aria-expanded={searchOpen}
        >
          <IconSearch size={20} />
        </button>
      </header>

      {searchOpen && (
        <div className="px-4 pb-3">
          <UserSearch onNavigate={() => setSearchOpen(false)} />
        </div>
      )}
    </div>
  );
}
