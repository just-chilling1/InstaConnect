"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/useProfile";
import FullScreenLoader from "@/components/FullScreenLoader";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, hasProfile, isLoading } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.replace(hasProfile ? "/feed" : "/onboarding");
    }
  }, [isLoading, user, hasProfile, router]);

  if (isLoading || user) {
    return <FullScreenLoader />;
  }

  return (
    <div className="flex-1 min-h-screen flex items-center justify-center px-4">
      {children}
    </div>
  );
}
