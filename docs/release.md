# Release Guide

This repo uses Changesets for versioning and package publishing.

## Prerequisites

- Node.js `>=20`
- pnpm `9.x`
- npm publish permission for `@webmcp/*`

## Daily Development Flow

When you change anything under `packages/*` that should be released:

1. Add a changeset:

```bash
pnpm changeset
```

2. Commit the generated file under `.changeset/*.md` with your code changes.

## Release Preparation

Run full quality checks first:

```bash
pnpm lint
pnpm -r test
pnpm -r build
pnpm check:manifests
```

Then apply version bumps:

```bash
pnpm version-packages
```

This updates package versions and changelogs based on pending changesets.

Commit the version bump:

```bash
git add .
git commit -m "release: version packages"
```

## Publish

Publish public packages:

```bash
pnpm release
```

`pnpm release` maps to `changeset publish`.

## Optional CI/CD Pattern

Recommended GitHub release automation pattern:

1. CI validates push/PR (`.github/workflows/ci.yml`).
2. On main, a release workflow runs `changeset version` and opens a release PR.
3. Merging release PR triggers `changeset publish`.

This repo already includes CI checks; you can add an automated publish workflow later if needed.

## Automated GitHub Release Workflow

This repo includes `.github/workflows/release.yml`.

Behavior on push to `main`:

1. Install deps and run full verification (`lint`, `test`, `build`, `check:manifests`).
2. Run Changesets action:
   - if there are pending changesets, open/update a version PR (`chore: version packages`)
   - if version packages are already committed on `main`, publish to npm

Required repository secrets:

- `NPM_TOKEN`: npm automation token with publish permission for `@webmcp/*`

`GITHUB_TOKEN` is provided automatically by GitHub Actions.

## Troubleshooting

### No packages published even after `pnpm release`

- Ensure there are pending changesets before versioning.
- Ensure `package.json` is not `private: true` for packages intended to publish.

### Wrong files in published package

- Verify each package `files`, `exports`, `main`, and `types` fields.
- Run `pnpm check:manifests`.

### Accidentally forgot a changeset

- Add a new changeset in a follow-up PR.
- Avoid manual version edits; keep changesets as the source of truth.
