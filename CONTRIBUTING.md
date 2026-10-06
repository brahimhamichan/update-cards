# Contributing

Thanks for helping improve update-cards. Bug reports and feature ideas can use the GitHub issue templates. Report security vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Development

The project uses Node.js 22 or newer and has no npm dependencies. Run the local checks before opening a pull request:

```bash
npm run ci:local
```

This validates the example configs, runs the tests, and builds the demo gallery. The browser runtime tests need headless Chromium; set `CHROME_PATH` to its executable or use the Playwright browser in `~/.cache/ms-playwright`. Without Chromium those tests are skipped, so include a browser run when changing browser behavior.

For smaller changes, the individual commands are `npm run validate`, `npm test`, and `npm run build:demo`.

## Changes to cards

Keep rendered documents self-contained and compatible with T3's inline HTML renderer. Preserve keyboard use, semantic labels, light and dark themes, and layouts from 320px through 1144px. For a new card type, update its schema, renderer, example, reference, and meaningful tests.

Input callbacks use `no-cors`, so the browser cannot confirm that T3 accepted a response. Keep the interface honest about this and validate callback data as untrusted input; see [the webhook lifecycle](references/webhook-lifecycle.md).

## Pull requests

Keep each change focused. Describe the behavior and local checks in the pull request, and include rendered screenshots for visible changes. Do not include webhook URLs, tokens, user responses, machine-specific paths, generated proof data, or private customer information.

Contributions are provided under the repository's MIT License. Contributors retain their copyright and are responsible for having the rights to submit their work. Bundled Simple Icons data remains CC0-1.0 as noted in [its attribution file](assets/logos/ATTRIBUTION.md); brand names and logos remain the trademarks of their owners.
