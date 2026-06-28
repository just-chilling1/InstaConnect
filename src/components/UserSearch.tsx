"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch, IconX } from "@tabler/icons-react";
import db from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import Avatar from "@/components/Avatar";

const DEBOUNCE_MS = 300;

type UserSearchProps = {
  /** Called after navigating to a result, e.g. to close a mobile menu. */
  onNavigate?: () => void;
  className?: string;
};

export default function UserSearch({ onNavigate, className = "" }: UserSearchProps) {
  const { user } = useProfile();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data, isLoading } = db.useQuery(
    debounced
      ? {
          profiles: {
            $: {
              where: {
                or: [
                  { username: { $ilike: `%${debounced}%` } },
                  { displayName: { $ilike: `%${debounced}%` } },
                ],
              },
              limit: 8,
            },
            avatar: {},
            user: {},
          },
        }
      : null
  );

  const results = (data?.profiles ?? []).filter((p) => p.user?.id !== user?.id);
  const showDropdown = open && debounced.length > 0;

  function goToProfile(username: string) {
    setOpen(false);
    setQuery("");
    router.push(`/profile/${username}`);
    onNavigate?.();
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2 bg-ink border border-border rounded-lg px-3 py-2 focus-within:border-accent transition-colors">
        <IconSearch size={16} className="text-text-faint flex-shrink-0" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search people"
          className="flex-1 min-w-0 bg-transparent text-sm text-text placeholder:text-text-faint outline-none"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setDebounced("");
            }}
            className="text-text-faint hover:text-text transition-colors flex-shrink-0"
            aria-label="Clear search"
          >
            <IconX size={14} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 mt-2 rounded-lg border border-border bg-surface shadow-lg z-40 overflow-hidden max-h-80 overflow-y-auto">
          {isLoading && <p className="px-3.5 py-3 text-sm text-text-faint">Searching...</p>}

          {!isLoading && results.length === 0 && (
            <p className="px-3.5 py-3 text-sm text-text-faint">No users found.</p>
          )}

          {!isLoading &&
            results.map((profile) => (
              <button
                key={profile.id}
                onClick={() => goToProfile(profile.username)}
                className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left hover:bg-surface-2 transition-colors"
              >
                <Avatar url={profile.avatar?.url} name={profile.displayName} size={32} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text truncate">{profile.username}</p>
                  <p className="text-xs text-text-muted truncate">{profile.displayName}</p>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
