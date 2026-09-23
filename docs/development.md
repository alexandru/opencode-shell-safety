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

## GitHub Actions setup

In the `alexandru/opencode-shell-safety` repository, add `OPENCODE_API_KEY`
under **Settings > Secrets and variables > Actions**. The workflows use it for
real SystemOne integration tests. Publishing needs no npm token secret.

The [test workflow](../.github/workflows/test.yml) runs the typecheck and unit
tests on pull requests. Pushes to `main` also run integration tests. Pull
requests do not receive the secret.

## Publishing

In the npm package settings, add a [trusted publisher](https://docs.npmjs.com/trusted-publishers)
for GitHub user `alexandru`, repository `opencode-shell-safety`, and workflow
filename `publish.yml`. Permit direct `npm publish` when adding it.

To release, change the version in `package.json` and update `bun.lock`.
Start the [publish workflow](../.github/workflows/publish.yml) manually from
the Actions tab on `main`. It runs the full test suite and
`bun pm pack --dry-run` before publishing through npm's trusted publisher.
npm rejects an already published version.
