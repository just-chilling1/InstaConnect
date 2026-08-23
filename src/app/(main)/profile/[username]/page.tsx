"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconEdit,
  IconArchive,
  IconArchiveOff,
  IconTrash,
  IconCheck,
  IconX,
  IconLink,
  IconMapPin,
  IconPlayerPlayFilled,
  IconMessage2,
  IconBan,
  IconHeartFilled,
  IconMessageCircleFilled,
} from "@tabler/icons-react";
import { id, type TransactionChunk } from "@instantdb/react";
import db from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import { openConversation } from "@/lib/openConversation";
import type { AppSchema } from "../../../../../instant.schema";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import PostCard from "@/components/PostCard";
import EditProfileForm from "@/components/EditProfileForm";
import FullScreenLoader from "@/components/FullScreenLoader";
import SprocketDivider from "@/components/SprocketDivider";
import UserNotFound from "@/components/UserNotFound";
import ReportButton from "@/components/ReportButton";
import { PRIVACY_OPTIONS } from "@/lib/privacy";

type Tab = "posts" | "archived";

const POST_PAGE_SIZE = 30;

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useProfile();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("posts");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editPrivacy, setEditPrivacy] = useState<"public" | "followers" | "private">("public");
  const [editError, setEditError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [messagingBusy, setMessagingBusy] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [postLimit, setPostLimit] = useState(POST_PAGE_SIZE);

  // Fetch the profile. We include follower/following *with* the linked user
  // records so we can determine mutual-follow status without an extra query.
  //
  // followers: follows records where `following = targetUser`
  //   → each record's `.follower` is the $user who follows them
  // following: follows records where `follower = targetUser`
  //   → each record's `.following` is the $user they follow
  const { isLoading: profileLoading, data: profileData } = db.useQuery(
    currentUser
      ? {
          profiles: {
            $: { where: { username } },
            avatar: {},
            user: {
              followers: { follower: {} },
              following: { following: {} },
            },
          },
        }
      : null
  );

  const profile = profileData?.profiles?.[0];
  const targetUserId = profile?.user?.id;
  const isOwner = Boolean(currentUser && targetUserId === currentUser.id);

  // Mutual-follow check:
  // iFollowThem = currentUser appears in targetUser's *followers*
  // theyFollowMe = currentUser appears in targetUser's *following* targets
  const iFollowThem = !isOwner && (profile?.user?.followers ?? []).some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (f: any) => f.follower?.id === currentUser?.id
  );
  const theyFollowMe = !isOwner && (profile?.user?.following ?? []).some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (f: any) => f.following?.id === currentUser?.id
  );
  const isMutualFollow = iFollowThem && theyFollowMe;

  // Query by the blocker side only and match the target client-side --
  // compound dot-path link filters (two link conditions in one `where`)
  // don't reliably return matches, which previously made `isBlocked`
  // always false and allowed blocking the same account repeatedly.
  const { data: blockData } = db.useQuery(
    currentUser && targetUserId && targetUserId !== currentUser.id
      ? {
          blocks: {
            $: { where: { "blocker.id": currentUser.id } },
            blocked: {},
          },
        }
      : null
  );
  const blockRecords = (blockData?.blocks ?? []).filter(
    (b) => b.blocked?.id === targetUserId
  );
  const isBlocked = blockRecords.length > 0;

  const { data: postsData } = db.useQuery(
    targetUserId && currentUser
      ? {
          posts: {
            $: {
              where: { "author.id": targetUserId, archived: tab === "archived" },
              order: { createdAt: "desc" },
              limit: postLimit,
            },
            author: { profile: { avatar: {} } },
            image: {},
            likes: { $: { where: { "user.id": currentUser.id } } },
            notifications: {},
          },
        }
      : null
  );

  const { data: postCountData } = db.useQuery(
    targetUserId
      ? { posts: { $: { where: { "author.id": targetUserId, archived: false } } } }
      : null
  );
  const postsCount = postCountData?.posts?.length ?? 0;

  const posts = postsData?.posts ?? [];
  const selectedPost = posts.find((p) => p.id === selectedPostId) ?? null;

  if (profileLoading || !currentUser) return <FullScreenLoader />;

  if (!profile) {
    return <UserNotFound username={username} />;
  }

  function startEdit(post: typeof selectedPost) {
    if (!post) return;
    setEditingPostId(post.id);
    setEditCaption(post.caption ?? "");
    setEditPrivacy(post.privacy as "public" | "followers" | "private");
    setEditError(null);
  }

  async function saveEdit() {
    if (!editingPostId) return;
    const trimmed = editCaption.trim();
    const editingPost = posts.find((p) => p.id === editingPostId);
    if (!trimmed && !editingPost?.image) {
      setEditError("A text-only post needs at least some text.");
      return;
    }
    await db.transact([
      db.tx.posts[editingPostId].update({ caption: trimmed, privacy: editPrivacy }),
    ]);
    setEditingPostId(null);
  }

  async function toggleArchive(post: NonNullable<typeof selectedPost>) {
    await db.transact([db.tx.posts[post.id].update({ archived: !post.archived })]);
    setSelectedPostId(null);
  }

  async function deletePost(post: NonNullable<typeof selectedPost>) {
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    const { data: fullData } = await db.queryOnce({
      posts: {
        $: { where: { id: post.id } },
        likes: {},
        comments: {},
        notifications: {},
      },
    });
    const full = fullData.posts?.[0] ?? post;
    const cleanup = [
      ...(full.likes ?? []).map((like) => db.tx.likes[like.id].delete()),
      ...(full.comments ?? []).map((comment) => db.tx.comments[comment.id].delete()),
      ...(full.notifications ?? []).map((n) => db.tx.notifications[n.id].delete()),
      db.tx.posts[post.id].delete(),
    ];
    await db.transact(cleanup);
    setSelectedPostId(null);
  }

  async function handleMessage() {
    if (!currentUser || !targetUserId || !isMutualFollow || messagingBusy) return;
    setMessagingBusy(true);
    try {
      const convId = await openConversation(currentUser.id, targetUserId);
      if (convId) router.push(`/messages?c=${convId}`);
    } catch (err) {
      console.error("Couldn't open conversation:", err);
      alert(err instanceof Error ? err.message : "Couldn't open conversation.");
    } finally {
      setMessagingBusy(false);
    }
  }

  async function handleBlock() {
    if (!currentUser || !targetUserId || blockBusy || isBlocked) return;
    const confirmed = window.confirm(
      `Block @${profile.username}? Their posts won't appear in your feed.`
    );
    if (!confirmed) return;

    setBlockBusy(true);
    try {
      const txs: TransactionChunk<AppSchema, keyof AppSchema["entities"]>[] = [];

      // Re-check fresh so a second click (or stale UI) can never create a
      // duplicate block record for the same pair.
      const freshBlocks = await db.queryOnce({
        blocks: { $: { where: { "blocker.id": currentUser.id } }, blocked: {} },
      });
      const alreadyBlocked = freshBlocks.data.blocks.some(
        (b) => b.blocked?.id === targetUserId
      );
      if (!alreadyBlocked) {
        txs.push(
          db.tx.blocks[id()]
            .update({ createdAt: Date.now() })
            .link({ blocker: currentUser.id, blocked: targetUserId })
        );
      }

      // Blocking unfollows in both directions.
      const followData = await db.queryOnce({
        follows: {
          $: {
            where: {
              or: [{ "follower.id": currentUser.id }, { "follower.id": targetUserId }],
            },
          },
          follower: {},
          following: {},
        },
      });
      for (const follow of followData.data.follows) {
        const a = follow.follower?.id;
        const b = follow.following?.id;
        if (
          (a === currentUser.id && b === targetUserId) ||
          (a === targetUserId && b === currentUser.id)
        ) {
          txs.push(db.tx.follows[follow.id].delete());
        }
      }

      if (txs.length > 0) await db.transact(txs);
    } catch (err) {
      console.error("Couldn't block user:", err);
    } finally {
      setBlockBusy(false);
    }
  }

  async function handleUnblock() {
    if (blockRecords.length === 0 || blockBusy) return;
    setBlockBusy(true);
    try {
      // Delete every matching record, cleaning up any duplicates created
      // before the duplicate-block guard existed.
      await db.transact(blockRecords.map((b) => db.tx.blocks[b.id].delete()));
    } catch (err) {
      console.error("Couldn't unblock user:", err);
    } finally {
      setBlockBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 flex flex-col gap-6">
      <div className="flex items-start gap-5">
        <div className="rounded-full ring-1 ring-border ring-offset-4 ring-offset-ink flex-shrink-0">
          <Avatar url={profile.avatar?.url} name={profile.displayName} size={84} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-lg font-semibold text-text">
                {profile.displayName}
              </h1>
              <p className="text-sm font-mono text-text-faint">@{profile.username}</p>
            </div>

            {isOwner ? (
              <button
                onClick={() => setEditingProfile((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-medium border border-border
                  rounded-lg px-3 py-1.5 text-text hover:bg-surface-2 transition-colors"
              >
                <IconEdit size={15} />
                Edit profile
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {isBlocked ? (
                  <button
                    onClick={handleUnblock}
                    disabled={blockBusy}
                    className="flex items-center gap-1.5 text-sm font-medium border border-border
                      rounded-lg px-3 py-1.5 text-text hover:bg-surface-2 transition-colors
                      disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <IconBan size={15} />
                    {blockBusy ? "Unblocking..." : "Unblock"}
                  </button>
                ) : (
                  <>
                    {targetUserId && (
                      <FollowButton
                        targetUserId={targetUserId}
                        currentUserId={currentUser.id}
                      />
                    )}
                    {isMutualFollow && targetUserId && (
                      <button
                        onClick={handleMessage}
                        disabled={messagingBusy}
                        className="flex items-center gap-1.5 text-sm font-medium border border-border
                          rounded-lg px-3 py-1.5 text-text hover:bg-surface-2 transition-colors
                          disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <IconMessage2 size={15} />
                        Message
                      </button>
                    )}
                    <button
                      onClick={handleBlock}
                      disabled={blockBusy}
                      className="flex items-center gap-1.5 text-sm font-medium border border-border
                        rounded-lg px-3 py-1.5 text-negative hover:bg-negative/10 transition-colors
                        disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <IconBan size={15} />
                      {blockBusy ? "Blocking..." : "Block"}
                    </button>
                    {targetUserId && (
                      <ReportButton
                        type="user"
                        reportedUserId={targetUserId}
                        currentUserId={currentUser.id}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {profile.bio && <p className="text-sm text-text-muted mt-2">{profile.bio}</p>}
          {!isOwner && isBlocked && (
            <p className="text-xs text-text-faint mt-2">You blocked this account.</p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-1">
            {profile.location && (
              <span className="flex items-center gap-1 text-sm text-text-muted">
                <IconMapPin size={14} />
                {profile.location}
              </span>
            )}
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-sm text-accent hover:text-accent-strong transition-colors"
              >
                <IconLink size={14} />
                {profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>

          <div className="flex items-center gap-4 mt-3 text-sm font-mono">
            <span>
              <span className="text-text">{postsCount}</span>{" "}
              <span className="text-text-faint">posts</span>
            </span>
            <Link href={`/profile/${profile.username}/followers`} className="hover:underline">
              <span className="text-text">{profile.user?.followers?.length ?? 0}</span>{" "}
              <span className="text-text-faint">followers</span>
            </Link>
            <Link href={`/profile/${profile.username}/following`} className="hover:underline">
              <span className="text-text">{profile.user?.following?.length ?? 0}</span>{" "}
              <span className="text-text-faint">following</span>
            </Link>
          </div>
        </div>
      </div>

      {editingProfile && (
        <EditProfileForm
          profile={profile}
          userId={currentUser.id}
          onDone={() => setEditingProfile(false)}
        />
      )}

      <SprocketDivider />

      <div className="flex gap-6 -mt-2">
        <button
          onClick={() => { setTab("posts"); setSelectedPostId(null); setPostLimit(POST_PAGE_SIZE); }}
          className={`relative text-sm font-medium pb-2.5 transition-colors ${
            tab === "posts" ? "text-text" : "text-text-faint hover:text-text-muted"
          }`}
        >
          Posts
          <span
            className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent transition-transform duration-200 origin-left ${
              tab === "posts" ? "scale-x-100" : "scale-x-0"
            }`}
          />
        </button>
        {isOwner && (
          <button
            onClick={() => { setTab("archived"); setSelectedPostId(null); setPostLimit(POST_PAGE_SIZE); }}
            className={`relative text-sm font-medium pb-2.5 transition-colors ${
              tab === "archived" ? "text-text" : "text-text-faint hover:text-text-muted"
            }`}
          >
            Archived
            <span
              className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent transition-transform duration-200 origin-left ${
                tab === "archived" ? "scale-x-100" : "scale-x-0"
              }`}
            />
          </button>
        )}
      </div>

      {posts.length === 0 && (
        <p className="text-sm text-text-faint text-center py-10">
          {tab === "archived" ? "No archived posts." : "No posts yet."}
        </p>
      )}

      <div className="grid grid-cols-3 gap-1">
        {posts.map((post) => {
          const postLikeCount = post.likeCount ?? 0;
          const postCommentCount = post.commentCount ?? 0;
          return (
            <button
              key={post.id}
              onClick={() => setSelectedPostId(selectedPostId === post.id ? null : post.id)}
              className={`group relative aspect-square overflow-hidden rounded-md border transition-colors bg-surface ${
                selectedPostId === post.id ? "border-accent" : "border-transparent"
              }`}
            >
              {post.image?.url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.image.url}
                    alt={post.caption || "Post photo"}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                  {post.mediaType === "video" && (
                    <span className="absolute top-1.5 right-1.5 bg-ink/70 rounded-full p-1">
                      <IconPlayerPlayFilled size={12} className="text-text" />
                    </span>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center gap-4 bg-ink/0 opacity-0 transition-all duration-150 group-hover:bg-ink/40 group-hover:opacity-100">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      <IconHeartFilled size={16} />
                      {postLikeCount}
                    </span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      <IconMessageCircleFilled size={16} />
                      {postCommentCount}
                    </span>
                  </span>
                </>
              ) : (
                <span className="flex items-center justify-center h-full px-2 text-xs text-text-muted text-center line-clamp-4">
                  {post.caption}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {posts.length >= postLimit && (
        <button
          onClick={() => setPostLimit((l) => l + POST_PAGE_SIZE)}
          className="self-center text-sm font-medium text-text-muted hover:text-text transition-colors"
        >
          Load more posts
        </button>
      )}

      {selectedPost && (
        <div className="flex flex-col gap-3">
          {isOwner && editingPostId !== selectedPost.id && (
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => startEdit(selectedPost)}
                className="flex items-center gap-1.5 text-xs font-medium border border-border
                  rounded-lg px-2.5 py-1.5 text-text hover:bg-surface-2 transition-colors"
              >
                <IconEdit size={14} /> Edit
              </button>
              <button
                onClick={() => toggleArchive(selectedPost)}
                className="flex items-center gap-1.5 text-xs font-medium border border-border
                  rounded-lg px-2.5 py-1.5 text-text hover:bg-surface-2 transition-colors"
              >
                {selectedPost.archived ? <IconArchiveOff size={14} /> : <IconArchive size={14} />}
                {selectedPost.archived ? "Unarchive" : "Archive"}
              </button>
              <button
                onClick={() => deletePost(selectedPost)}
                className="flex items-center gap-1.5 text-xs font-medium border border-border
                  rounded-lg px-2.5 py-1.5 text-negative hover:bg-negative/10 transition-colors"
              >
                <IconTrash size={14} /> Delete
              </button>
            </div>
          )}

          {editingPostId === selectedPost.id ? (
            <div className="flex flex-col gap-3 border border-border bg-surface rounded-xl p-4">
              <textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                rows={2}
                className="bg-ink border border-border rounded-lg px-3 py-2 text-sm text-text
                  outline-none focus:border-accent transition-colors resize-none"
              />
              <div className="flex gap-2">
                {PRIVACY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setEditPrivacy(option.value)}
                    className={`flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5
                      border transition-colors ${
                        editPrivacy === option.value
                          ? "border-accent bg-accent-soft text-accent-strong"
                          : "border-border text-text-muted"
                      }`}
                  >
                    <option.Icon size={13} />
                    {option.label}
                  </button>
                ))}
              </div>
              {editError && <p className="text-xs text-negative">{editError}</p>}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setEditingPostId(null); setEditError(null); }}
                  className="flex items-center gap-1.5 text-xs font-medium text-text-muted
                    hover:text-text px-2.5 py-1.5 transition-colors"
                >
                  <IconX size={14} /> Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="flex items-center gap-1.5 text-xs font-medium bg-accent
                    hover:bg-accent-strong text-accent-text rounded-lg px-3 py-1.5 transition-colors"
                >
                  <IconCheck size={14} /> Save
                </button>
              </div>
            </div>
          ) : (
            <PostCard post={selectedPost} currentUserId={currentUser.id} />
          )}
        </div>
      )}
    </div>
  );
}
