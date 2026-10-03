# Releasing

Versions are managed with [Changesets](https://github.com/changesets/changesets). Publishing runs only by hand, from GitHub Actions, with [npm provenance](https://docs.npmjs.com/generating-provenance-statements).

1. After a change, run `pnpm changeset`, pick the packages and the bump type, and commit the generated file.
2. When you are ready to release, run `pnpm version-packages`. It bumps the versions, updates the changelogs and fixes internal ranges. Commit the result and merge it to `main`.
3. Go to **Actions → Release → Run workflow**. Leave "Really publish" unchecked for a dry run, then run it again with it checked. `scripts/publish.mjs` publishes every package whose version is not on npm yet, dependencies first, with `pnpm publish --provenance --access public` (pnpm calls `npm publish` and rewrites `workspace:^` ranges).

## One-time npm setup

The workflow has `permissions: id-token: write` and runs in the GitHub environment `npm`, so you can add protection rules such as required reviewers.

- **First publish of new names** (`formgong`, `@formgong/core`, `@formgong/vue`, `@formgong/svelte`, `@formgong/astro`, `@formgong/next`):
  1. Create a granular access token on npmjs.com for the `formgong` user, with read and write access to the `@formgong` scope and the `formgong` and `create-formgong` packages, and bypass 2FA for automation.
  2. Store it as the repository (or `npm` environment) secret `NPM_TOKEN`.
- **Then switch to trusted publishing (recommended):**
  1. On npmjs.com, open each package → Settings → Trusted publishing → GitHub Actions. Set organization `formgong`, repository `js`, workflow `release.yml` and environment `npm`.
  2. Delete `NPM_TOKEN`. npm then authenticates with OIDC and adds provenance automatically. This requires npm ≥ 11.5.1, which the workflow installs.
- `@formgong/react` and `create-formgong` were first published from `formgong/react` and `formgong/create-formgong`. Provenance for 0.2.0 will point to `formgong/js`, which is expected. After the first release from this repo, archive the old repos with a pointer here.

## Local checks

```bash
pnpm install
pnpm build && pnpm typecheck && pnpm test
node scripts/publish.mjs                                   # dry run of what would be published
FORMGONG_BASE_URL=https://formgong.com FORMGONG_ACCESS_KEY=fk_… node scripts/e2e.mjs   # submit e2e
FORMGONG_TOKEN=fgp_… node scripts/e2e.mjs                  # + CLI e2e (creates a temporary form)
```
