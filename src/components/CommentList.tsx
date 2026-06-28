"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { id } from "@instantdb/react";
import { IconTrash } from "@tabler/icons-react";
import db from "@/lib/db";
import Avatar from "@/components/Avatar";
import { timeAgo } from "@/lib/format";

type CommentListProps = {
  postId: string;
  postAuthorId: string;
  currentUserId: string;
};

export default function CommentList({ postId, postAuthorId, currentUserId }: CommentListProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { isLoading, data } = db.useQuery({
    comments: {
      $: { where: { "post.id": postId }, order: { createdAt: "asc" } },
      author: { profile: { avatar: {} } },
    },
  });

  const comments = data?.comments ?? [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const commentId = id();
      // The comment is the critical action -- send it on its own so a bad
      // recipient id can never block it. See the same fix in LikeButton.
      await db.transact([
        db.tx.comments[commentId]
          .update({ text: trimmed, createdAt: Date.now() })
          .link({ post: postId, author: currentUserId }),
      ]);
      setText("");

      if (postAuthorId && postAuthorId !== currentUserId) {
        try {
          await db.transact([
            db.tx.notifications[id()]
              .update({ type: "comment", read: false, createdAt: Date.now() })
              .link({ recipient: postAuthorId, actor: currentUserId, post: postId }),
          ]);
        } catch (notifyErr) {
          console.error("Couldn't create comment notification:", notifyErr);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    await db.transact([db.tx.comments[commentId].delete()]);
  }

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-border">
      {!isLoading && comments.length === 0 && (
        <p className="text-sm text-text-faint">No comments yet. Say something nice.</p>
      )}

      {comments.map((comment) => {
        const profile = comment.author?.profile;
        const canDelete =
          comment.author?.id === currentUserId || postAuthorId === currentUserId;
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
            </div>
            {canDelete && (
              <button
                onClick={() => handleDelete(comment.id)}
                className="opacity-0 group-hover:opacity-100 text-text-faint hover:text-negative transition-opacity"
                aria-label="Delete comment"
              >
                <IconTrash size={15} />
              </button>
            )}
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
