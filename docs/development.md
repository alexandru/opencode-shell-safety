# Development

## Local setup

Install Bun 1.4.2 or newer and the OpenCode v2 CLI. The integration tests start
`opencode serve`, so `opencode` must be on `PATH`. CI uses `@opencode/cli@2.0.12`.

From the repository root:

```sh
bun ci
bun run check
bun run test
```

The integration tests start isolated OpenCode servers and call the real
SystemOne API. Set `OPENCODE_API_KEY` in your environment, then run:

```sh
bun run test:e2e
```

`make test` runs the typecheck, unit tests, and integration tests together.
`make upgrade-dependencies` updates exact versions in `package.json` and
`bun.lock`. Run `make test` after an upgrade.

## GitHub Actions setup

In the `alexandru/opencode-shell-safety` repository, add `OPENCODE_API_KEY`
under **Settings > Secrets and variables > Actions**. The workflows use it for
real SystemOne integration tests.

The [test workflow](../.github/workflows/test.yml) runs the typecheck and unit
tests on pull requests. Pushes to `main` also run integration tests. Pull
requests do not receive the secret.

## Publishing

To release, change the version in `package.json` and authenticate locally with
npm. Run `make publish` from the repository root. It runs the full test suite,
checks the package contents with `bun pm pack --dry-run`, then runs
`npm publish --access public`. npm rejects an already published version.
