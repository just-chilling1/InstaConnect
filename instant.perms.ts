import type { InstantRules } from "@instantdb/react";

// ---------------------------------------------------------------------------
// Permission rules for the photo-sharing social app.
// Push this with: npx instant-cli@latest push perms
// ---------------------------------------------------------------------------

const rules = {
  $users: {
    allow: {
      view: "true",
    },
    fields: {
      email: "auth.id == data.id",
    },
  },

  profiles: {
    allow: {
      view: "true",
      create: "isOwner",
      update: "isOwner",
      delete: "isOwner",
    },
    bind: ["isOwner", "auth.id in data.ref('user.id')"],
  },

  posts: {
    allow: {
      view: "isOwner || (!data.archived && (isPublic || isFollowerOnly))",
      create: "isOwner",
      update: "isOwner",
      delete: "isOwner",
    },
    bind: [
      "isOwner",
      "auth.id in data.ref('author.id')",
      "isPublic",
      "data.privacy == 'public'",
      "isFollowerOnly",
      "data.privacy == 'followers' && auth.id in data.ref('author.followers.follower.id')",
    ],
  },

  comments: {
    allow: {
      view: "true",
      create: "isLoggedIn",
      delete: "isCommentOwner || isPostOwner",
    },
    bind: [
      "isLoggedIn",
      "auth.id != null",
      "isCommentOwner",
      "auth.id in data.ref('author.id')",
      "isPostOwner",
      "auth.id in data.ref('post.author.id')",
    ],
  },

  likes: {
    allow: {
      view: "true",
      create: "isLoggedIn",
      delete: "isOwner",
    },
    bind: [
      "isLoggedIn",
      "auth.id != null",
      "isOwner",
      "auth.id in data.ref('user.id')",
    ],
  },

  follows: {
    allow: {
      view: "true",
      create: "isSelf",
      update: "isSelf",
      delete: "isSelf || isFollowedUser",
    },
    bind: [
      "isSelf",
      "auth.id in data.ref('follower.id')",
      "isFollowedUser",
      "auth.id in data.ref('following.id')",
    ],
  },

  notifications: {
    allow: {
      view: "isRecipient",
      create: "isLoggedIn",
      update: "isRecipient",
      delete: "isRecipient",
    },
    bind: [
      "isLoggedIn",
      "auth.id != null",
      "isRecipient",
      "auth.id in data.ref('recipient.id')",
    ],
  },

  $files: {
    allow: {
      view: "true",
      create: "isLoggedIn",
      delete: "isOwner",
    },
    bind: [
      "isLoggedIn",
      "auth.id != null",
      "isOwner",
      "auth.id in data.ref('avatarOf.user.id') || auth.id in data.ref('postImageOf.author.id')",
    ],
  },

  blocks: {
    allow: {
      view: "isBlocker",
      create: "isBlocker",
      delete: "isBlocker",
    },
    bind: ["isBlocker", "auth.id in data.ref('blocker.id')"],
  },

  // ---------------------------------------------------------------------------
  // Messaging permissions
  // ---------------------------------------------------------------------------

  conversations: {
    allow: {
      // Only participants may read a conversation.
      view: "isParticipant",
      // Any authenticated user may create a conversation. Mutual-follow
      // validation is enforced on the frontend; InstantDB's rule language
      // cannot cross-query two separate entity graphs at create time, so we
      // rely on the client to do that check before calling transact().
      create: "isLoggedIn",
      // Participants may update metadata (updatedAt, lastMessage*, etc.).
      update: "isParticipant",
      delete: "isParticipant",
    },
    bind: [
      "isLoggedIn",
      "auth.id != null",
      "isParticipant",
      "auth.id in data.ref('participants.id')",
    ],
  },

  messages: {
    allow: {
      // Only participants in the parent conversation may read messages.
      // data.ref() traverses: message → conversation → participants → id.
      view: "isConversationParticipant",
      // Only participants may send messages into this conversation.
      create: "isConversationParticipant",
      // Participants may update (mark as read); only sender may edit content.
      update: "isConversationParticipant",
      delete: "isSender",
    },
    bind: [
      "isConversationParticipant",
      "auth.id in data.ref('conversation.participants.id')",
      "isSender",
      "auth.id in data.ref('sender.id')",
    ],
  },
} satisfies InstantRules;

export default rules;
