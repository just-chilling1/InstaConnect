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
      create: "isLoggedIn && !isBlockedWithPostAuthor",
      update: "isCommentOwner",
      delete: "isCommentOwner || isPostOwner",
    },
    bind: [
      "isLoggedIn",
      "auth.id != null",
      "isCommentOwner",
      "auth.id in data.ref('author.id')",
      "isPostOwner",
      "auth.id in data.ref('post.author.id')",
      "isBlockedWithPostAuthor",
      "auth.id in data.ref('post.author.blockedBy.blocker.id') || auth.id in data.ref('post.author.blocking.blocked.id')",
    ],
  },

  likes: {
    allow: {
      view: "true",
      create: "isLoggedIn && !isBlockedWithPostAuthor",
      delete: "isOwner",
    },
    bind: [
      "isLoggedIn",
      "auth.id != null",
      "isOwner",
      "auth.id in data.ref('user.id')",
      "isBlockedWithPostAuthor",
      "auth.id in data.ref('post.author.blockedBy.blocker.id') || auth.id in data.ref('post.author.blocking.blocked.id')",
    ],
  },

  follows: {
    allow: {
      view: "true",
      create: "isSelf && !isBlockedEitherWay",
      update: "isSelf",
      delete: "isSelf || isFollowedUser",
    },
    bind: [
      "isSelf",
      "auth.id in data.ref('follower.id')",
      "isFollowedUser",
      "auth.id in data.ref('following.id')",
      "isBlockedEitherWay",
      "auth.id in data.ref('following.blockedBy.blocker.id') || auth.id in data.ref('following.blocking.blocked.id')",
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

  bookmarks: {
    allow: {
      view: "isOwner",
      create: "isOwner",
      delete: "isOwner",
    },
    bind: ["isOwner", "auth.id in data.ref('user.id')"],
  },

  reports: {
    allow: {
      view: "isReporter",
      create: "isReporter",
      update: "false",
      delete: "false",
    },
    bind: ["isReporter", "auth.id in data.ref('reporter.id')"],
  },

  // ---------------------------------------------------------------------------
  // Messaging permissions
  // ---------------------------------------------------------------------------

  conversations: {
    allow: {
      view: "isParticipant",
      create: "isLoggedIn",
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
      view: "isConversationParticipant",
      create: "isConversationParticipant && !isBlockedWithOtherParticipant",
      update: "isConversationParticipant",
      delete: "isSender",
    },
    bind: [
      "isConversationParticipant",
      "auth.id in data.ref('conversation.participants.id')",
      "isSender",
      "auth.id in data.ref('sender.id')",
      "isBlockedWithOtherParticipant",
      "auth.id in data.ref('conversation.participants.blockedBy.blocker.id') || auth.id in data.ref('conversation.participants.blocking.blocked.id')",
    ],
  },
} satisfies InstantRules;

export default rules;
