# جابینجا سوایپ · Jobinja Swipe

A minimal, installable PWA for browsing public [Jobinja](https://jobinja.ir/jobs) and [Jobvision](https://jobvision.ir/jobs) job posts one card at a time.

- **Swipe left** → skip
- **Swipe right** → open the exact job posting on its source site
- **Keyword filter** → search title, company, skills, category, and description
- **Source filter** → show all jobs, Jobinja only, or Jobvision only
- **Keyboard** → `←` skip, `→` apply, `Z` undo, `Esc` clear filters
- Shows the job title, company, location, contract, salary, and description
- Applying always happens on the source site. The app never asks for or stores Jobinja or Jobvision credentials.
- Swipe decisions and progress stay in `localStorage`.
- Installable as a PWA and usable offline after the first load.

Live app: <https://dg-run.github.io/jobinja-swipe/>

## How it works

`public/data/jobs.json` is a snapshot of public job posts from both sources. The UI is a static React app; there is no account system and no backend.

- **Jobinja** is read through Google Translate's read-only proxy (`jobinja-ir.translate.goog`) because Jobinja blocks non-Iranian IPs.
- **Jobvision** is read from its public jobs API (`candidateapi.jobvision.ir`) and job detail pages.

The proxies are only used while generating the snapshot; the deployed app loads the checked-in JSON. If a source fails during refresh, the script keeps that source's jobs from the previous snapshot.

Applying always happens on the source site:

1. The user swipes right or presses the apply button.
2. The app opens the exact job posting URL in a new tab (`jobinja.ir/companies/...` or `jobvision.ir/jobs/...`).
3. The user signs in if needed and sends their resume there.

The app does not automate login, form submission, or SMS verification. This keeps credentials out of the app and leaves the final application action with the user.

## Development

```bash
npm install
npm run dev
```

Open the URL printed by Vite (the app uses the `/jobinja-swipe/` base path).

```bash
npm run typecheck
npm run build
npm run build:pages
npm run preview
```

`build:pages` builds the app and copies the result to `docs/`, which is the GitHub Pages source for this repository.

## Refresh the job snapshot

```bash
npm run refresh:jobs
```

Optional environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PAGES` | `4` | Jobinja list pages to read (20 posts each) |
| `LIMIT` | `72` | Maximum number of Jobinja jobs to keep |
| `DETAILS` | on | Set to `0` to skip Jobinja detail pages |
| `CONCURRENCY` | `2` | Parallel detail requests |
| `JV_PAGES` | `3` | Jobvision list pages to read (30 posts each) |
| `JV_PAGE_SIZE` | `30` | Jobvision page size |
| `JV_LIMIT` | `90` | Maximum number of Jobvision jobs to keep |
| `JV_DETAILS` | on | Set to `0` to skip Jobvision detail requests |

The script interleaves Jobinja and Jobvision jobs so both sources appear early in the deck.

## Deployment

The live site is served from the committed `docs/` folder on `main`:

1. Run `npm run build:pages`.
2. Commit `docs/`.
3. Push to `main`.

GitHub Pages is configured as **Deploy from a branch → `main` → `/docs`**. The `docs/.nojekyll` file is written by the build script.

To publish from a fork, update `base` in `vite.config.ts` to the fork's repository name, then repeat the steps above and point Pages at `docs/`.

## Optional automation

The repository includes GitHub Actions templates in `deploy/github-actions/`:

- `deploy.yml` builds and deploys the PWA.
- `refresh-jobs.yml` refreshes the job snapshot weekly.

A personal access token needs the `workflow` scope to push files under `.github/workflows/`. Without that scope, use the `docs/` deployment flow above and run `npm run refresh:jobs` manually.

## Privacy

- No analytics, no cookies, no server.
- No Jobinja or Jobvision email, password, OTP, or session cookie is collected.
- Swipe history is stored only in the browser's `localStorage`.
- Job logos are loaded from the sources' CDNs and cached by the service worker.

## Disclaimer

This is an independent project and is not affiliated with, endorsed by, or supported by Jobinja or Jobvision. Their public pages, APIs, and markup can change at any time. Use the app responsibly and follow each site's terms and robots/access policies. If you need guaranteed current data or a supported integration, use Jobinja or Jobvision directly.

## License

MIT
