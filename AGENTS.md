# Agent Workflow

## Branches and Pull Requests

- Never make commits directly on `main`.
- Create and work on a dedicated branch for every task before changing files.
- When the work is complete, create a pull request targeting `main` and summarize the changes and verification performed.
- Never merge a pull request. The user is responsible for reviewing and merging it.

## Development

- Inspect the repository and its existing conventions before making changes.
- Keep changes focused on the requested task and preserve unrelated work.
- Run the relevant tests, lint checks, or build before creating a pull request, and report any checks that could not be run.

## Programming Style

The repository is class based (Inversify services, commands, views). Keep it that way:

- Stateful behaviour (IO, VS Code APIs, caches) lives in classes bound through the DI container.
- Domain knowledge about a model belongs to that model class, not to a side module. Id rules for
  scripts and directories are static members of `ScriptId` (`prefix`, `rootId`, `isValid`,
  `isDirectoryId`, `lastSegmentOf`, `parentIdOf`). Do not re-implement `startsWith("script.js")`
  checks elsewhere and do not add parallel helper modules for the same rules.
- Free functions are only used for stateless value transformations (`models/EngineType.ts`,
  `services/formatError.ts`) and inside `src/aiTools/core`, which is intentionally VS Code free and
  takes its dependencies as an explicit `ToolDeps` parameter so it stays testable without the
  extension host.

