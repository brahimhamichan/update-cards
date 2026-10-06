# update-cards

Reusable HTML cards for agent updates, decisions, and next actions in T3, created for Brahim. JSON configs render into one self-contained HTML document (inline CSS, JS, and images; no framework, CDN, or network assets) that fits T3's inline `html_render` frame and follows its light/dark theme variables.

The repository is also a Codex/Claude skill (`SKILL.md`) named `update-cards`.

| Type | Purpose | Sends |
|---|---|---|
| `yes-no` | Approve or decline one thing | `{ answer, note? }` |
| `form` | Text, textarea, select, radio, checkbox fields | `{ <fieldId>: value, … }` |
| `checklist` | Tick items done/approved, with progress | `{ checked, unchecked, note? }` |
| `image-choice` | Pick one image or logo (grid of up to 24) | `{ choice, note? }` |
| `app-name-choice` | Pick a name, with taglines and a recommendation | `{ choice, note? }` |
| `bullet-points` | Status bullets with done/progress/blocked/next markers | — |
| `big-text` | One prominent number or outcome, optional CTA link | — |
| `explanation` | Steps, a simple flow, or a comparison | — |

Field reference: [references/card-schemas.md](references/card-schemas.md). Callback transport: [references/webhook-lifecycle.md](references/webhook-lifecycle.md).

## Requirements and install

Node 22 or newer; no npm dependencies.

```bash
git clone git@github.com:brahimhamichan/update-cards.git ~/code/update-cards
cd ~/code/update-cards
npm run ci:local
```

Install the skill by linking the checkout into your skills directory, e.g. `ln -s ~/code/update-cards ~/.codex/skills/update-cards` (or `~/.claude/skills/update-cards`).

## Render

```bash
node scripts/render.mjs --config examples/yes-no.json --output /tmp/card.html
node scripts/render.mjs -c examples/form.json -c examples/checklist.json -o /tmp/next-actions.html
node scripts/render.mjs --check examples/*.json
```

Without a webhook the output is a **preview**: controls work, nothing is sent (CSP blocks all network), and submitting shows the payload locally.

To send answers back, provision a T3 webhook and supply its URL from the environment or an untracked file — never argv:

```bash
node scripts/render.mjs -c card.json -o /tmp/card.html --webhook-env --request-id req_123   # reads exported UPDATE_CARDS_WEBHOOK_URL
node scripts/render.mjs -c card.json -o /tmp/card.html --webhook-file /tmp/hook.local.json   # {"webhookUrl": "https://…"}
```

The CLI prints a JSON summary (mode, requestId, card ids, warnings) and never prints the URL.

### API

```js
import { loadCard, renderCards, validateCard } from './src/index.mjs';

const { html, mode, requestId, cards, warnings } = renderCards(
  [loadCard('examples/yes-no.json'), loadCard('examples/big-text.json')],
  { webhookUrl, requestId: 'req_123' }, // both optional; requestId is required with webhookUrl
);
```

`loadCard` resolves relative image paths against the config file; `renderCards` also accepts plain config objects (`options.baseDir` resolves their relative image paths).

## Demo gallery

```bash
npm run build:demo        # dist/index.html, dist/all-cards.html, dist/cards/*.html
python3 -m http.server -d dist 8080   # or any static server; index.html also works from file://
```

The gallery shows every example with width (fluid/728/320) and theme (system/light/dark) toggles. All examples are demo data in preview mode, so nothing can be sent while browsing. Bundled logos come from [Simple Icons](https://github.com/simple-icons/simple-icons) (see `assets/logos/ATTRIBUTION.md`).

## Layout

```
SKILL.md, agents/openai.yaml, references/   skill entrypoint and references
src/index.mjs        renderer API (renderCards, loadCard, validateCard)
src/schema.mjs       strict config schemas
src/templates/       one module per card type
src/styles.css       the shared stylesheet
src/client/          response runtime (core.mjs is pure and unit-tested; dom.mjs wires the page)
scripts/             render.mjs (CLI), build-demo.mjs
examples/, assets/   starter configs and offline demo images
test/                node:test suites (unit, CLI, headless-browser runtime)
```

## Verification

`npm run ci:local` validates every example, runs the test suite (the browser runtime test uses the Playwright-installed headless Chromium, or `CHROME_PATH`, and skips when neither exists), and builds the demo. There is no GitHub Actions workflow by design.
