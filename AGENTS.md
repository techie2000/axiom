# AGENTS.md

This repository keeps repo-wide agent policy in
`.github/copilot-instructions.md`.

If you are an AI agent or automation tool starting from the repository root:

- Read `.github/copilot-instructions.md` first.
- Apply any scoped instruction files in `.github/instructions/` that match the
  files or workflow you are changing.
- Do not maintain separate full-policy copies in `CLAUDE.md`, `CURSOR.md`,
  `GEMINI.md`, or similar files. If a tool requires a repo-root discovery
  file, keep it as a thin stub that delegates to the canonical policy.
