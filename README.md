# opencode-shell-safety

An OpenCode v2 plugin that uses [Jev](https://en.wikipedia.org/wiki/Jev_(AI_model))
to classify shell permission requests against the active agent definition and
its filesystem policy.

## Install with OpenCode Zen

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
        "agents": {
          "Explorer": {
            "enabled": true
          }
        }
      }
    }
  ]
}
```

For a manual key instead, replace `integration` with
`"apiKeyEnv": "OPENCODE_API_KEY"`.

## Use TypeSafe AI

Get an API key from [TypeSafe AI](https://docs.typesafe.ai/introduction/quickstart)
and set `TYPESAFE_API_KEY` in the OpenCode server environment. Add this plugin
configuration to `opencode.jsonc` instead of the OpenCode Zen example above:

```jsonc
{
  "plugins": [
    {
      "package": "opencode-shell-safety",
      "options": {
        "endpoint": "https://api.typesafe.ai/v1/systemone",
        "model": "jev-1.13.0",
        "apiKeyEnv": "TYPESAFE_API_KEY",
        "agents": {
          "Explorer": {
            "enabled": true
          }
        }
      }
    }
  ]
}
```

## Options

| Option | Description |
| --- | --- |
| `endpoint` | SystemOne HTTP endpoint. |
| `model` | Model sent in each classification request. |
| `integration` | OpenCode integration whose credential takes precedence over `apiKeyEnv`. |
| `apiKeyEnv` | Environment variable to read if no integration credential is available. |
| `allowProbability` | Minimum `withinPolicy` probability required to allow a command. |
| `violationProbability` | Probability at or above which a filesystem, remote-mutation, or credential violation denies a command. |
| `timeoutMs` | Timeout for one request attempt. |
| `maxAttempts` | Maximum attempts for network, timeout, rate-limit, and server failures. |
| `retryDelayMs` | Delay between retry attempts. |
| `cache.capacity` | Maximum number of cached classification results. |
| `cache.ttlMs` | Successful classification cache lifetime in milliseconds. |
| `agents.<name>.enabled` | Enables classification for an agent. |
| `agents.<name>.thresholds` | Optional per-agent probability thresholds. |
| `agents.<name>.http` | Optional. Omission permits no HTTP methods or credential hosts. |
| `agents.<name>.http.methods` | HTTP methods the policy permits. |
| `agents.<name>.http.credentials` | Environment credential names mapped to allowed HTTPS hosts. |

Set at least one of `integration` or `apiKeyEnv`.

The plugin sends the selected credential to `endpoint`. Check the URL when
configuring a custom endpoint.

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
