# opencode-shell-safety

An OpenCode v2 plugin that uses [Jev](https://en.wikipedia.org/wiki/Jev_(AI_model))
to classify shell permission requests against the active agent definition and
its filesystem policy.

## Install

Add the plugin to `~/.config/opencode/opencode.jsonc` to use it across projects.
OpenCode installs configured package plugins; you do not need to install the
package separately. For one project, use its `opencode.jsonc` instead.

```jsonc
{
  "plugins": [
    {
      "package": "opencode-shell-safety",
      "options": {
        "endpoint": "https://opencode.ai/zen/v1/systemone",
        "model": "jev-1.13",
        "integration": "opencode",
        "allowProbability": 0.45,
        "violationProbability": 0.4,
        "timeoutMs": 15000,
        "maxAttempts": 2,
        "retryDelayMs": 250,
        "cache": {
          "capacity": 256,
          "ttlMs": 300000
        },
        "agents": {
          "Explorer": {
            "enabled": true,
            "http": {
              "methods": [],
              "credentials": {}
            }
          },
          "Librarian": {
            "enabled": true,
            "http": {
              "methods": ["GET", "HEAD"],
              "credentials": {
                "BRAVE_SEARCH_API_KEY": ["api.search.brave.com"]
              }
            }
          },
          "Junior": {
            "enabled": true,
            "thresholds": {
              "allowProbability": 0.35,
              "violationProbability": 0.5
            },
            "http": {
              "methods": ["GET", "HEAD"],
              "credentials": {
                "BRAVE_SEARCH_API_KEY": ["api.search.brave.com"]
              }
            }
          }
        }
      }
    }
  ]
}
```

The plugin first resolves the named OpenCode integration credential. If that
does not provide a key, it reads `OPENCODE_API_KEY` from the server environment.

## Options

| Option | Description |
| --- | --- |
| `endpoint` | SystemOne HTTP endpoint. |
| `model` | Model sent in each classification request. |
| `integration` | OpenCode integration used to resolve the Zen credential. |
| `allowProbability` | Minimum `withinPolicy` probability required to allow a command. |
| `violationProbability` | Probability at or above which a filesystem, remote-mutation, or credential violation denies a command. |
| `timeoutMs` | Timeout for one request attempt. |
| `maxAttempts` | Maximum attempts for network, timeout, rate-limit, and server failures. |
| `retryDelayMs` | Delay between retry attempts. |
| `cache.capacity` | Maximum number of cached classification results. |
| `cache.ttlMs` | Successful classification cache lifetime in milliseconds. |
| `agents.<name>.enabled` | Enables classification for an agent. |
| `agents.<name>.thresholds` | Optional per-agent probability thresholds. |
| `agents.<name>.http.methods` | HTTP methods the policy permits. |
| `agents.<name>.http.credentials` | Environment credential names mapped to allowed HTTPS hosts. |

All options are required except each agent's `thresholds` field.

## Configure agents

- Define agents in [OpenCode](https://opencode.ai/v2/docs/agents). Plugin
  `agents` entries do not create them.
- Replace `Explorer`, `Librarian`, and `Junior` with your agent names. Only
  entries with `enabled: true` are classified.

## Development

Install dependencies:

```sh
bun install
```

Run the typecheck and unit tests:

```sh
bun run check
bun run test
```

The E2E suite starts private OpenCode servers with isolated configuration,
state, cache, data, and database directories. It makes real SystemOne requests
and requires `OPENCODE_API_KEY` in the environment:

```sh
bun run test:e2e
```

Run every check with:

```sh
make test
```

## Release

Before publishing, run the full test target and inspect the package contents:

```sh
make test
bun pm pack --dry-run
```

Publish from a clean worktree after reviewing the version and package contents:

```sh
bun publish --access public
```
