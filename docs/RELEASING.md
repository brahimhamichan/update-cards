# Release checklist

Releases are manual. A version in `package.json` does not mean that a Git tag, public repository, GitHub Release, or npm package exists.

1. Confirm the target version and explicit authorization for each outward-facing step. Keep the repository private until Brahim explicitly approves a visibility change. Merge only a reviewed pull request; do not infer approval to publish from a merge.
2. Update the package version and changelog for the agreed release. Add the release date when the release is made, and check that repository links and install instructions match the intended distribution.
3. Use Node.js 22 or newer and run the complete local check:

   ```bash
   npm run ci:local
   ```

   Confirm the browser runtime tests ran with **zero skips**. They need headless Chromium, available through `CHROME_PATH` or the Playwright browser cache at `~/.cache/ms-playwright`. Review `SKILL.md` frontmatter and links, and validate all shipped examples with `node scripts/render.mjs --check examples/*.json`.

4. Review the package contents without creating or publishing an archive:

   ```bash
   npm pack --dry-run --json
   ```

   Check the listed files for the intended renderer, skill, references, examples, license, and documentation. Make sure local configuration, webhook data, generated proof, scratch files, and credentials are absent.
5. Review the working tree and reachable history for webhook URLs, tokens, user responses, private data, machine-specific paths, and generated proof. Do not print or paste secret values into logs or issues. If sensitive data has entered history, keep the repository private and resolve that exposure before any visibility change.
6. Merge the reviewed release changes to the confirmed default branch. Only after explicit visibility approval, switch the repository to public. Verify the HTTPS clone works, identify the actual default branch, and check that README install links and issue links resolve from a signed-out browser.
7. Upload `assets/brand/social-preview.png` in GitHub Settings → Social preview once a first upload is permitted. Check the repository description and topics, the README hero and badges, and the complete issue templates on the default branch.
8. Create and push a version tag and GitHub Release manually only when Brahim requests that release. Use the matching changelog entry as its notes. GitHub release publication and `npm publish` are separate actions; publish to npm only when the request explicitly includes it and the package metadata is ready.

This checklist does not assume hosted CI, automated security scans, or automated publishing.
