# Graphify code graph

This project has a local knowledge graph of the codebase at `graphify-out/graph.json`
(generated, git-ignored). The tool itself lives in `.tools/venv` inside this folder —
never install it globally.

When the graph exists, use it before grepping:

- Architecture / "how does X work" questions → `npm run graph:query -- "<question>"`
- One symbol and its neighbours → `npm run graph:explain -- <symbol>`
- Impact of a change → `npm run graph:affected -- <symbol> --depth 2`
- Most connected modules (architecture hubs) → `npm run graph:hubs`

If the graph is missing or stale, rebuild it (no API key required):

```
npm run graph:setup   # only the first time: creates .tools/venv
npm run graph:build
```

Rules:

1. Cite the `src=` / `loc=` references returned by the graph so answers stay verifiable.
2. Refresh with `npm run graph:build` after adding or removing files/exports.
3. Do not read or edit `graphify-out/` or `.tools/` by hand, and never import them from `src/`.
4. Graphify is developer tooling only — it is not an app dependency and must not ship to the browser.
5. Setup and caveats: `docs/graphify.md`.

