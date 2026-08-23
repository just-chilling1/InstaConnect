# InstaConnect

A photo-sharing social app built with Next.js (App Router) and InstantDB.

Sign up, set up a profile, post photos with a privacy setting, like and comment,
follow people, get notified, and manage your account — all backed by InstantDB's
realtime queries, storage, auth, and permission rules instead of a custom API.

## 1. Prerequisites

- Node.js 18.18+
- An [InstantDB](https://instantdb.com) account (free) — this is where your data,
  auth, and file storage actually live.

## 2. Connect InstantDB

This repo ships with `instant.schema.ts` and `instant.perms.ts` already written,
but it isn't connected to a real InstantDB app yet. From the project root:

```bash
npm install
npx instant-cli@latest init
```

This opens a browser to log in / create an account, lets you create (or pick) an
app, and writes its App ID into `.env.local` as `NEXT_PUBLIC_INSTANT_APP_ID`. It
may offer to generate schema/perms files — if it does, say no (or let it overwrite,
then `git checkout` the ones in this repo), since they're already written for you.

Then push the schema and permission rules that are already in this repo up to your
app:

```bash
npx instant-cli@latest push schema
npx instant-cli@latest push perms
```

The CLI will type-check the permission rules against your schema and tell you if
anything in `instant.perms.ts` needs adjusting — treat any errors it reports as the
source of truth over the comments in that file.

## 3. Run it

```bash
npm run dev
```

Visit `http://localhost:3000`. Signing up sends a 6-digit code to the email you
enter (via InstantDB's built-in magic-code auth — there's no password to set).

## 4. (Optional) Google sign-in

The login/signup screen will show a "Continue with Google" button once you:

1. Set up a Google OAuth client and connect it to your app in the
   [InstantDB dashboard](https://instantdb.com/dash) under **Auth**, giving it a
   client name (e.g. `google`).
2. Set `NEXT_PUBLIC_GOOGLE_CLIENT_NAME` in `.env.local` to that same client name.

Until then, the button stays hidden and email magic-code sign-in works on its own.

## Project structure

```
instant.schema.ts          All entities and links (the data model)
instant.perms.ts           Permission rules (who can read/write what)
src/lib/db.ts               InstantDB client, initialized with the schema
src/lib/useProfile.ts       Combines auth state + the current user's profile
src/app/
  (auth)/login, (auth)/signup    Magic-code + optional Google sign-in
  onboarding/                     First-time profile setup (avatar, bio, username)
  (main)/feed/                    Home feed
  (main)/create/                  Upload + share a photo post
  (main)/post/[id]/               Direct link to a single post
  (main)/explore/                 Suggested users + popular posts
  (main)/search/                  Search people and post captions
  (main)/saved/                   Bookmarked posts
  (main)/profile/[username]/      Posts grid, edit/archive/delete (owner only)
  (main)/notifications/           Activity feed
  (main)/messages/                1:1 DMs (mutual followers)
  (main)/settings/                Privacy defaults, blocking, delete account
  api/conversations/create        Server-side mutual-follow validation (optional)
  api/account/delete              Server-side account deletion (optional)
src/components/              Reusable UI: PostCard, LikeButton, CommentList,
                              FollowButton, Avatar, Navbar, UploadDropzone, etc.
```

## Design

One dark, "darkroom contact-sheet" theme (no light/dark toggle) — see the CSS
variables at the top of `src/app/globals.css` if you want to retheme it. Fonts are
pulled via `next/font/google` in `src/app/layout.tsx` (Space Grotesk for display
text, Inter for body text, IBM Plex Mono for metadata like timestamps and counts).

## Known limitations / good next steps

- **Push schema & perms after pulling**: this repo adds `bookmarks`, `reports`, denormalised
  `likeCount`/`commentCount` on posts, notification-mute fields on profiles, and stricter
  block rules. Run `npx instant-cli@latest push schema` and `push perms` after updating.
- **Admin API (optional)**: set `INSTANT_APP_ADMIN_TOKEN` in `.env.local` to enable
  server-validated conversation creation and faster account deletion via `/api/*` routes.
  Without it, those features fall back to client-side logic.
- **Sessions & 2FA**: InstantDB auth is passwordless (magic code or OAuth), so
  there's no password to change. The client SDK doesn't currently expose a way to
  list/revoke individual sessions from the app itself — `db.auth.signOut()` ends
  the current one.
- **Pagination** on the feed uses infinite scroll with a growing `limit`. Cursor-based
  pagination is a future upgrade for very large datasets.
- **Hashtags, @mentions, private accounts, media in DMs, and group chats** are not
  implemented yet — the schema and UI are focused on core photo-sharing + messaging.
- Avatars and post photos use `next/image` when served from InstantDB storage domains
  configured in `next.config.ts` `images.remotePatterns`.
