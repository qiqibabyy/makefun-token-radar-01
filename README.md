# qiqibabyy/makefun-token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/qiqibabyy/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/qiqibabyy/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Signal Atlas — a token launch radar built from the sealed DefiLlama snapshot. It ranks 172 pre-token protocols with a value model derived from snapshot figures (TVL, 7-day change, time listed without a token), covers all 40 watchlist protocols, attaches a concrete farm plan to every row, and renders a sortable, filterable offline dashboard with a per-protocol detail view. Tokenized protocols are scored separately (402 records), never mixed into the pre-token board.

## Run it

```sh
node main.ts
```

Reads /input/snapshot.json and writes board.json, data.js, dossier.json, dashboard/ and screenshots/ to /output (override with MAKEFUN_INPUT_DIR / MAKEFUN_OUTPUT_DIR).

---
<sub>Entered on [make.fun](https://make.fun/?ref=34ergn4s&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
