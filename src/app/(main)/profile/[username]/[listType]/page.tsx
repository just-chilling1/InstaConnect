"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconChevronLeft,
  IconUsers,
  IconSquare,
  IconSquareCheckFilled,
  IconUserMinus,
  IconUserX,
} from "@tabler/icons-react";
import db from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import FullScreenLoader from "@/components/FullScreenLoader";
import UserNotFound from "@/components/UserNotFound";

type ListType = "followers" | "following";

export default function FollowListPage() {
  const { username, listType: rawListType } = useParams<{ username: string; listType: string }>();
  const router = useRouter();
  const { user: currentUser } = useProfile();
  const listType: ListType = rawListType === "followers" ? "followers" : "following";

  // Bulk-action ("manage") state. Meaningful on either tab, but only when
  // it's *your own* list -- every place that reads `manageMode` below also
  // checks `isOwnList`, so switching tabs (or viewing someone else's list)
  // hides the manage UI without needing to reset this state from an effect.
  // What the bulk action actually does differs by tab (unfollow vs. remove
  // follower), but mechanically it's always "delete these `follows` rows",
  // so one set of state covers both.
  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // Per-row "Remove" (followers tab) has its own tiny busy set, separate
  // from manage mode's bulk one, so removing one follower inline doesn't
  // disable every other row's button too.
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  // Fetch both directions in one query regardless of which tab is active --
  // it's a small social graph, and this means switching tabs is instant
  // (no refetch) instead of re-querying every click.
  const { isLoading, data } = db.useQuery(
    currentUser
      ? {
          profiles: {
            $: { where: { username } },
            user: {
              followers: { follower: { profile: { avatar: {} } } },
              following: { following: { profile: { avatar: {} } } },
            },
          },
        }
      : null
  );

  const profile = data?.profiles?.[0];

  if (isLoading || !currentUser) return <FullScreenLoader />;
  if (!profile) return <UserNotFound username={username} />;

  if (rawListType !== "followers" && rawListType !== "following") {
    router.replace(`/profile/${username}/following`);
    return <FullScreenLoader />;
  }

  const followerEntries = profile.user?.followers ?? [];
  const followingEntries = profile.user?.following ?? [];

  // Each `follows` record nests the *other* person under a different link
  // name depending on direction -- normalize both into the same shape so
  // the list below doesn't need to care which tab it's rendering. Keeping
  // `followId` (the `follows` record's own id, not the person's) alongside
  // each person is what lets bulk actions delete records directly instead
  // of re-deriving a pairKey or re-querying per person.
  const followerPeople = followerEntries
    .filter((f) => Boolean(f.follower))
    .map((f) => ({ followId: f.id, person: f.follower! }));
  const followingPeople = followingEntries
    .filter((f) => Boolean(f.following))
    .map((f) => ({ followId: f.id, person: f.following! }));

  const people = listType === "followers" ? followerPeople : followingPeople;

  // Only the owner of a list can manage it -- on someone else's profile
  // you're seeing *their* relationships, not yours, so there's nothing
  // here for you to bulk-unfollow or remove.
  const isOwnList = currentUser.id === profile.user?.id;

  function toggleSelected(followId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(followId)) {
        next.delete(followId);
      } else {
        next.add(followId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === people.length ? new Set() : new Set(people.map((p) => p.followId))
    );
  }

  function exitManageMode() {
    setManageMode(false);
    setSelectedIds(new Set());
  }

  // Deletes a `follows` row outright. On the Following tab that's an
  // unfollow; on the Followers tab that's a "Remove follower" -- same
  // underlying write either way (and as of the updated perms, both
  // directions are allowed to delete the row: the follower by unfollowing,
  // or the followed user by removing). No notification cleanup needed,
  // matching FollowButton's single unfollow, which doesn't touch
  // notifications either.
  async function deleteFollowRecords(followIds: string[]) {
    await db.transact(followIds.map((followId) => db.tx.follows[followId].delete()));
  }

  async function runBulkAction() {
    if (selectedIds.size === 0 || bulkBusy) return;
    const count = selectedIds.size;
    const noun = count === 1 ? "person" : "people";
    const message =
      listType === "followers"
        ? `Remove ${count} ${noun} from your followers? They won't be notified, and they can follow you again later.`
        : `Unfollow ${count} ${noun}? This can't be undone.`;
    if (!window.confirm(message)) return;

    setBulkBusy(true);
    try {
      await deleteFollowRecords(Array.from(selectedIds));
      setSelectedIds(new Set());
      setManageMode(false);
    } catch (err) {
      console.error(
        listType === "followers" ? "Couldn't remove selected followers:" : "Couldn't unfollow selected people:",
        err
      );
    } finally {
      setBulkBusy(false);
    }
  }

  // Single-row "Remove follower" -- the Followers-tab-only counterpart to
  // FollowButton's single unfollow on the Following tab. Kept separate from
  // FollowButton because it removes a *different* relationship (their
  // follow of you, not your follow of them).
  async function removeFollower(followId: string, displayName: string) {
    if (removingIds.has(followId)) return;
    const ok = window.confirm(
      `Remove ${displayName} from your followers? They won't be notified, and they can follow you again later.`
    );
    if (!ok) return;

    setRemovingIds((prev) => new Set(prev).add(followId));
    try {
      await deleteFollowRecords([followId]);
    } catch (err) {
      console.error("Couldn't remove follower:", err);
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(followId);
        return next;
      });
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/profile/${username}`}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:bg-surface-2 hover:text-text transition-colors -ml-1.5"
          aria-label="Back to profile"
        >
          <IconChevronLeft size={20} />
        </Link>
        <h1 className="font-display text-lg font-semibold text-text">@{username}</h1>
      </div>

      <div className="flex items-center justify-between gap-3 -mt-2">
        <div className="flex gap-5">
          <Link
            href={`/profile/${username}/followers`}
            onClick={exitManageMode}
            className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
              listType === "followers" ? "border-accent text-text" : "border-transparent text-text-faint"
            }`}
          >
            Followers <span className="font-mono">{followerEntries.length}</span>
          </Link>
          <Link
            href={`/profile/${username}/following`}
            onClick={exitManageMode}
            className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
              listType === "following" ? "border-accent text-text" : "border-transparent text-text-faint"
            }`}
          >
            Following <span className="font-mono">{followingEntries.length}</span>
          </Link>
        </div>
        {isOwnList && people.length > 0 && (
          <button
            onClick={() => (manageMode ? exitManageMode() : setManageMode(true))}
            className="text-xs font-medium text-text-muted hover:text-text transition-colors mb-2"
          >
            {manageMode ? "Cancel" : "Manage"}
          </button>
        )}
      </div>

      {manageMode && isOwnList && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 -mt-2">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text transition-colors"
          >
            {selectedIds.size > 0 && selectedIds.size === people.length ? (
              <IconSquareCheckFilled size={16} className="text-accent" />
            ) : (
              <IconSquare size={16} />
            )}
            Select all
          </button>
          <span className="text-xs font-mono text-text-faint">{selectedIds.size} selected</span>
          <button
            onClick={runBulkAction}
            disabled={selectedIds.size === 0 || bulkBusy}
            className="flex items-center gap-1.5 text-xs font-medium border border-border rounded-lg px-2.5 py-1.5 text-negative hover:bg-negative/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {listType === "followers" ? <IconUserX size={14} /> : <IconUserMinus size={14} />}
            {bulkBusy
              ? listType === "followers"
                ? "Removing…"
                : "Unfollowing…"
              : listType === "followers"
                ? "Remove selected"
                : "Unfollow selected"}
          </button>
        </div>
      )}

      {people.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <IconUsers size={26} className="text-text-faint" />
          <p className="text-text-muted text-sm">
            {listType === "followers" ? "No followers yet." : "Not following anyone yet."}
          </p>
        </div>
      )}

      <div className="flex flex-col">
        {people.map(({ followId, person }) => {
          const personProfile = person.profile;
          if (!personProfile) return null;
          const selected = selectedIds.has(followId);
          const removing = removingIds.has(followId);
          return (
            <div key={followId} className="flex items-center gap-3 px-1 py-3">
              <Link
                href={`/profile/${personProfile.username}`}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <Avatar
                  url={personProfile.avatar?.url}
                  name={personProfile.displayName}
                  size={44}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text truncate">
                    {personProfile.displayName}
                  </p>
                  <p className="text-xs font-mono text-text-faint truncate">
                    @{personProfile.username}
                  </p>
                </div>
              </Link>
              {manageMode && isOwnList ? (
                <button
                  onClick={() => toggleSelected(followId)}
                  aria-pressed={selected}
                  aria-label={selected ? `Deselect @${personProfile.username}` : `Select @${personProfile.username}`}
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-text-faint hover:bg-surface-2 transition-colors"
                >
                  {selected ? (
                    <IconSquareCheckFilled size={22} className="text-accent" />
                  ) : (
                    <IconSquare size={22} />
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {/*
                    Always reflects *your* relationship to this person, not
                    the profile owner's -- e.g. on someone else's followers
                    list, this shows whether you follow that follower, not
                    whether the profile owner does (they obviously do,
                    that's why this person is in the list). This is also
                    what gives people a single-tap way to unfollow someone:
                    open your own Following list and press the button (or
                    use Manage above to do several at once).
                  */}
                  <FollowButton targetUserId={person.id} currentUserId={currentUser.id} />
                  {/*
                    "Remove follower" only makes sense on your own Followers
                    tab -- it ends *their* follow of *you*, which is a
                    different relationship than the FollowButton above (your
                    follow of them). Not shown elsewhere: you can't remove a
                    follower from someone else's account, and it has no
                    meaning on the Following tab.
                  */}
                  {isOwnList && listType === "followers" && (
                    <button
                      onClick={() => removeFollower(followId, personProfile.displayName)}
                      disabled={removing}
                      aria-label={`Remove @${personProfile.username} as a follower`}
                      title="Remove follower"
                      className="flex items-center justify-center w-8 h-8 rounded-lg text-text-faint hover:bg-negative/10 hover:text-negative transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <IconUserX size={18} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
