"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { id } from "@instantdb/react";
import {
  IconArrowLeft,
  IconMessageCircle,
  IconSend,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import db from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import Avatar from "@/components/Avatar";
import FullScreenLoader from "@/components/FullScreenLoader";
import { timeAgo } from "@/lib/format";

// ---------------------------------------------------------------------------
// Entry point — Suspense boundary required because MessagesContent reads
// searchParams via useSearchParams(), which opts the subtree into dynamic
// rendering and must be wrapped in a Suspense boundary in Next.js 13+.
// ---------------------------------------------------------------------------
export default function MessagesPage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <MessagesContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a stable, order-independent key for a pair of user IDs. */
function makePairKey(a: string, b: string) {
  return [a, b].sort().join("_");
}

// Number of messages to load initially (and to add each time "load earlier" is clicked).
const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
function MessagesContent() {
  const { user } = useProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeConversationId = searchParams.get("c");

  // ── UI state ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  // How many messages to load for the active conversation.
  // We query newest-first (desc) and reverse for display so "load earlier"
  // simply raises this ceiling without re-ordering on the client.
  const [messageLimit, setMessageLimit] = useState(PAGE_SIZE);

  // DOM refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevMsgCountRef = useRef(0);

  // ── Conversations list query ────────────────────────────────────────────
  const { data: convData, isLoading: convLoading } = db.useQuery(
    user
      ? {
          conversations: {
            $: {
              where: { "participants.id": user.id },
              order: { updatedAt: "desc" },
            },
            participants: { profile: { avatar: {} } },
          },
        }
      : null
  );

  // ── Messages for the active conversation ────────────────────────────────
  // We query newest-first so `limit` always gives us the most recent N.
  // The array is reversed below for chronological display.
  const { data: msgData, isLoading: msgLoading } = db.useQuery(
    activeConversationId
      ? {
          messages: {
            $: {
              where: { "conversation.id": activeConversationId },
              order: { createdAt: "desc" },
              limit: messageLimit,
            },
            sender: { profile: { avatar: {} } },
          },
        }
      : null
  );

  // ── Derived data ────────────────────────────────────────────────────────
  const allConversations = useMemo(
    () => convData?.conversations ?? [],
    [convData]
  );

  // Chronological order (oldest → newest) for display.
  const messages = useMemo(
    () => (msgData?.messages ?? []).slice().reverse(),
    [msgData?.messages]
  );

  const hasMoreMessages = (msgData?.messages?.length ?? 0) >= messageLimit;

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return allConversations;
    const q = searchQuery.toLowerCase();
    return allConversations.filter((conv) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const other = conv.participants?.find((p: any) => p.id !== user?.id) as any;
      return (
        other?.profile?.username?.toLowerCase().includes(q) ||
        other?.profile?.displayName?.toLowerCase().includes(q)
      );
    });
  }, [allConversations, searchQuery, user?.id]);

  const activeConversation = useMemo(
    () => allConversations.find((c) => c.id === activeConversationId) ?? null,
    [allConversations, activeConversationId]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const otherParticipant = useMemo<any>(
    () => activeConversation?.participants?.find((p: any) => p.id !== user?.id),
    [activeConversation, user?.id]
  );

  // ── Mark messages as read when the conversation is open ─────────────────
  useEffect(() => {
    if (!user || !activeConversationId || messages.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unreadMessages = messages.filter(
      (m: any) => !m.isRead && m.sender?.id !== user.id
    ) as any[];

    const ops = unreadMessages.map((m) =>
      db.tx.messages[m.id].update({ isRead: true })
    ) as any[];

    // Also flip the conversation-level "unread" flag so the sidebar badge
    // clears immediately without waiting for a full refetch.
    const conv = activeConversation as any;
    if (
      conv &&
      conv.lastMessageSenderId &&
      conv.lastMessageSenderId !== user.id &&
      conv.lastMessageRead === false
    ) {
      ops.push(
        db.tx.conversations[activeConversationId].update({
          lastMessageRead: true,
        })
      );
    }

    if (ops.length > 0) {
      db.transact(ops).catch(console.error);
    }
  // `activeConversation` reference changes on every render — key on its id
  // and the lastMessageRead flag to avoid an infinite loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, user?.id, activeConversationId]);

  // ── Scroll helpers ───────────────────────────────────────────────────────
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Reset limit and scroll to bottom when switching conversations.
  useEffect(() => {
    if (!activeConversationId) return;
    setMessageLimit(PAGE_SIZE);
    prevMsgCountRef.current = 0;
    // Small delay lets the messages render before we scroll.
    const t = setTimeout(() => scrollToBottom("instant"), 80);
    return () => clearTimeout(t);
  }, [activeConversationId, scrollToBottom]);

  // Auto-scroll on new messages, but NOT when loading earlier messages
  // (a bulk increase in count from clicking "Load earlier").
  useEffect(() => {
    const newCount = messages.length;
    const prev = prevMsgCountRef.current;
    const delta = newCount - prev;

    if (prev === 0 && newCount > 0) {
      // First load for this conversation.
      scrollToBottom("instant");
    } else if (delta > 0 && delta <= 3) {
      // 1–3 new messages arrived via realtime — scroll only if already
      // near the bottom.
      const el = messagesContainerRef.current;
      const nearBottom = el
        ? el.scrollHeight - el.scrollTop - el.clientHeight < 180
        : true;
      if (nearBottom) scrollToBottom();
    }
    // delta > 3 means the user clicked "Load earlier" — don't scroll.

    prevMsgCountRef.current = newCount;
  }, [messages.length, scrollToBottom]);

  // ── Send message ─────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!user || !activeConversationId || !messageText.trim() || sending) return;
    const content = messageText.trim();

    // Optimistic reset.
    setMessageText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setSending(true);
    setTimeout(() => scrollToBottom(), 0);

    try {
      const now = Date.now();
      const msgId = id();

      await db.transact([
        db.tx.messages[msgId]
          .update({ content, createdAt: now, isRead: false })
          .link({ conversation: activeConversationId, sender: user.id }),
        db.tx.conversations[activeConversationId].update({
          updatedAt: now,
          lastMessageContent: content,
          lastMessageSenderId: user.id,
          lastMessageRead: false, // recipient hasn't seen it yet
        }),
      ]);

      // Create / bump a notification for the other participant.
      const otherId = otherParticipant?.id as string | undefined;
      if (otherId && otherId !== user.id) {
        try {
          // Avoid notification spam: if an unread "message" notification for
          // this conversation already exists, just bump its timestamp.
          const existing = await db.queryOnce({
            notifications: {
              $: {
                where: {
                  type: "message",
                  read: false,
                  "recipient.id": otherId,
                  "actor.id": user.id,
                  "conversation.id": activeConversationId,
                },
              },
            },
          });
          if ((existing.data?.notifications?.length ?? 0) > 0) {
            await db.transact([
              db.tx.notifications[existing.data.notifications[0].id].update({
                createdAt: now,
                read: false,
              }),
            ]);
          } else {
            const notifId = id();
            await db.transact([
              db.tx.notifications[notifId]
                .update({ type: "message", read: false, createdAt: now })
                .link({
                  recipient: otherId,
                  actor: user.id,
                  conversation: activeConversationId,
                }),
            ]);
          }
        } catch (err) {
          // Notification creation is non-critical — don't block the send UX.
          console.error("Notification error:", err);
        }
      }
    } catch (err) {
      console.error("Send error:", err);
      // Restore the draft on failure.
      setMessageText(content);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setMessageText(e.target.value);
    // Auto-grow up to ~5 lines.
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }

  // ── Navigation ───────────────────────────────────────────────────────────
  function openConversation(convId: string) {
    router.push(`/messages?c=${convId}`);
  }

  function closeChat() {
    router.push("/messages");
  }

  const showChat = Boolean(activeConversationId);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    // Fill the viewport: on mobile subtract the sticky mobile-nav height
    // (h-14 = 3.5rem); on desktop use the full screen height. The -mx-4
    // counteracts the md:px-4 padding the main layout applies on desktop
    // so the two-column panel can sit flush against the sidebar edge.
    <div className="flex overflow-hidden h-[calc(100vh-3.5rem)] md:h-screen md:-mx-4">

      {/* ── Conversation list ───────────────────────────────────────────── */}
      <div
        className={`flex flex-col border-r border-border bg-surface flex-shrink-0
          w-full md:w-80 lg:w-96
          ${showChat ? "hidden md:flex" : "flex"}`}
      >
        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-border flex-shrink-0">
          <h1 className="font-display text-xl font-semibold mb-3">Messages</h1>
          {/* Search */}
          <div className="flex items-center gap-2 bg-ink border border-border rounded-lg px-3 py-2 focus-within:border-accent transition-colors">
            <IconSearch size={15} className="text-text-faint flex-shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations"
              className="flex-1 min-w-0 bg-transparent text-sm text-text placeholder:text-text-faint outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-text-faint hover:text-text transition-colors"
                aria-label="Clear search"
              >
                <IconX size={14} />
              </button>
            )}
          </div>
        </div>

        {/* List body */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading skeletons */}
          {convLoading && (
            <div className="flex flex-col">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border/40"
                >
                  <div className="w-12 h-12 rounded-full bg-surface-2 animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-3.5 bg-surface-2 rounded animate-pulse w-24" />
                    <div className="h-3 bg-surface-2 rounded animate-pulse w-40" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!convLoading && filteredConversations.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
              <IconMessageCircle size={30} className="text-text-faint" />
              <p className="text-sm text-text-muted">
                {searchQuery
                  ? "No conversations match your search."
                  : "No conversations yet. Visit someone's profile to start one."}
              </p>
            </div>
          )}

          {/* Conversation rows */}
          {!convLoading &&
            filteredConversations.map((conv) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const other = conv.participants?.find((p: any) => p.id !== user?.id) as any;
              const profile = other?.profile;
              const isActive = conv.id === activeConversationId;
              const lastContent = conv.lastMessageContent as string | undefined;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const convAny = conv as any;
              const isUnread =
                Boolean(convAny.lastMessageSenderId) &&
                convAny.lastMessageSenderId !== user?.id &&
                convAny.lastMessageRead === false;

              return (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv.id)}
                  className={`flex items-center gap-3 px-4 py-3 w-full text-left transition-colors
                    border-b border-border/40
                    ${isActive ? "bg-accent-soft" : "hover:bg-surface-2"}`}
                >
                  <Avatar
                    url={profile?.avatar?.url}
                    name={profile?.displayName ?? "?"}
                    size={48}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5 gap-2">
                      <p className="text-sm font-medium text-text truncate">
                        {profile?.displayName ?? "Unknown"}
                      </p>
                      <span className="text-[11px] font-mono text-text-faint flex-shrink-0">
                        {convAny.updatedAt ? timeAgo(convAny.updatedAt) : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <p
                        className={`text-xs truncate flex-1 min-w-0 ${
                          isUnread ? "text-text font-medium" : "text-text-muted"
                        }`}
                      >
                        {convAny.lastMessageSenderId === user?.id ? "You: " : ""}
                        {lastContent ?? "No messages yet"}
                      </p>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* ── Chat pane ───────────────────────────────────────────────────── */}
      {showChat ? (
        <div className="flex flex-col flex-1 min-w-0 bg-surface">
          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface flex-shrink-0">
            {/* Back button — mobile only */}
            <button
              onClick={closeChat}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg
                text-text-muted hover:bg-surface-2 transition-colors flex-shrink-0"
              aria-label="Back to conversations"
            >
              <IconArrowLeft size={18} />
            </button>

            {otherParticipant ? (
              <Link
                href={`/profile/${otherParticipant.profile?.username ?? ""}`}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0"
              >
                <Avatar
                  url={otherParticipant.profile?.avatar?.url}
                  name={otherParticipant.profile?.displayName ?? "?"}
                  size={36}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text truncate">
                    {otherParticipant.profile?.displayName ?? "Unknown"}
                  </p>
                  <p className="text-xs font-mono text-text-faint truncate">
                    @{otherParticipant.profile?.username ?? ""}
                  </p>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-surface-2 animate-pulse" />
                <div className="h-3 bg-surface-2 rounded animate-pulse w-24" />
              </div>
            )}
          </div>

          {/* Message history */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-4 py-4"
          >
            {/* Load earlier button */}
            {hasMoreMessages && !msgLoading && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={() => setMessageLimit((prev) => prev + PAGE_SIZE)}
                  className="text-xs font-medium text-text-muted hover:text-text
                    border border-border rounded-full px-4 py-1.5 transition-colors"
                >
                  Load earlier messages
                </button>
              </div>
            )}

            {/* Message skeletons */}
            {msgLoading && (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`h-9 rounded-2xl bg-surface-2 animate-pulse ${
                        i % 2 === 0 ? "w-52" : "w-36"
                      }`}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!msgLoading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2 py-12">
                <p className="text-sm text-text-faint">
                  No messages yet — say hello! 👋
                </p>
              </div>
            )}

            {/* Message bubbles */}
            {!msgLoading && (
              <div className="flex flex-col gap-1">
                {messages.map((message, idx) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const msg = message as any;
                  const isMine = msg.sender?.id === user?.id;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const prevMsg = messages[idx - 1] as any;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const nextMsg = messages[idx + 1] as any;
                  const isFirstInGroup =
                    !prevMsg || prevMsg.sender?.id !== msg.sender?.id;
                  const isLastInGroup =
                    !nextMsg || nextMsg.sender?.id !== msg.sender?.id;

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${
                        isMine ? "justify-end" : "justify-start"
                      } ${isFirstInGroup ? "mt-3" : "mt-0.5"}`}
                    >
                      {/* Other person's avatar — shown only on the last bubble of a group */}
                      {!isMine && (
                        <div className="w-7 flex-shrink-0 self-end mb-1">
                          {isLastInGroup && (
                            <Avatar
                              url={msg.sender?.profile?.avatar?.url}
                              name={msg.sender?.profile?.displayName ?? "?"}
                              size={28}
                            />
                          )}
                        </div>
                      )}

                      <div
                        className={`flex flex-col max-w-[75%] ${
                          isMine ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words
                            ${isMine
                              ? `bg-accent text-accent-text
                                 ${isFirstInGroup ? "rounded-t-2xl" : "rounded-t-lg"}
                                 ${isLastInGroup ? "rounded-bl-2xl rounded-br-sm" : "rounded-b-lg"}`
                              : `bg-surface-2 border border-border text-text
                                 ${isFirstInGroup ? "rounded-t-2xl" : "rounded-t-lg"}
                                 ${isLastInGroup ? "rounded-br-2xl rounded-bl-sm" : "rounded-b-lg"}`
                            }`}
                        >
                          {msg.content}
                        </div>

                        {/* Timestamp + read receipt on last bubble of a group */}
                        {isLastInGroup && (
                          <span className="text-[10px] font-mono text-text-faint px-1 mt-1">
                            {timeAgo(msg.createdAt)}
                            {isMine && msg.isRead && (
                              <span className="ml-1 text-accent-strong">· Read</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <div className="flex items-end gap-3 px-4 py-3 border-t border-border bg-surface flex-shrink-0">
            <div
              className="flex-1 min-w-0 bg-ink border border-border rounded-2xl
                px-4 py-2.5 focus-within:border-accent transition-colors"
            >
              <textarea
                ref={textareaRef}
                value={messageText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Message…"
                rows={1}
                className="w-full bg-transparent text-sm text-text placeholder:text-text-faint
                  outline-none resize-none overflow-hidden leading-relaxed"
                style={{ minHeight: "1.25rem" }}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!messageText.trim() || sending}
              aria-label="Send message"
              className="flex items-center justify-center w-9 h-9 rounded-full
                bg-accent text-accent-text flex-shrink-0 transition-all
                hover:bg-accent-strong disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IconSend size={15} />
            </button>
          </div>
        </div>
      ) : (
        /* Desktop empty state when no conversation is selected */
        <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center">
            <IconMessageCircle size={28} className="text-text-faint" />
          </div>
          <div>
            <p className="font-medium text-text">Your messages</p>
            <p className="text-sm text-text-muted mt-1">
              Select a conversation to start chatting.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
