import { init } from "@instantdb/react";
import schema from "../../instant.schema";

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID;

if (!APP_ID) {
  // This only throws in the browser/server at runtime, not at build time,
  // so the app still compiles before you've connected a real InstantDB app.
  console.warn(
    "[instantdb] NEXT_PUBLIC_INSTANT_APP_ID is not set. Run `npx instant-cli@latest init` and restart the dev server."
  );
}

const db = init({
  appId: APP_ID ?? "",
  schema,
});

export default db;
