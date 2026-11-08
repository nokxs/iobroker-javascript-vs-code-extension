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

### Do not mix paradigms casually

When adding a helper, decide first and only then write it:

1. Does it know a rule about a model (id shape, naming, parent/child, engine type)? Put it on that
   model class as a static member. Never open a second module next to the model for the same rule.
2. Does it need IO, VS Code APIs or cached state? Put it in a service class and inject it.
3. Is it a pure value transformation without any of the above? A free function is fine. Keep it in
   the module of the value it transforms.
4. Is it part of an AI tool? `src/aiTools/core` stays VS Code free and functional; the `ToolDeps`
   parameter is the seam to the services.

A new top level module that duplicates an existing rule is a regression even when it is DRY-er to
write. Extend the owning class instead.

## Adding an AI tool

All four places have to stay in sync, otherwise `aiToolsContribution.test.ts` or the tool listing
breaks:

1. Input/DTO types in `src/aiTools/core/types.ts`, the function in `src/aiTools/core/<tool>.ts`.
2. Schema in `src/aiTools/schemas.ts`.
3. Mirrored entry in `contributes.languageModelTools` in `package.json` (`when: "iobrokerAiToolsEnabled"`).
4. Adapter in `src/aiTools/tools/readTools.ts` or `writeTools.ts` plus registration in `createTools`.
5. Row in the tool table of `README.md`.

Extend the `ToolDeps` `Pick<...>` only with what the new tool really needs; the fakes in
`src/test/suite/aiToolsCore.test.ts` must be updated in the same change.


