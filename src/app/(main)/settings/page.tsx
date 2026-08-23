"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { type TransactionChunk } from "@instantdb/react";
import {
  IconLock,
  IconWorld,
  IconUsers,
  IconBan,
  IconMail,
  IconAlertTriangle,
  IconX,
  IconEdit,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconLogout2,
} from "@tabler/icons-react";
import db from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import type { AppSchema } from "../../../../instant.schema";
import Avatar from "@/components/Avatar";
import BrandMark from "@/components/BrandMark";
import EditProfileForm from "@/components/EditProfileForm";
import FullScreenLoader from "@/components/FullScreenLoader";
import SprocketDivider from "@/components/SprocketDivider";

const PRIVACY_OPTIONS = [
  { value: "public" as const, label: "Public", hint: "Anyone can see new posts", Icon: IconWorld },
  {
    value: "followers" as const,
    label: "Followers",
    hint: "Only people who follow you",
    Icon: IconUsers,
  },
  { value: "private" as const, label: "Only you", hint: "Visible to you alone", Icon: IconLock },
];

const THEME_OPTIONS = [
  { value: "light" as const, label: "Light", hint: "Bright light-table look", Icon: IconSun },
  { value: "dark" as const, label: "Dark", hint: "Moody darkroom look", Icon: IconMoon },
  {
    value: "system" as const,
    label: "System",
    hint: "Match your device setting",
    Icon: IconDeviceDesktop,
  },
];

export default function SettingsPage() {
  const { user, profile, isLoading } = useProfile();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [editingProfile, setEditingProfile] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const { data: blocksData } = db.useQuery(
    user
      ? {
          blocks: {
            $: { where: { "blocker.id": user.id }, order: { createdAt: "desc" } },
            blocked: { profile: { avatar: {} } },
          },
        }
      : null
  );

  // Dedupe by blocked user id: duplicate block records could be created
  // before the duplicate-block guard existed, so show each account once.
  const allBlocks = blocksData?.blocks ?? [];
  const seenBlockedIds = new Set<string>();
  const blockedAccounts = allBlocks.filter((block) => {
    const blockedId = block.blocked?.id;
    if (!blockedId || seenBlockedIds.has(blockedId)) return false;
    seenBlockedIds.add(blockedId);
    return true;
  });

  if (isLoading || !user || !profile) return <FullScreenLoader />;

  async function handleSetDefaultPrivacy(value: "public" | "followers" | "private") {
    await db.transact([db.tx.profiles[profile!.id].update({ defaultPrivacy: value })]);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await db.auth.signOut();
      router.push("/login");
    } finally {
      setSigningOut(false);
    }
  }

  async function handleUnblock(blockedUserId: string | undefined) {
    if (!blockedUserId) return;
    // Delete every record for this blocked user, including any duplicates.
    const toDelete = allBlocks.filter((b) => b.blocked?.id === blockedUserId);
    if (toDelete.length === 0) return;
    await db.transact(toDelete.map((b) => db.tx.blocks[b.id].delete()));
  }

  async function handleDeleteAccount() {
    if (!user) return;
    const confirmed = window.confirm(
      "This permanently deletes your profile, posts, messages, and all related activity. This can't be undone. Continue?"
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      // Prefer server-side deletion when admin token is configured.
      const apiRes = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (apiRes.ok) {
        await db.auth.signOut();
        router.push("/login");
        return;
      }
      if (apiRes.status !== 501) {
        throw new Error("Server deletion failed");
      }

      // Client-side fallback when INSTANT_APP_ADMIN_TOKEN is not set.
      const [
        { data: ownData },
        { data: followsAsFollower },
        { data: followsAsFollowing },
        { data: notificationsReceived },
        { data: notificationsSent },
        { data: blocksMade },
        { data: blocksReceived },
        { data: conversationsData },
      ] = await Promise.all([
        db.queryOnce({
          profiles: { $: { where: { "user.id": user.id } }, avatar: {} },
          posts: {
            $: { where: { "author.id": user.id } },
            image: {},
            likes: {},
            comments: {},
            notifications: {},
          },
          likes: { $: { where: { "user.id": user.id } } },
          comments: { $: { where: { "author.id": user.id } } },
          bookmarks: { $: { where: { "user.id": user.id } } },
          reports: { $: { where: { "reporter.id": user.id } } },
        }),
        db.queryOnce({ follows: { $: { where: { "follower.id": user.id } } } }),
        db.queryOnce({ follows: { $: { where: { "following.id": user.id } } } }),
        db.queryOnce({ notifications: { $: { where: { "recipient.id": user.id } } } }),
        db.queryOnce({ notifications: { $: { where: { "actor.id": user.id } } } }),
        db.queryOnce({ blocks: { $: { where: { "blocker.id": user.id } } } }),
        db.queryOnce({ blocks: { $: { where: { "blocked.id": user.id } } } }),
        db.queryOnce({
          conversations: {
            $: { where: { "participants.id": user.id } },
            messages: {},
            notifications: {},
          },
        }),
      ]);

      const follows = new Map(
        [...followsAsFollower.follows, ...followsAsFollowing.follows].map((f) => [f.id, f])
      );
      const notifications = new Map(
        [...notificationsReceived.notifications, ...notificationsSent.notifications].map((n) => [
          n.id,
          n,
        ])
      );
      const blocks = new Map(
        [...blocksMade.blocks, ...blocksReceived.blocks].map((b) => [b.id, b])
      );

      const txs: TransactionChunk<AppSchema, keyof AppSchema["entities"]>[] = [];
      for (const post of ownData.posts ?? []) {
        for (const like of post.likes ?? []) txs.push(db.tx.likes[like.id].delete());
        for (const comment of post.comments ?? []) txs.push(db.tx.comments[comment.id].delete());
        for (const n of post.notifications ?? []) txs.push(db.tx.notifications[n.id].delete());
        if (post.image?.id) txs.push(db.tx.$files[post.image.id].delete());
        txs.push(db.tx.posts[post.id].delete());
      }
      for (const like of ownData.likes ?? []) txs.push(db.tx.likes[like.id].delete());
      for (const comment of ownData.comments ?? []) txs.push(db.tx.comments[comment.id].delete());
      for (const bookmark of ownData.bookmarks ?? []) txs.push(db.tx.bookmarks[bookmark.id].delete());
      for (const report of ownData.reports ?? []) txs.push(db.tx.reports[report.id].delete());
      for (const follow of follows.values()) txs.push(db.tx.follows[follow.id].delete());
      for (const n of notifications.values()) txs.push(db.tx.notifications[n.id].delete());
      for (const block of blocks.values()) txs.push(db.tx.blocks[block.id].delete());

      for (const conversation of conversationsData.conversations ?? []) {
        for (const message of conversation.messages ?? []) {
          txs.push(db.tx.messages[message.id].delete());
        }
        for (const n of conversation.notifications ?? []) {
          txs.push(db.tx.notifications[n.id].delete());
        }
        txs.push(db.tx.conversations[conversation.id].delete());
      }

      const targetProfile = ownData.profiles?.[0];
      if (targetProfile) {
        if (targetProfile.avatar?.id) txs.push(db.tx.$files[targetProfile.avatar.id].delete());
        txs.push(db.tx.profiles[targetProfile.id].delete());
      }

      if (txs.length > 0) await db.transact(txs);
      await db.auth.signOut();
      router.push("/login");
    } catch {
      setDeleteError("Couldn't delete your account. Try again, or contact support.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 flex flex-col gap-8">
      <div className="flex items-center gap-2.5">
        <BrandMark className="w-9 h-9" />
        <h1 className="font-display text-xl font-semibold">Settings</h1>
      </div>

      {/* Profile */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-mono uppercase tracking-wide text-text-faint">Profile</h2>

        {editingProfile ? (
          <EditProfileForm
            profile={profile}
            userId={user.id}
            onDone={() => setEditingProfile(false)}
          />
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5">
            <Avatar url={profile.avatar?.url} name={profile.displayName} size={48} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text truncate">{profile.displayName}</p>
              <p className="text-xs text-text-muted truncate">@{profile.username}</p>
            </div>
            <button
              onClick={() => setEditingProfile(true)}
              className="flex items-center gap-1.5 text-sm font-medium border border-border rounded-lg px-3 py-1.5 text-text hover:bg-surface-2 transition-colors"
            >
              <IconEdit size={15} />
              Edit
            </button>
          </div>
        )}
      </section>

      <SprocketDivider />

      {/* Appearance */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-mono uppercase tracking-wide text-text-faint">Appearance</h2>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-muted">Theme</p>
          {THEME_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 cursor-pointer transition-colors ${
                (theme ?? "system") === option.value
                  ? "border-accent bg-accent-soft"
                  : "border-border hover:border-border-strong"
              }`}
            >
              <input
                type="radio"
                name="theme"
                className="hidden"
                checked={(theme ?? "system") === option.value}
                onChange={() => setTheme(option.value)}
              />
              <option.Icon
                size={18}
                className={
                  (theme ?? "system") === option.value ? "text-accent-strong" : "text-text-faint"
                }
              />
              <div>
                <p className="text-sm font-medium text-text">{option.label}</p>
                <p className="text-xs text-text-muted">{option.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      <SprocketDivider />

      {/* Notifications */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-mono uppercase tracking-wide text-text-faint">Notifications</h2>
        <p className="text-sm text-text-muted">Mute activity types you don&apos;t want to see.</p>
        {(
          [
            { field: "muteLikeNotifications" as const, label: "Likes" },
            { field: "muteCommentNotifications" as const, label: "Comments" },
            { field: "muteFollowNotifications" as const, label: "New followers" },
            { field: "muteMessageNotifications" as const, label: "Messages" },
          ] as const
        ).map(({ field, label }) => (
          <label
            key={field}
            className="flex items-center justify-between rounded-lg border border-border px-3.5 py-2.5 cursor-pointer hover:border-border-strong transition-colors"
          >
            <span className="text-sm text-text">{label}</span>
            <input
              type="checkbox"
              checked={Boolean(profile[field])}
              onChange={async (e) => {
                await db.transact([
                  db.tx.profiles[profile.id].update({ [field]: e.target.checked }),
                ]);
              }}
              className="accent-accent"
            />
          </label>
        ))}
      </section>

      <SprocketDivider />

      {/* Privacy */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-mono uppercase tracking-wide text-text-faint">Privacy</h2>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-muted">Default audience for new posts</p>
          {PRIVACY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 cursor-pointer transition-colors ${
                (profile.defaultPrivacy ?? "public") === option.value
                  ? "border-accent bg-accent-soft"
                  : "border-border hover:border-border-strong"
              }`}
            >
              <input
                type="radio"
                name="defaultPrivacy"
                className="hidden"
                checked={(profile.defaultPrivacy ?? "public") === option.value}
                onChange={() => handleSetDefaultPrivacy(option.value)}
              />
              <option.Icon
                size={18}
                className={
                  (profile.defaultPrivacy ?? "public") === option.value
                    ? "text-accent-strong"
                    : "text-text-faint"
                }
              />
              <div>
                <p className="text-sm font-medium text-text">{option.label}</p>
                <p className="text-xs text-text-muted">{option.hint}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <p className="text-sm text-text-muted flex items-center gap-1.5">
            <IconBan size={15} /> Blocked accounts
          </p>

          {blockedAccounts.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {blockedAccounts.map((block) => {
                const blockedProfile = block.blocked?.profile;
                return (
                  <div
                    key={block.id}
                    className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2"
                  >
                    <Avatar
                      url={blockedProfile?.avatar?.url}
                      name={blockedProfile?.displayName ?? "?"}
                      size={28}
                    />
                    <span className="flex-1 text-sm text-text">
                      {blockedProfile?.username ?? "unknown"}
                    </span>
                    <button
                      onClick={() => handleUnblock(block.blocked?.id)}
                      className="text-xs font-medium text-text-muted hover:text-text transition-colors"
                    >
                      Unblock
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-faint">
              You haven&apos;t blocked anyone. Block someone from their profile page.
            </p>
          )}
          <p className="text-xs text-text-faint">
            Blocked accounts won&apos;t show up in your feed and can&apos;t follow, like, or comment
            on your posts (enforced in permission rules).
          </p>
        </div>
      </section>

      <SprocketDivider />

      {/* Account */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-mono uppercase tracking-wide text-text-faint">Account</h2>
        <div className="flex items-center gap-2.5 text-sm text-text-muted">
          <IconMail size={16} />
          <span>{user.email}</span>
        </div>
        <p className="text-xs text-text-faint">
          InstaConnect uses passwordless sign-in — a fresh code is emailed to you each time.
        </p>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="self-start flex items-center gap-1.5 text-sm font-medium border border-border rounded-lg px-3.5 py-2 text-text hover:bg-surface-2 disabled:opacity-50 transition-colors"
        >
          <IconLogout2 size={15} />
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
      </section>

      <SprocketDivider />

      {/* Danger zone */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-mono uppercase tracking-wide text-negative flex items-center gap-1.5">
          <IconAlertTriangle size={15} /> Danger zone
        </h2>
        <p className="text-sm text-text-muted">
          Deleting your account removes your profile, posts, messages, likes, comments, and follow
          relationships. This can&apos;t be undone.
        </p>
        {deleteError && <p className="text-sm text-negative">{deleteError}</p>}
        <button
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="self-start flex items-center gap-1.5 text-sm font-medium border border-negative text-negative rounded-lg px-3.5 py-2 hover:bg-negative/10 disabled:opacity-50 transition-colors"
        >
          <IconX size={15} />
          {deleting ? "Deleting..." : "Delete my account"}
        </button>
      </section>
    </div>
  );
}
