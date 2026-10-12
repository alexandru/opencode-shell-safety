# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues in
`alexandru/opencode-shell-safety`. Use the `gh` CLI for all operations.

## Conventions

Run commands from this repository so `gh` infers the repo from its remote.

- Create: `gh issue create --title "..." --body "..."`
  Use a heredoc for multi-line bodies.
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open --json number,title,body,labels,comments`
  Use appropriate `--label` and `--state` filters.
- Comment: `gh issue comment <number> --body "..."`
- Apply / remove labels: `gh issue edit <number> --add-label "..."`
  / `--remove-label "..."`
- Close: `gh issue close <number> --comment "..."`

## Pull requests as a triage surface

**PRs as a request surface: no.**

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.
