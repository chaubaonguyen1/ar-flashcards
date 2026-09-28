# AR Flashcards

Point your phone at a printed card: a 3D object appears on it. Pick the right
English word, hear it pronounced, and collect all six cards for points and badges.
A WebAR vocabulary game for young learners that runs in the mobile browser, with no app to install.

| Card | 3D object | Word |
|---|---|---|
| 1 | 🍎 | Apple |
| 2 | 🌲 | Tree |
| 3 | 🏠 | House |
| 4 | 🚗 | Car |
| 5 | 🐟 | Fish |
| 6 | ☀️ | Sun |

## How it works

1. **Scan**: AR.js (ARToolKit) finds the card's black-bordered marker in the
   camera feed and estimates its 3D pose every frame.
2. **See**: Three.js renders the card's low-poly model on top of that pose.
3. **Answer**: "What is this?" with 3 choices. Faster answers and streaks
   earn more points.
4. **Learn**: the word, phonetics, Vietnamese meaning and an example sentence
   are revealed and read aloud (Web Speech API).

## Stack

| Layer | Tech |
|---|---|
| Web | TypeScript, Vite, Three.js, AR.js 3.4 (ARToolKit), Web Speech API |
| API | Node.js, Express 5, TypeScript, Zod |
| Shared | Card/API types, Zod schemas, scoring and badge rules |
| Tooling | Python + Pillow marker generator, Vitest, Supertest |

```
packages/shared   types, schemas, scoring + badges (unit tested)
apps/server       REST API: deck, sessions, answers, leaderboard
apps/web          AR scanner, 3D models, quiz UI, printable cards page
tools/            make_markers.py: .patt markers, printable cards, demo photos
```

## Run it

```bash
npm install
npm run dev:server   # API on http://localhost:3001
npm run dev:web      # https://localhost:5173 (self-signed cert: accept the warning)
```

- **Laptop, no camera:** open `https://localhost:5173`, type a name, click
  *Card 1…6* under "Try a demo card". This runs the real marker detection on a
  photo of the card.
- **Phone:** same Wi-Fi, open the *Network* URL Vite prints, allow the camera,
  and scan cards from `https://<ip>:5173/cards.html` (printed or on another screen).

```bash
npm test             # 16 tests: scoring, badges, API rules
npm run typecheck
npm run build
npm run markers      # regenerate markers after editing tools/make_markers.py
```

## Notes

- **Custom markers.** `tools/make_markers.py` encodes each card into ARToolKit's
  `.patt` format (16×16 samples × 4 rotations × BGR), mirroring AR.js's marker
  generator; `--check` validates the encoder against AR.js's official Hiro
  pattern. Each card has a corner dot so no pattern is rotationally symmetric.
- **Server-side scoring.** Points and badges are computed by the API, so the
  leaderboard cannot be filled by posting a made-up score.
- **Lazy AR engine.** The ARToolKit WASM bundle (~740 KB gzip) loads only when
  scanning starts; the start screen is ~15 KB of JS.
- AR.js pins an older three.js; `overrides` + Vite `resolve.dedupe` keep one copy
  (two copies break rendering). `rollup` uses `@rollup/wasm-node` because some
  antivirus setups quarantine its native Windows binary.
