# Card config reference

Source of truth: `src/schema.mjs`. Unknown keys are errors. Check a config with `node scripts/render.mjs --check <file>`.

## Choosing a type

| Need | Type | Returns an answer? |
|---|---|---|
| One decision, yes or no | `yes-no` | yes |
| Several inputs at once | `form` | yes |
| Confirm a list of checks | `checklist` | yes |
| Pick from logos, screenshots, or images | `image-choice` | yes |
| Pick a product or feature name | `app-name-choice` | yes |
| Share progress or status | `bullet-points` | no |
| Highlight one number | `big-text` | no |
| Explain a process, plan, or tradeoff | `explanation` | no |

## Common fields

| Field | Limits | Notes |
|---|---|---|
| `type` | required | One of the types above |
| `id` | required, ≤64 | Letters, digits, `_ . : -`; starts with a letter or digit |
| `title` | required, ≤160 | Keep to ~70 characters |
| `eyebrow` | ≤40 | Small label above the title |
| `body` | ≤600 | Intro text |
| `tone` | `neutral` (default), `info`, `success`, `warning`, `danger` | Accent color |
| `index` | 1–99 | Number badge for ordering several cards |

Text fields support `` `code` `` spans and blank-line paragraphs. No HTML. Link `href` values must be absolute http(s) or mailto URLs.

## Shared input fields

Available on `yes-no`, `form`, `checklist`, `image-choice`, `app-name-choice`.

| Field | Limits | Notes |
|---|---|---|
| `submitLabel` | ≤32 | Submit button text |
| `allowNote` | boolean | Adds an optional free-text note; sent as `values.note` |
| `noteLabel` | ≤60 | Note field label |
| `notePlaceholder` | ≤120 | Note field placeholder |

## yes-no

Extra: `yesLabel` (≤24), `noLabel` (≤24), `destructive` (boolean, styles Yes as risky).
Values: `{ answer: "yes" | "no", note? }`. Start from `examples/yes-no.json`.

## form

`fields` (required, 1–12, unique `id`). Each field: `id`, `type`, `label` (≤80) required; `help` (≤160), `required`, `default`.

| `type` | Extra fields | Value |
|---|---|---|
| `text` | `placeholder`, `maxLength` (1–5000), `inputType` (`text`, `email`, `url`, `number`, `tel`) | string |
| `textarea` | `placeholder`, `maxLength`, `rows` (2–10) | string |
| `select` | `options` (2–12) | string |
| `radio` | `options` (2–12) | string, or `null` if unanswered |
| `checkbox` with `options` | `options` (1–12) | `string[]` |
| `checkbox` without `options` | none | boolean |

Options: `{ value (≤64), label (≤80) }`, unique `value`. `default` must match the field: string (and an existing option value for select/radio), boolean for a single checkbox, `string[]` of option values for a checkbox group.
Values: `{ <fieldId>: ..., note? }`. Start from `examples/form.json`.

## checklist

`items` (required, 1–20, unique `id`): `id`, `label` (≤140) required; `detail` (≤240), `checked` (pre-checked), `href`, `linkLabel` (≤40). `minChecked` (0–20, not above item count) blocks submit until enough are checked.
Values: `{ checked: [ids], unchecked: [ids], note? }`. Start from `examples/checklist.json`.

## image-choice

`options` (required, 2–24, unique `id`): `id`, `src` (≤4096), `alt` (≤160) required; `caption` (≤60). `aspect`: `1:1`, `4:3`, `16:9`. `imageBackground`: `light`, `dark`, `none`.
`src` is a local file path (relative to the config file via `loadCard`, or absolute) or an image `data:` URI; files are inlined at render (≤350 kB each). Remote URLs are not fetched: they render the visible "Image unavailable" state with a warning, as do missing files. `imageBackground` `light`/`dark` pads images on a neutral well (good for logos); `none` fills the frame (photos). Bundled demo logos live in `assets/logos/`.
Values: `{ choice: id, note? }`. Start from `examples/image-choice.json`.

## app-name-choice

`options` (required, 2–12, unique `id`): `id`, `name` (≤40) required; `tagline` (≤90), `rationale` (≤240), `recommended` (at most one option).
Values: `{ choice: id, note? }`. Start from `examples/app-name-choice.json`.

## bullet-points (read-only)

`items` (required, 1–12): `text` (required, ≤240), `detail` (≤240), `status` (`done`, `progress`, `blocked`, `next`, `info`), `href`, `linkLabel` (≤40). `footer` (≤240).
No payload. Start from `examples/bullet-points.json`.

## big-text (read-only)

`value` (required, ≤24), `label` (≤80), `supporting` (≤240), `delta` `{ text (required, ≤24), direction: up|down|flat, tone }`, `cta` `{ label (required, ≤40), href (required) }`.
No payload. Start from `examples/big-text.json`.

## explanation (read-only)

`variant` is required and decides which list is used; the other two lists are errors.

| `variant` | Field | Items |
|---|---|---|
| `steps` | `steps` (2–8) | `title` (required, ≤80), `detail` (≤240), `more` (≤600, expandable) |
| `flow` | `nodes` (2–6) | `label` (required, ≤40), `detail` (≤120) |
| `comparison` | `columns` (2–3) | `title` (required, ≤60), `summary` (≤160), `recommended`, `points` (1–6) |

A comparison `points` entry is a string or `{ text (≤160), kind: pro|con|neutral }`. Optional on any variant: `reveal` `{ label (required, ≤60), body (required, ≤1200) }`, an expandable section.
No payload. Start from `examples/explanation-steps.json`, `examples/explanation.json` (flow), or `examples/explanation-comparison.json`.

See [webhook-lifecycle.md](webhook-lifecycle.md) for the payload envelope and callback handling.
