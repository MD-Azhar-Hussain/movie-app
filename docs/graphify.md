# Code intelligence with Graphify (project-local only)

This repo uses **[Graphify](https://github.com/Graphify-Labs/graphify)** to turn the codebase into a queryable knowledge graph (`graphify-out/graph.json`).

**Scope rule for this repo: nothing is installed outside the project folder.** No global CLI, no `~/.local/bin`, no `~/.graphify`, no system Python packages — the tool lives in `.tools/venv` inside this directory and is git-ignored.

It is also **developer/agent tooling only**: nothing here is imported by the app, bundled by Vite, or deployed to Vercel.

> Upstream `Graphify-Labs/graphify` (Apache-2.0). PyPI package **`graphifyy`**, executables `graphify` / `graphify-mcp`. "graphify" and its logo are marks of Graphify Labs; this repo is only a consumer.

## Setup (once, inside this folder)

Requires **`uv`** (already available here). It creates `.tools/venv` and installs the package into it, keeping uv's own download cache inside the project too:

```bash
npm run graph:setup
# → uv venv .tools/venv --allow-existing
# → uv pip install --python .tools/venv graphifyy   (UV_CACHE_DIR=.tools/uv-cache)
```

Then build the graph (no API key, no LLM):

```bash
npm run graph:build
```

Everything lands here:

```
movie-app/
├─ .tools/venv/            ← Python venv with graphifyy   (git-ignored, ~130 MB)
├─ .tools/uv-cache/        ← uv package cache             (git-ignored)
├─ graphify-out/graph.json ← generated graph              (git-ignored, ~200 KB)
├─ scripts/graphify-setup.mjs ← idempotent bootstrap (uv venv + install)
└─ scripts/graphify.mjs    ← launcher that pins the venv path
```

`scripts/graphify.mjs` resolves `.tools/venv/Scripts/graphify.exe` (Windows) or `.tools/venv/bin/graphify` (macOS/Linux), so npm scripts work on every platform without a global binary.


## Commands

| Task | npm script |
| --- | --- |
| Create/refresh the local venv (idempotent) | `npm run graph:setup` |
| Build/refresh the graph (AST only, no API key) | `npm run graph:build` |
| Refresh including clustering + report | `npm run graph:update` |
| Ask a question about the code | `npm run graph:query -- "how does prerendering pick routes?"` |
| Explain one symbol and its neighbours | `npm run graph:explain -- buildMovieTitle` |
| Most connected "god nodes" (architecture hubs) | `npm run graph:hubs` |
| Reverse impact: what is affected by X | `npm run graph:affected -- SEO --depth 2` |

Example output:

```
$ npm run graph:query -- "how does the watchlist sync queue work"
Graph: graphify-out/graph.json (313 nodes) | Traversal: BFS depth=2
Start: ['WATCHLIST_SYNC_QUEUE_KEY', 'watchlist.js', 'flushSyncQueue()'] | 84 nodes found
NODE flushSyncQueue() [src=src/lib/watchlist.js loc=L246]
NODE enqueueWatchlistMutation() [src=src/lib/watchlist.js loc=L224]
```

`query`, `path` and `explain` exit `0` with an answer, `3` when a name is ambiguous (candidates listed) and `4` when nothing matches.

Advanced commands are available through the same launcher, e.g.
`node scripts/graphify.mjs path "HomePage" "watchlist.js"`,
`node scripts/graphify.mjs watch .` (auto-rebuild),
`node scripts/graphify.mjs affected MovieSchema`.

## What is committed vs. generated

| Path | Status | Notes |
| --- | --- | --- |
| `.agents/skills/graphify/` | **committed** | Portable `SKILL.md` + references (AGENTS.md-style hosts) |
| `.copilot/skills/graphify/` | **committed** | Same skill packaged for GitHub Copilot / VS Code |
| `.clinerules/graphify.md` | **committed** | Cline rule: query the graph first, rebuild when stale |
| `scripts/graphify.mjs` | **committed** | Cross-platform launcher for the local venv |
| `scripts/graphify-setup.mjs` | **committed** | Idempotent bootstrap; keeps `UV_CACHE_DIR` inside the repo |
| `docs/graphify.md` | **committed** | This file |
| `.tools/` | **ignored** | Project-local Python venv + uv cache (~130 MB) |
| `graphify-out/` | **ignored** | Generated graph, AST cache, manifest, HTML report |
| `/raw/` | **ignored** | Output of `graphify add <url>` |

Do **not** commit `graphify-out/` or `.tools/`: both are generated and would make diffs noisy.

## Adding the skill for other editors (still project-scoped)

Use the local binary so nothing is written to user-level config:

```powershell
.\.tools\venv\Scripts\graphify.exe install --project --platform cursor
.\.tools\venv\Scripts\graphify.exe install --project --platform claude
.\.tools\venv\Scripts\graphify.exe install --project --platform gemini
# macOS/Linux: ./.tools/venv/bin/graphify install --project --platform cursor
```

One platform per invocation — the CLI rejects multiple `--platform` flags. `agents` and `copilot` are already installed here. Remove with `... install`'s counterpart `uninstall` from the same venv.

## Removing it entirely

```bash
rm -r .tools graphify-out        # PowerShell: Remove-Item -Recurse -Force .tools, graphify-out
```

Then delete the `graph:`-prefixed npm scripts and the Graphify sections in this file, `README.md`, `.clinerules/graphify.md` and `.github/copilot-instructions.md`. Nothing else in the app depends on it.

## Notes

- `npm run lint` and `npm run build` remain the CI gates; the graph is built manually (or in a separate job: `npm run graph:setup && npm run graph:build`).
- No dependency was added to `package.json` `dependencies`/`devDependencies`.
- Deterministic AST extraction needs **no** API key. Only `graphify extract` (docs/PDF/images with LLM-inferred edges) needs `GEMINI_API_KEY` — not configured, not required.
