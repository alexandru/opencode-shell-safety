# Development

## Setup

Install Bun 1.4.2 or newer and put the OpenCode v2 CLI on `PATH`.

```sh
bun ci
```

## Tests

`make test` runs the typecheck, unit tests, and integration tests. The integration
tests call SystemOne and need `OPENCODE_API_KEY` in your environment. To run
checks without an API key:

```sh
bun run check
bun run test
```

## GitHub Actions

Add `OPENCODE_API_KEY` as a repository secret under **Settings > Secrets and
variables > Actions**. The [test workflow](../.github/workflows/test.yml) runs
the typecheck and unit tests on pull requests, and all tests on pushes to this
repository's `main` branch.

## Dependencies

`make upgrade-dependencies` updates `package.json` to the latest exact versions,
including major upgrades, and refreshes `bun.lock`. Run `make test` afterward.

## Publishing

Change the version in `package.json`, authenticate with npm, and run
`make publish`. It runs the tests, previews the package with
`bun pm pack --dry-run`, then publishes to npm.
