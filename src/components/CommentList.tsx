"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { id } from "@instantdb/react";
import { IconTrash, IconEdit, IconCheck, IconX } from "@tabler/icons-react";
import db from "@/lib/db";
import Avatar from "@/components/Avatar";
import ReportButton from "@/components/ReportButton";
import { createOrBumpNotification } from "@/lib/notifications";
import { timeAgo } from "@/lib/format";

type CommentListProps = {
  postId: string;
  postAuthorId: string;
  currentUserId: string;
};

export default function CommentList({ postId, postAuthorId, currentUserId }: CommentListProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const { isLoading, data } = db.useQuery({
    comments: {
      $: { where: { "post.id": postId }, order: { createdAt: "asc" } },
      author: { profile: { avatar: {} } },
    },
    posts: {
      $: { where: { id: postId } },
    },
  });

  const comments = data?.comments ?? [];
  const commentCount = data?.posts?.[0]?.commentCount ?? comments.length;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const commentId = id();
      await db.transact([
        db.tx.comments[commentId]
          .update({ text: trimmed, createdAt: Date.now() })
          .link({ post: postId, author: currentUserId }),
        db.tx.posts[postId].update({ commentCount: commentCount + 1 }),
      ]);
      setText("");

      if (postAuthorId && postAuthorId !== currentUserId) {
        const recipient = await db.queryOnce({
          profiles: { $: { where: { "user.id": postAuthorId } } },
        });
        await createOrBumpNotification({
          type: "comment",
          recipientId: postAuthorId,
          actorId: currentUserId,
          postId,
          recipientProfile: recipient.data?.profiles?.[0] ?? null,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    await db.transact([
      db.tx.comments[commentId].delete(),
      db.tx.posts[postId].update({ commentCount: Math.max(0, commentCount - 1) }),
    ]);
  }

  async function saveEdit(commentId: string) {
    const trimmed = editText.trim();
    if (!trimmed) return;
    await db.transact([db.tx.comments[commentId].update({ text: trimmed })]);
    setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-border">
      {!isLoading && comments.length === 0 && (
        <p className="text-sm text-text-faint">No comments yet. Say something nice.</p>
      )}

      {comments.map((comment) => {
        const profile = comment.author?.profile;
        const isOwner = comment.author?.id === currentUserId;
        const canDelete = isOwner || postAuthorId === currentUserId;
        const isEditing = editingId === comment.id;

        return (
          <div key={comment.id} className="flex items-start gap-2.5 group">
            {profile?.username ? (
              <Link href={`/profile/${profile.username}`}>
                <Avatar url={profile.avatar?.url} name={profile.displayName ?? "?"} size={28} />
              </Link>
            ) : (
              <Avatar url={null} name="?" size={28} />
            )}
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="bg-ink border border-border rounded-lg px-2 py-1 text-sm text-text outline-none focus:border-accent"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(comment.id)}
                      className="text-xs text-accent flex items-center gap-1"
                    >
                      <IconCheck size={14} /> Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-text-muted flex items-center gap-1"
                    >
                      <IconX size={14} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm leading-snug">
                    {profile?.username ? (
                      <Link
                        href={`/profile/${profile.username}`}
                        className="font-medium text-text mr-1.5 hover:underline"
                      >
                        {profile.username}
                      </Link>
                    ) : (
                      <span className="font-medium text-text-faint mr-1.5">Unknown user</span>
                    )}
                    <span className="text-text-muted">{comment.text}</span>
                  </p>
                  <span className="text-xs font-mono text-text-faint">
                    {timeAgo(comment.createdAt)}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {isOwner && !isEditing && (
                <button
                  onClick={() => {
                    setEditingId(comment.id);
                    setEditText(comment.text);
                  }}
                  className="text-text-faint hover:text-text"
                  aria-label="Edit comment"
                >
                  <IconEdit size={15} />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="text-text-faint hover:text-negative"
                  aria-label="Delete comment"
                >
                  <IconTrash size={15} />
                </button>
              )}
              {!isOwner && (
                <ReportButton
                  type="comment"
                  commentId={comment.id}
                  postId={postId}
                  currentUserId={currentUserId}
                />
              )}
            </div>
          </div>
        );
      })}

      <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder:text-text-faint outline-none focus:border-accent transition-colors"
        />
        <button
          type="submit"
          disabled={!text.trim() || submitting}
          className="text-sm font-medium text-accent disabled:text-text-faint transition-colors"
        >
          Post
        </button>
      </form>
    </div>
  );
}
