# Agent workflow

Every time a task is finished, before reporting:

1. `npx tsc --noEmit`
2. Rebuild the static site: `npm run build` (writes `dist/`).
3. Commit and push **both** repos:
   - the repo root (whole game),
   - `dist/` is a nested git repo — the frontend served by GitHub Pages
     (`github.com/LaEsperantisto/survival-of-the-fittest-frontend`);
     commit there with the same changes (the repo root *is* the site root —
     `index.html` + `assets/`, never a nested `dist/` folder).
