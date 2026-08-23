import Link from "next/link";
import { IconUserOff } from "@tabler/icons-react";

export default function UserNotFound({ username }: { username: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 flex flex-col items-center gap-3 text-center">
      <IconUserOff size={32} className="text-text-faint" />
      <h1 className="font-display text-lg font-semibold text-text">User not found</h1>
      <p className="text-text-muted text-sm">
        No one on InstaConnect goes by <span className="font-mono">@{username}</span>.
      </p>
      <Link
        href="/feed"
        className="text-sm font-medium text-accent hover:text-accent-strong transition-colors mt-1"
      >
        Back to your feed
      </Link>
    </div>
  );
}
