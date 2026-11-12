# Standalone MCP server (remote-only) — design

Status: draft, no code yet
Scope: a real Model Context Protocol server that talks to ioBroker only, configured
exclusively through environment variables.

## 1. Problem

The extension already exposes 17 language model tools, but they are registered with
`vscode.lm.registerTool` in
[AiToolService.ts](../src/services/aiTool/AiToolService.ts). The command title
`iobroker: Enable/disable MCP server (AI tools)` and the README section "MCP server"
suggest a protocol server that does not exist: MCP is never spoken, so clients such as
OpenChamber, Claude Desktop or Cursor cannot connect.

Everything below the tool layer is already protocol agnostic: `src/aiTools/core` is free
of VS Code imports and receives its dependencies as an explicit
[`ToolDeps`](../src/aiTools/core/types.ts) parameter. That seam is what this design uses.

## 2. Goals and non-goals

Goals:

- A stdio MCP server that any MCP client can start with `npx`.
- **Remote-only**: the server talks to the ioBroker socket and needs no local workspace,
  no local script files and no filesystem access at all.
- Configuration entirely through environment variables, so a client UI like OpenChamber
  is the only place a user has to touch.
- Silent re-authentication: the user never has to type the password again while the
  server runs.
- A read-only switch that hides every write tool.

Non-goals:

- Replacing the existing VS Code language model tools. They keep their hybrid behaviour.
- Local script sync (diff, upload, download) in the MCP server.
- HTTP/SSE transport, multi-instance support, per-user authorisation.
- Renaming the extension command in this change (see section 12).

## 3. Why remote-only

The workspace coupling is an artefact of the tool layer, not a requirement of the
ioBroker API. Evidence from the current code:

- `iobroker_get_script_content` already falls back to `common.source` from the server
  when the local file does not exist
  ([getScriptContent.ts](../src/aiTools/core/getScriptContent.ts)).
- `downloadAllScripts()` is a pure socket read (`getSystemObjectView("script", ...)`),
  see [ScriptRemoteService.ts](../src/services/scriptRemote/ScriptRemoteService.ts).
- Everything that genuinely needs files is the sync feature: upload, download, changed
  scripts, and the local mirror of create/rename/move/delete.

Dropping the workspace has three consequences: no `--workspace` argument, no
`.iobroker-config.json` lookup, and no path handling, which removes a whole class of
security issues (path traversal, deleting the wrong local file, tool writes into the
user's project).

Comparison of both modes:

| | Hybrid (today, extension) | Remote-only (this design) |
|---|---|---|
| Filesystem access | required | none |
| Configuration | `.iobroker-config.json` + SecretStorage | environment variables |
| Secrets at rest | OS keychain via VS Code | client config (see section 10) |
| Tools | 17 | 13 kept, 1 new, 4 dropped |
| Re-auth | password from SecretStorage | password from env, held in memory |

## 4. Tool set

Kept unchanged in behaviour:

| Tool | Notes |
|---|---|
| `iobroker_get_scripts` | `filePath`, `isDirty`, `isRemoteOnly` are removed from the DTO |
| `iobroker_get_script_content` | always reads `common.source`; `fromDisk` is dropped |
| `iobroker_get_js_instances` | unchanged |
| `iobroker_get_state` | unchanged |
| `iobroker_get_logs` | unchanged |
| `iobroker_start_script` | unchanged |
| `iobroker_stop_script` | unchanged |
| `iobroker_create_script` | `source` stays in the request, the server object is created directly |
| `iobroker_create_directory` | remote side only, no local folder is mirrored |
| `iobroker_rename_script` | remote side only, no file is renamed |
| `iobroker_move_script` | remote side only, no file is moved |
| `iobroker_delete_script` | remote side only, no file is deleted |
| `iobroker_delete_directory` | remote side only, no folder is deleted |

Dropped, because they only describe a local/remote difference:

| Tool | Reason |
|---|---|
| `iobroker_upload_script` | nothing local to upload |
| `iobroker_upload_all_changed_scripts` | nothing local to compare |
| `iobroker_download_script` | nowhere to download to |
| `iobroker_get_changed_scripts` | same |

New, replaces the upload semantics:

| Tool | Input | Behaviour |
|---|---|---|
| `iobroker_update_script_source` | `scriptId`, `source` | writes `common.source` through `scriptRemote.update` |

`iobroker_update_script_source` is the missing piece for an agent that edits a script:
the extension never needed it because the editor saved to disk and the user uploaded.
`IScriptRemoteService.update(scriptId, script)` already exists and does an
`extendObject`, so no new transport code is required.

Result DTOs that lose fields (`filePath`, `isDirty`, `isRemoteOnly`, `fromDisk`) must be
changed in `src/aiTools/core/types.ts` only for the remote variants, see section 9.

## 5. Architecture

```
src/mcp/
  main.ts                  entry point, shebang, crash handling
  McpServerRunner.ts       wires services, registers handlers, starts stdio transport
  ServerConfig.ts          reads and validates the environment
  tools/remoteToolSet.ts   maps ToolName -> remote core function + JSON schema
  ToolResultMapper.ts      ToolOutcome -> MCP CallToolResult
src/aiTools/core/remote/
  *.ts                     remote-only implementations (see section 9)
src/services/remote/       Node side services (see section 8)
```

Transport: stdio. The process must treat stdout as reserved for JSON-RPC; diagnostics go
to stderr only. A stray `console.log` in the reused code would corrupt the protocol, so
the build asserts that no `console.log` reaches the server bundle (section 11).

MCP API level: use the low level `Server` from `@modelcontextprotocol/sdk` with
`setRequestHandler(ListToolsRequestSchema)` and `setRequestHandler(CallToolRequestSchema)`
instead of the high level `McpServer`. Reason: the high level API expects zod schemas,
while [schemas.ts](../src/aiTools/schemas.ts) already holds plain JSON Schema objects
that `package.json` mirrors. Reusing them verbatim avoids a second schema dialect and
avoids a zod dependency.

```
tools/list -> TOOL_NAMES (filtered by the read-only flag)
              map name -> { name, description, inputSchema: TOOL_SCHEMAS[name] }
tools/call -> remote tool set -> ToolOutcome -> CallToolResult
```

Tools are registered from the schema module, so `listTools` can never drift from the
schemas that the extension advertises.

Additions per tool:

- `description`: today the descriptions live in `package.json`
  (`contributes.languageModelTools`) and in the schema property descriptions. The MCP
  server needs a short description per tool, so it is added next to `TOOL_SCHEMAS` and
  the existing contribution test is extended to cover both.
- `annotations`: `readOnlyHint` for the `get_*`/`start`/`stop` tools,
  `destructiveHint` for `delete_*`, `move` and `update_script_source`. The client decides
  whether to ask the user, so the hints are the only way to communicate risk.

## 6. Configuration

All values come from the environment. `IOBROKER_MCP_URL` includes the admin port, exactly
like the URL the extension builds from `ioBrokerUrl` and `socketIoPort`.

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `IOBROKER_MCP_URL` | yes | – | `http://host:8081` or `https://host:8081` |
| `IOBROKER_MCP_USERNAME` | yes when login is enabled | – | ioBroker user |
| `IOBROKER_MCP_PASSWORD` | yes when login is enabled | – | ioBroker password |
| `IOBROKER_MCP_ALLOW_SELF_SIGNED` | no | `false` | accept self signed certificates, TLS only |
| `IOBROKER_MCP_READ_ONLY` | no | `false` | expose read tools only |
| `IOBROKER_MCP_SCRIPT_AUTO_RUN` | no | `false` | maps to `scriptAutoRun` |
| `IOBROKER_MCP_LOG_LEVEL` | no | `info` | stderr diagnostics only |

Derived instead of configured:

- `adminVersion` is detected by
  [AdminVersionDetector](../src/services/adminVersionDetector/AdminVersionDetector.ts),
  which already probes Admin 4 and the newer socket API.
- `scriptRoot` does not exist, there is no local root.
- The login type is detected once and cached, see section 7.

Startup validation happens before the transport starts. A missing required variable is
reported on stderr with exit code 2, not as a protocol error, because the client cannot
render it before `initialize`.

`ServerConfig` logs its own values with the password replaced by `***`, and no other
component ever logs a secret. The existing `logDebug(JSON.stringify(this.config))` pattern
must not be copied into the Node services.

## 7. Authentication and re-authentication

The mechanics stay the same as in the extension
([LoginService.ts](../src/services/loginHttpClient/LoginService.ts)):

1. detect the login type (OAuth2 `/oauth/token`, legacy `/login`, or no login),
2. POST username and password, receive a session cookie plus `Expires`,
3. pass the cookie to the socket handshake as `{ cookie: token, name: username }`
   ([ConnectionServiceAdmin5.ts](../src/services/connection/ConnectionServiceAdmin5.ts)),
4. reuse the token until 60 s before `expires`.

The only difference: the password is read from the environment once at start and kept in
memory. That makes silent re-auth identical to the extension, the user is never prompted.

Four rules make it stable:

- **Single flight.** The socket emits `reauthenticate` and the server may see it while
  tool calls are in flight. A `Promise<void>` in-flight handle serialises the reconnect;
  every caller awaits the same promise. Without it, concurrent calls create several
  logins and invalidate each other's session.
- **Never re-detect the login type on re-auth.** An expired token makes detection
  unreliable; this is the reason `IobrokerConnectionService` caches `detectedLoginType`
  (`connect(true)` skips detection on purpose).
- **Proactive refresh.** A timer renews the token shortly before `expires` so tool calls
  do not run into an expired session. The `reauthenticate` event stays as a safety net.
- **Bounded retries.** A wrong password must not loop against ioBroker (account lockout).
  After three failed attempts with backoff, tool calls answer
  `{ code: "not_connected", hint: "Update IOBROKER_MCP_PASSWORD and restart the server." }`.

While a re-auth runs, tool calls wait for the in-flight promise instead of triggering
their own login. If the socket never comes back, calls fail with `not_connected` after a
timeout instead of hanging forever.

## 8. Services that can be reused

The transport layer is already usable outside VS Code, because VS Code is only imported
for types in most places and TypeScript elides type-only imports:

| Service | Reusable as is | Note |
|---|---|---|
| `SocketIoClient` | yes | `ws` only |
| `ConnectionServiceAdmin5` / `Admin4` | yes | `window.setStatusBarMessage` needs a no-op |
| `LoginService` | yes | `Uri` only in type positions |
| `ScriptRemoteService` | yes | `Uri` only in a signature; `.env` secret replacement no-ops without a workspace |
| `DirectoryService` | yes | no VS Code imports |
| `StateAndObjectRemoteService` | yes | no VS Code imports |
| `JsInstanceService` | yes | no VS Code imports |
| `ScriptIdService` | partial | `sanatizeId` is portable, `getIoBrokerId` needs a workspace |
| `ScriptRepositoryService` | **no** | watchers, text documents, git extension, dirty state |
| `ScriptService` | partial | `getDefaultScript`/`getFileExtension` portable, file access not |
| `ScriptFileService` | no | `workspace.fs` |
| `ConfigRepositoryService` | no | reads `.iobroker-config.json` |
| `WorkspaceService` | no | VS Code workspaces |

Two Node side implementations are therefore added:

- `EnvConfigRepositoryService` implementing `IConfigRepositoryService` from the
  environment. It also lets `ScriptRemoteService` keep its `scriptAutoRun` check.
- `NoWorkspaceService` implementing `IWorkspaceService` with no workspace. It keeps
  `SecretPlaceholderService` inactive, so `<workspace>/.env` is never read.

URI values (`http://host:8081`) are built with the standalone `vscode-uri` package, which
is the implementation VS Code uses internally. The members the reused code touches
(`scheme`, `authority`, `path`, `toString`) are compatible, so no shim for the `vscode`
module is needed.

A `vscode` module shim is explicitly rejected: webpack would resolve `require("vscode")`
to no-op objects, which silently hides broken behaviour instead of failing the build.

`RemoteScriptRepository` (new, in `src/services/remote/`) implements the repository
subset that the core functions need:

- initial load: `downloadAllScripts()` and `directoryService.downloadAllDirectories()`
- invalidation: `registerForObjectChange("script.js.*", ...)`, the same mechanism
  `ScriptRemoteService` already exposes
- no dirty state, no watchers, no git, no `absoluteUri`
- `evaluateDirtyState*`/`evaluateScriptOnRemote*` do not exist, the four sync tools are
  dropped instead of stubbed

Estimated size: around 150 lines, compared to 531 lines for the existing service.

## 9. Dependency seam for the core

`ToolDeps` currently requires `files`, `documents` and the local parts of `scripts`,
`script` and `scriptCreation`. Two options:

| Option | Consequence |
|---|---|
| A. Make `ToolDeps` fields optional and branch inside `core` | every function gets `if (deps.files)` branches, the extension path becomes harder to test |
| B. Separate remote core modules, shared helpers and types | slight duplication of orchestration, but no conditional paths and no risk for the existing tools |

**Decision: B.** `src/aiTools/core/remote/` holds the 14 remote implementations
(`types.ts` for the DTOs, `helpers.ts` for the pure helpers). `validation.ts`,
`connection.ts`, `ScriptId`, `EngineType` and the failure/success helpers are imported
unchanged. The existing `src/aiTools/core/*` files stay untouched, so the extension keeps
working exactly as before and its tests keep covering it.

The remote `ToolDeps` picks become:

```ts
interface RemoteToolDeps {
    connection: Pick<IIobrokerConnectionService, "isConnected">
    scripts: RemoteScriptRepository
    scriptRemote: Pick<IScriptRemoteService,
        "downloadScriptWithId" | "uploadScript" | "update" | "startScript" | "stopScript"
        | "rename" | "move" | "delete">
    script: Pick<IScriptService, "getDefaultScript" | "getFileExtension">
    scriptId: Pick<IScriptIdService, "sanatizeId">
    directories: Pick<IDirectoryService, "createDirectory" | "createDirectoriesRecursively" | "deleteDirectory">
    jsInstances: Pick<IJsInstanceService, "getAvailableInstances">
    states: Pick<IStateAndObjectRemoteService, "getState">
    logs: { getHosts(): Promise<LogHost[]>; getLogs(hostId: string, lines: number): Promise<string[]> }
}
```

Note the absence of `files`, `documents`, `scriptCreation` and the four sync methods.

## 10. Security

- No filesystem access at all. Every path-like input is an ioBroker object id, which is
  validated by `toScriptId`/`toDirectoryId` before use.
- Read-only mode filters the tool list before it is advertised, so a client cannot call a
  hidden write tool at all.
- Destructive tools carry `destructiveHint`, so clients that support annotations can ask
  before executing. The server cannot enforce a confirmation dialog; that is client
  behaviour and must be documented.
- `IOBROKER_MCP_PASSWORD` is plain text wherever the client stores its server
  configuration. Recommendations for the docs: keep the entry scoped to one project
  instead of "available in every project", and verify the permissions of the client's
  config file.
- The token and password live in process memory only. Nothing is written to disk.
- `IOBROKER_MCP_ALLOW_SELF_SIGNED` only affects the axios/socket agent for the configured
  host. `NODE_TLS_REJECT_UNAUTHORIZED` is never set.
- Startup diagnostics name the missing variable but never a value.

## 11. Build and packaging

- Second webpack config `build/mcp-server.webpack.config.js`, target `node`, output
  `dist/mcp-server.js`, `externals: { vscode: "commonjs vscode" }` so a leftover import
  fails at runtime instead of resolving to undefined.
- Build assertion in the test suite:
  - the bundle contains no `require("vscode")`,
  - the bundle contains no `console.log(` (protocol safety),
  - `TOOL_NAMES` equals the tool list returned by `tools/list`.
- Distribution options:

| Option | Pros | Cons |
|---|---|---|
| `bin` entry in the repository root `package.json` | one repo, one build | the package is named `iobroker-javascript` and is meant for the marketplace |
| separate package `@nokxs/iobroker-mcp` in `mcp/`, published from the same repo | clean npm name, own versioning | second `package.json`, the build has to copy `dist/mcp-server.js` |
| no npm publication, `npx github:nokxs/...` | no registry | slow install, needs git in the client |

Recommended: the separate `@nokxs/iobroker-mcp` package, built from the same sources. The
version is kept in sync with the extension so a user can tell which extension version a
server corresponds to.

## 12. Work items

1. `RemoteScriptRepository` plus `EnvConfigRepositoryService` and `NoWorkspaceService`.
2. `src/aiTools/core/remote/` with the 14 tools, sharing validation and helpers.
3. `src/mcp` entry point, env validation, `tools/list` from `TOOL_SCHEMAS`,
   `ToolOutcome` -> `CallToolResult` mapping.
4. Login and re-auth: cached login type, single flight, proactive refresh, bounded
   retries.
5. Read-only mode and annotations.
6. Build config, bundle assertions, stdio smoke test.
7. Package publication and README section with the OpenChamber example.
8. Rename the misleading extension command from `Enable/disable MCP server (AI tools)` to
   something like `Enable/disable AI tools`, because after this change a real MCP server
   exists and the old name would describe the wrong thing.

Each step is verified by `npm run test-compile`, `npm run lint` and the aiTools tests.

## 13. Open questions

- Package name and scope: `@nokxs/iobroker-mcp` or an unscoped name.
- Should `iobroker_update_script_source` also allow changing `engineType` (converting a
  script between javascript and typescript)? Currently out of scope.
- Should read-only mode also hide `start`/`stop`? They are writes, but not destructive.
  Proposal: yes, read-only means `get_*` only.
- Should the server expose `iobroker_get_object` (read any object, not just scripts)? Useful
  for agents, but it widens the surface. Not part of this change.

## 14. OpenChamber setup (target state)

```
Command:
npx
-y
@nokxs/iobroker-mcp

Environment variables:
IOBROKER_MCP_URL       = http://192.168.1.10:8081
IOBROKER_MCP_USERNAME  = admin
IOBROKER_MCP_PASSWORD  = <password>

Optional:
IOBROKER_MCP_READ_ONLY = true
```

No workspace, no `--workspace` argument, no files in the project. The password is managed
by OpenChamber and is used for silent re-auth; changing it in ioBroker requires updating
the environment variable and restarting the server.
