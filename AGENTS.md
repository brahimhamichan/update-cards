# update-cards

- This repository belongs to Brahim (`brahim@scalingadventures.com`).
- Build reusable, self-contained HTML documents for T3's inline `html_preview` and `html_render` tools. Keep HTML, CSS, and JavaScript inline in generated output; no CDN or framework dependency is needed.
- Use a shared design system and response transport across templates. Support light/dark T3 theme variables, 320–1144px widths, keyboard interaction, semantic labels, and honest sending/error states.
- Card submissions collect user decisions; they must not silently perform deployments, purchases, or other external actions.
- Never commit real webhook URLs, tokens, user form responses, local machine paths, generated proof, or scratch briefs. Use placeholders and a runtime webhook configuration.
- Include a documented `npm run ci:local` command covering the project's meaningful tests and validation. Do not create GitHub Actions workflows.
- Do not commit or push from delegated implementation workers. The parent owns review, verification, commits, and delivery.
- Writing subagents use isolated worktrees, or run sequentially with explicit file ownership. They are not alone in the codebase; do not revert others' edits.
