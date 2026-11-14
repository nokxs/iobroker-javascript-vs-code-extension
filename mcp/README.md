# @liofly/iobroker-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for ioBroker. It lets an AI
agent read and edit the scripts of the ioBroker javascript adapter and inspect states and logs —
without VS Code, without a local workspace and without the companion extension.

The server speaks MCP over stdio and is started by the MCP client:

```json
{
  "mcpServers": {
    "iobroker": {
      "command": "npx",
      "args": ["-y", "@liofly/iobroker-mcp"],
      "env": {
        "IOBROKER_MCP_URL": "http://iobroker.local:8081",
        "IOBROKER_MCP_USERNAME": "admin",
        "IOBROKER_MCP_PASSWORD": "…"
      }
    }
  }
}
```

## Configuration

Everything is configured through environment variables. There is no config file and no command
line flag that carries a value.

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `IOBROKER_MCP_URL` | yes | – | `http://host:8081` or `https://host:8081`, including the admin port |
| `IOBROKER_MCP_USERNAME` | when login is enabled | – | ioBroker user |
| `IOBROKER_MCP_PASSWORD` | when login is enabled | – | ioBroker password |
| `IOBROKER_MCP_ALLOW_SELF_SIGNED` | no | `false` | accept self signed certificates for `https://` |
| `IOBROKER_MCP_READ_ONLY` | no | `false` | expose the read tools only |
| `IOBROKER_MCP_SCRIPT_AUTO_RUN` | no | `false` | enable a script right after it was created |
| `IOBROKER_MCP_WRITABLE_STATES` | no | – | `;` separated glob patterns of writable state ids; unset or empty disables `iobroker_set_states` |
| `IOBROKER_MCP_LOG_LEVEL` | no | `info` | stderr diagnostics: `error`, `warn`, `info`, `debug`, `silly` |

State writes are opt-in. Set `IOBROKER_MCP_WRITABLE_STATES` to the ids the agent may change, for
example:

```bash
IOBROKER_MCP_WRITABLE_STATES="0_userdata.0.*;alias.0.UG.Technikraum.Waermepumpe.Aktuell.*"
```

The patterns follow the ioBroker glob rules: `*` matches any sequence including dots, `?` matches
exactly one character, everything else is literal and case sensitive. The separator is `;` because
an ioBroker id cannot contain it. Without the variable, `iobroker_set_states` is not advertised at
all (17 tools instead of 18); `IOBROKER_MCP_READ_ONLY=true` hides it as well. Only state values are
written, never object definitions, and a batch is rejected as a whole when one id is not allowed.

`npx @liofly/iobroker-mcp --check` validates the environment and prints a redacted summary to stderr
without connecting. `--version` and `--help` do not touch the network either.

## Tools

Read: `iobroker_get_scripts`, `iobroker_get_script_content`, `iobroker_get_js_instances`,
`iobroker_get_state`, `iobroker_get_states`, `iobroker_get_objects`,
`iobroker_get_writable_states`, `iobroker_get_logs`.

Write: `iobroker_start_script`, `iobroker_stop_script`, `iobroker_create_script`,
`iobroker_create_directory`, `iobroker_rename_script`, `iobroker_move_script`,
`iobroker_delete_script`, `iobroker_delete_directory`, `iobroker_update_script_source`,
`iobroker_set_states`.

The four synchronisation tools of the VS Code extension (`upload_*`, `download_script`,
`get_changed_scripts`) do not exist, because there is no local file to upload, download or compare.
`iobroker_update_script_source` replaces the upload flow: read the script with
`iobroker_get_script_content`, then send the complete new source. `iobroker_get_writable_states`
is the discovery call for state writes: it returns the configured patterns plus the existing
states they currently match, with a `writable` flag per state.

## Notes

- Diagnostics go to stderr; stdout carries the protocol. The password and session token are
  redacted from every log line and error message.
- A tool call is bounded to 30 seconds, at most 8 calls run at the same time. The server connects
  lazily on the first call and stays alive until the client closes stdin.
- Three failed logins stop the server in a state that needs a restart with a corrected password,
  so a wrong password cannot lock the ioBroker user.
- Works with ioBroker Admin 5, 6 and 7; Admin 4 only degraded, like the extension.

The full documentation, including the design of the timeouts and the tool reference, is in the
[repository](https://github.com/nokxs/iobroker-javascript-vs-code-extension#readme).

## License

MIT
