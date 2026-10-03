# Workflows to enable

`ci.yml` (tests on every push and PR) and `release.yml` (manual npm publish with provenance) belong in `.github/workflows/`. They were committed here because the token that created the repository could not write workflow files (it lacked the GitHub `workflow` scope).

Enable them with one move, from a token or a person with workflow permission:

```bash
git mv .github/workflows-to-enable/ci.yml .github/workflows/ci.yml
git mv .github/workflows-to-enable/release.yml .github/workflows/release.yml
git commit -m "ci: enable CI and release workflows" && git push
```

`release.yml` runs only on manual dispatch and defaults to a dry run. See [RELEASING.md](../../RELEASING.md) for the NPM_TOKEN / trusted-publisher setup.
