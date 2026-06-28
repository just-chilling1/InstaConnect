import { i } from "@instantdb/react";

// ---------------------------------------------------------------------------
// Schema for the photo-sharing social app.
// Push this with: npx instant-cli@latest push schema
// ---------------------------------------------------------------------------

const _schema = i.schema({
  entities: {
    // InstantDB's built-in auth entity. We only attach the fields it ships
    // with by default (email) — everything else lives on `profiles`.
    $users: i.entity({
      email: i.string().unique().indexed(),
    }),

    // InstantDB's built-in file storage entity (avatars + post images).
    $files: i.entity({
      path: i.string(),
      url: i.string(),
    }),

    profiles: i.entity({
      username: i.string().unique().indexed(),
      displayName: i.string().indexed(),
      bio: i.string().optional(),
      website: i.string().optional(),
      location: i.string().optional(),
      defaultPrivacy: i.string().optional(), // "public" | "followers" | "private"
      createdAt: i.number().indexed(),
    }),

    posts: i.entity({
      caption: i.string().optional(),
      // "image" | "video" | undefined (text-only post)
      mediaType: i.string().optional(),
      // "public" | "followers" | "private"
      privacy: i.string().indexed(),
      archived: i.boolean().indexed(),
      createdAt: i.number().indexed(),
    }),

    likes: i.entity({
      createdAt: i.number(),
    }),

    comments: i.entity({
      text: i.string(),
      createdAt: i.number().indexed(),
    }),

    follows: i.entity({
      createdAt: i.number(),
      // `${followerId}_${followingId}`, set whenever a follow is created.
      // InstantDB has no native compound-uniqueness constraint, so this is
      // the standard way to express one: a single attribute that *is* the
      // uniqueness key, marked `.unique()` so the database itself rejects a
      // second record with the same pair -- even if two requests for the
      // same follow somehow land at the same instant (two tabs, a retried
      // request, etc). This is what actually closes the duplicate-follow
      // race; the pre-write existence check in FollowButton is only a fast
      // path that avoids hitting that rejection in the common case.
      pairKey: i.string().unique().indexed().optional(),
    }),

    notifications: i.entity({
      // "like" | "comment" | "follow" | "message"
      type: i.string(),
      read: i.boolean().indexed(),
      createdAt: i.number().indexed(),
    }),

    blocks: i.entity({
      createdAt: i.number().indexed(),
    }),

    // -------------------------------------------------------------------------
    // Messaging
    // -------------------------------------------------------------------------

    // One document per pair of users. `pairKey` is the two user IDs sorted
    // alphabetically and joined with "_", giving a guaranteed-unique key for
    // each pair — the same trick `follows` uses to prevent duplicates.
    conversations: i.entity({
      createdAt: i.number().indexed(),
      updatedAt: i.number().indexed(),
      pairKey: i.string().unique().indexed(),
      // Denormalised last-message snapshot so the conversation list can show
      // previews without loading every individual message.
      lastMessageContent: i.string().optional(),
      lastMessageSenderId: i.string().optional(),
      // Whether the recipient (the non-sender of the last message) has read
      // it. Reset to false when a new message is sent; set to true when the
      // recipient opens the conversation.
      lastMessageRead: i.boolean().optional(),
    }),

    messages: i.entity({
      content: i.string(),
      createdAt: i.number().indexed(),
      editedAt: i.number().optional(),
      // Per-message read receipt — used to show "Read" under sent messages.
      isRead: i.boolean().indexed(),
    }),
  },

  links: {
    // One profile per user.
    profileUser: {
      forward: { on: "profiles", has: "one", label: "user" },
      reverse: { on: "$users", has: "one", label: "profile" },
    },
    // One avatar file per profile.
    profileAvatar: {
      forward: { on: "profiles", has: "one", label: "avatar" },
      reverse: { on: "$files", has: "one", label: "avatarOf" },
    },

    // A post belongs to one author (a $user), and has many of these.
    postAuthor: {
      forward: { on: "posts", has: "one", label: "author" },
      reverse: { on: "$users", has: "many", label: "posts" },
    },
    postImage: {
      forward: { on: "posts", has: "one", label: "image" },
      reverse: { on: "$files", has: "one", label: "postImageOf" },
    },

    likePost: {
      forward: { on: "likes", has: "one", label: "post" },
      reverse: { on: "posts", has: "many", label: "likes" },
    },
    likeUser: {
      forward: { on: "likes", has: "one", label: "user" },
      reverse: { on: "$users", has: "many", label: "likes" },
    },

    commentPost: {
      forward: { on: "comments", has: "one", label: "post" },
      reverse: { on: "posts", has: "many", label: "comments" },
    },
    commentAuthor: {
      forward: { on: "comments", has: "one", label: "author" },
      reverse: { on: "$users", has: "many", label: "comments" },
    },

    // follows.follower -> the $user who is doing the following
    // follows.following -> the $user being followed
    followFollower: {
      forward: { on: "follows", has: "one", label: "follower" },
      reverse: { on: "$users", has: "many", label: "following" },
    },
    followFollowing: {
      forward: { on: "follows", has: "one", label: "following" },
      reverse: { on: "$users", has: "many", label: "followers" },
    },

    notificationRecipient: {
      forward: { on: "notifications", has: "one", label: "recipient" },
      reverse: { on: "$users", has: "many", label: "notifications" },
    },
    notificationActor: {
      forward: { on: "notifications", has: "one", label: "actor" },
      reverse: { on: "$users", has: "many", label: "actions" },
    },
    notificationPost: {
      forward: { on: "notifications", has: "one", label: "post" },
      reverse: { on: "posts", has: "many", label: "notifications" },
    },
    // Lets "message" notifications link to the conversation they belong to,
    // so clicking a notification can navigate to /messages?c=<id>.
    notificationConversation: {
      forward: { on: "notifications", has: "one", label: "conversation" },
      reverse: { on: "conversations", has: "many", label: "notifications" },
    },

    // blocks.blocker -> the $user doing the blocking
    // blocks.blocked -> the $user being blocked
    blockBlocker: {
      forward: { on: "blocks", has: "one", label: "blocker" },
      reverse: { on: "$users", has: "many", label: "blocking" },
    },
    blockBlocked: {
      forward: { on: "blocks", has: "one", label: "blocked" },
      reverse: { on: "$users", has: "many", label: "blockedBy" },
    },

    // -------------------------------------------------------------------------
    // Messaging links
    // -------------------------------------------------------------------------

    // Many-to-many: each conversation has exactly two participants ($users),
    // and each $user can participate in many conversations.
    conversationParticipants: {
      forward: { on: "conversations", has: "many", label: "participants" },
      reverse: { on: "$users", has: "many", label: "conversations" },
    },

    // Each message belongs to exactly one conversation.
    messageConversation: {
      forward: { on: "messages", has: "one", label: "conversation" },
      reverse: { on: "conversations", has: "many", label: "messages" },
    },

    // Each message was sent by exactly one $user.
    messageSender: {
      forward: { on: "messages", has: "one", label: "sender" },
      reverse: { on: "$users", has: "many", label: "sentMessages" },
    },
  },
});

export type AppSchema = typeof _schema;
const schema: AppSchema = _schema;

export default schema;
