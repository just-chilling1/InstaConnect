"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/useProfile";
import FullScreenLoader from "@/components/FullScreenLoader";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, hasProfile, isLoading } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!hasProfile) {
      router.replace("/onboarding");
    }
  }, [isLoading, user, hasProfile, router]);

  if (isLoading || !user || !hasProfile) {
    return <FullScreenLoader />;
  }

  return (
    // Root cause of the gap to the left of the sidebar: this row used to be
    // wrapped in `mx-auto max-w-[1300px]`, which capped *and centered* the
    // sidebar + feed together. On any screen wider than 1300px (basically
    // any laptop), that pushed the whole app -- sidebar included -- away
    // from the edge, leaving equal empty margins on both sides. The sidebar
    // should always sit flush against the edge of the window, so the outer
    // row now spans the full width with no max-width of its own.
    //
    // This doesn't make the page content unreadably wide on big screens:
    // every individual page (feed, profile, settings, ...) already wraps
    // its own content in `mx-auto max-w-xl`, so it keeps centering itself
    // within whatever space is left after the sidebar -- it just no longer
    // has to share that centering with the sidebar.
    <div className="flex w-full">
      <Sidebar />
      {/*
        No fixed margin here on purpose: Sidebar is a normal (sticky, not
        fixed) flex item now, so when its width animates between collapsed
        and expanded, this column -- and the feed inside it -- automatically
        grows or shrinks to fill exactly the space the sidebar gives up.
        `min-w-0` keeps it from being forced wider than the row by its
        content, which is what lets it actually shrink/grow correctly.
      */}
      <div className="flex w-full min-w-0 flex-col md:px-4">
        <MobileNav />
        <main className="flex-1 w-full">{children}</main>
      </div>
    </div>
  );
}
