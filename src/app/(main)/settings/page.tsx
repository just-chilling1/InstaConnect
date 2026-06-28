"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { id, type TransactionChunk } from "@instantdb/react";
import {
  IconLock,
  IconWorld,
  IconUsers,
  IconBan,
  IconMail,
  IconAlertTriangle,
  IconX,
} from "@tabler/icons-react";
import db from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import type { AppSchema } from "../../../../instant.schema";
import Avatar from "@/components/Avatar";
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

export default function SettingsPage() {
  const { user, profile, isLoading } = useProfile();
  const router = useRouter();

  const [blockInput, setBlockInput] = useState("");
  const [blockError, setBlockError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const blockedAccounts = blocksData?.blocks ?? [];

  if (isLoading || !user || !profile) return <FullScreenLoader />;

  async function handleSetDefaultPrivacy(value: "public" | "followers" | "private") {
    await db.transact([db.tx.profiles[profile!.id].update({ defaultPrivacy: value })]);
  }

  async function handleBlock(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const username = blockInput.trim().toLowerCase();
    if (!username) return;
    setBlocking(true);
    setBlockError(null);
    try {
      const { data } = await db.queryOnce({
        profiles: { $: { where: { username } }, user: {} },
      });
      const target = data.profiles[0];
      if (!target?.user) {
        setBlockError("No one by that username.");
        return;
      }
      if (target.user.id === user.id) {
        setBlockError("You can't block yourself.");
        return;
      }
      await db.transact([
        db.tx.blocks[id()]
          .update({ createdAt: Date.now() })
          .link({ blocker: user.id, blocked: target.user.id }),
      ]);
      setBlockInput("");
    } catch {
      setBlockError("Something went wrong. Try again.");
    } finally {
      setBlocking(false);
    }
  }

  async function handleUnblock(blockId: string) {
    await db.transact([db.tx.blocks[blockId].delete()]);
  }

  async function handleDeleteAccount() {
    if (!user) return;
    const confirmed = window.confirm(
      "This permanently deletes your profile, posts, and all related activity. This can't be undone. Continue?"
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      // Note: InstantDB's query types currently don't infer correctly when
      // combining `or` with dot-path link filters (e.g. "follower.id"), so
      // the two-sided relations below are fetched as separate queries and
      // merged here instead of using a single `or`-based query.
      const [
        { data: ownData },
        { data: followsAsFollower },
        { data: followsAsFollowing },
        { data: notificationsReceived },
        { data: notificationsSent },
        { data: blocksMade },
        { data: blocksReceived },
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
        }),
        db.queryOnce({ follows: { $: { where: { "follower.id": user.id } } } }),
        db.queryOnce({ follows: { $: { where: { "following.id": user.id } } } }),
        db.queryOnce({ notifications: { $: { where: { "recipient.id": user.id } } } }),
        db.queryOnce({ notifications: { $: { where: { "actor.id": user.id } } } }),
        db.queryOnce({ blocks: { $: { where: { "blocker.id": user.id } } } }),
        db.queryOnce({ blocks: { $: { where: { "blocked.id": user.id } } } }),
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
      for (const follow of follows.values()) txs.push(db.tx.follows[follow.id].delete());
      for (const n of notifications.values()) txs.push(db.tx.notifications[n.id].delete());
      for (const block of blocks.values()) txs.push(db.tx.blocks[block.id].delete());

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
      <h1 className="font-display text-xl font-semibold">Settings</h1>

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
          <form onSubmit={handleBlock} className="flex gap-2">
            <input
              value={blockInput}
              onChange={(e) => setBlockInput(e.target.value)}
              placeholder="username"
              className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-faint outline-none focus:border-accent transition-colors"
            />
            <button
              type="submit"
              disabled={blocking || !blockInput.trim()}
              className="text-sm font-medium border border-border rounded-lg px-3.5 py-2 text-text hover:bg-surface-2 disabled:opacity-50 transition-colors"
            >
              Block
            </button>
          </form>
          {blockError && <p className="text-sm text-negative">{blockError}</p>}

          {blockedAccounts.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-1">
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
                      onClick={() => handleUnblock(block.id)}
                      className="text-xs font-medium text-text-muted hover:text-text transition-colors"
                    >
                      Unblock
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-text-faint">
            Blocked accounts won&apos;t show up in your own feed. Note: this starter doesn&apos;t
            yet stop a blocked account from following or commenting elsewhere — extend the
            permission rules for that if you need it.
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
          InstaConnect uses passwordless sign-in — a fresh code is emailed to you each time, so
          there&apos;s no password to manage or leak. Use the sign-out icon in the navigation bar
          to end your session on this device.
        </p>
      </section>

      <SprocketDivider />

      {/* Danger zone */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-mono uppercase tracking-wide text-negative flex items-center gap-1.5">
          <IconAlertTriangle size={15} /> Danger zone
        </h2>
        <p className="text-sm text-text-muted">
          Deleting your account removes your profile, every post, like, comment, and follow
          relationship. This can&apos;t be undone.
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
