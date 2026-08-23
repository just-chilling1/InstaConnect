"use client";

import { useState } from "react";
import { id } from "@instantdb/react";
import { IconFlag } from "@tabler/icons-react";
import db from "@/lib/db";

type ReportButtonProps = {
  type: "post" | "comment" | "user";
  postId?: string;
  commentId?: string;
  reportedUserId?: string;
  currentUserId: string;
  className?: string;
};

const REASONS = [
  "Spam",
  "Harassment or bullying",
  "Inappropriate content",
  "Impersonation",
  "Other",
];

export default function ReportButton({
  type,
  postId,
  commentId,
  reportedUserId,
  currentUserId,
  className = "",
}: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(reason: string) {
    if (busy) return;
    setBusy(true);
    try {
      await db.transact([
        db.tx.reports[id()]
          .update({
            type,
            reason,
            status: "pending",
            createdAt: Date.now(),
          })
          .link({
            reporter: currentUserId,
            ...(postId ? { post: postId } : {}),
            ...(commentId ? { comment: commentId } : {}),
            ...(reportedUserId ? { reportedUser: reportedUserId } : {}),
          }),
      ]);
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
      }, 1500);
    } catch (err) {
      console.error("Report failed:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1 text-xs text-text-faint hover:text-negative transition-colors ${className}`}
        aria-label="Report"
      >
        <IconFlag size={14} />
        Report
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          onClick={() => !busy && setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <p className="text-sm text-text text-center py-4">Report submitted. Thank you.</p>
            ) : (
              <>
                <h3 className="font-medium text-text mb-3">Report this {type}</h3>
                <div className="flex flex-col gap-1.5">
                  {REASONS.map((reason) => (
                    <button
                      key={reason}
                      disabled={busy}
                      onClick={() => submit(reason)}
                      className="text-left text-sm px-3 py-2 rounded-lg hover:bg-surface-2 text-text transition-colors disabled:opacity-50"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
