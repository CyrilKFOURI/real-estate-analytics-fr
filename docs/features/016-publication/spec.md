# 016 Publication (GitHub, GitHub Pages, Hugging Face)

Make the project public without publishing anything the DVF conditions forbid.

## What goes where
| What | Where | Notes |
|---|---|---|
| Code, docs, tests | GitHub repository | no data, no secrets, no model weights (all gitignored; history audited) |
| Web app + KPI files (aggregates, ≥ 10 sales) | GitHub Pages, `gh-pages` branch | `scripts/publish-site.sh`; `robots.txt` disallows all, every page `noindex` |
| Price model (`rea-price-check-fr`) | Hugging Face model repo | aggregates only (areas ≥ 10 sales, tree leaves ≥ 200 sales); model card with licence and DVF conditions |
| Individual DVF sales | nowhere | the comparables API stays local |

## Licences
Code and model: MIT. Data sources keep their own licences (DVF, ANIL, INSEE, ADEME: Licence Ouverte /
Etalab 2.0; OLL: see observatory terms) and are credited in the README and on the Méthode page.

## CI
GitHub Actions on push and PR: pipeline tests (uv), ml tests (uv), app tests + typecheck + lint (npm),
extension tests (node). No data download in CI: every test uses fixtures.

## Publishing (needs the user's explicit go, each time)
- `git push` to a new GitHub repository (gh CLI is logged in as the user).
- `scripts/publish-site.sh --push` for the site.
- `hf upload <user>/rea-price-check-fr <model folder>` after `hf auth login` by the user.
