# Domain Docs

Single-context layout: `GLOSSARY.md` and `docs/adr/` at the repo root.

## Before exploring, read these

- `GLOSSARY.md`: read the repo's domain vocabulary.
- `docs/adr/`: read ADRs that touch the area you're about to work in.

If any of these files don't exist, proceed silently. Don't flag their
absence; don't suggest creating them upfront. The `/domain-modeling`
skill creates them lazily when terms or decisions actually get resolved.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor
proposal, a hypothesis, a test name), use the term as defined in
`GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, reconsider whether
you're inventing language the project doesn't use, or note the gap
for `/domain-modeling`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly
rather than silently overriding:

> Contradicts ADR-0007, but worth reopening because…
