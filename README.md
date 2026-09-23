# opencode-shell-safety

[![npm version](https://img.shields.io/npm/v/opencode-shell-safety)](https://www.npmjs.com/package/opencode-shell-safety)

An OpenCode v2 plugin that uses [Jev](<https://en.wikipedia.org/wiki/Jev_(AI_model)>) to classify shell permission requests against the active agent definition and its filesystem policy.

This project is part of [alexandru/agents-config](https://github.com/alexandru/agents-config). See it in use in my [OpenCode configuration](https://github.com/alexandru/opencode-config).

## Configuration

### With OpenCode Zen

[OpenCode Zen](https://opencode.ai/zen) provides access to Jev. Create an account, and an API token, then add the plugin to `~/.config/opencode/opencode.jsonc`:

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
            "enabled": true,
          },
        },
      },
    },
  ],
}
```

The `"integration": "opencode"` assumes authentication via `opencode auth login`. As an alternative, replace `integration` with the name of the environment variable that stores the API token:

```json
"apiKeyEnv": "OPENCODE_API_KEY"
```

### Via the TypeSafe AI

Get an API key from [TypeSafe AI](https://docs.typesafe.ai/introduction/quickstart) and set `TYPESAFE_API_KEY` environment variable. Add this plugin configuration to `opencode.jsonc`:

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
            "enabled": true,
          },
        },
      },
    },
  ],
}
```

## Options

| Option                           | Description                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `endpoint`                       | SystemOne HTTP endpoint.                                                                               |
| `model`                          | Model sent in each classification request.                                                             |
| `integration`                    | OpenCode integration whose credential takes precedence over `apiKeyEnv`.                               |
| `apiKeyEnv`                      | Environment variable to read if no integration credential is available.                                |
| `allowProbability`               | Minimum `withinPolicy` probability required to allow a command.                                        |
| `violationProbability`           | Probability at or above which a filesystem, remote-mutation, or credential violation denies a command. |
| `timeoutMs`                      | Timeout for one request attempt.                                                                       |
| `maxAttempts`                    | Maximum attempts for network, timeout, rate-limit, and server failures.                                |
| `retryDelayMs`                   | Delay between retry attempts.                                                                          |
| `cache.capacity`                 | Maximum number of cached classification results.                                                       |
| `cache.ttlMs`                    | Successful classification cache lifetime in milliseconds.                                              |
| `agents.<name>.enabled`          | Enables classification for an agent.                                                                   |
| `agents.<name>.thresholds`       | Optional per-agent probability thresholds.                                                             |
| `agents.<name>.http`             | Optional. Omission permits no HTTP methods or credential hosts.                                        |
| `agents.<name>.http.methods`     | HTTP methods the policy permits.                                                                       |
| `agents.<name>.http.credentials` | Environment credential names mapped to allowed HTTPS hosts.                                            |

Set at least one of `integration` or `apiKeyEnv`.

The plugin sends the selected credential to `endpoint`. Check the URL when
configuring a custom endpoint.

See [development.md](docs/development.md) for local tests and publishing.
