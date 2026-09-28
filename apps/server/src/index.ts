import { createApp } from "./app";
import { DECK } from "./deck";
import { createSessionStore } from "./store";

const port = Number(process.env.PORT ?? 3001);
const store = createSessionStore(process.env.SESSIONS_FILE ?? ".data/sessions.json");

createApp({ deck: DECK, store }).listen(port, () => {
  console.log(`AR Flashcards API on http://localhost:${port}`);
});
