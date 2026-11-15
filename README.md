# Personal Archive

A personal portfolio built around an original WebGL black-hole shader, a clear introduction, selected work, linked services, and a curated cinema wall.

## Edit your content

All personal text, project entries, services, links, and films live in `profile.js`. The page structure is in `index.html`; visual styling is in `styles.css`; the animated black hole is rendered with WebGL in `script.js`.

## Preview locally

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

## GitHub Pages

The included workflow deploys the site when `main` is pushed. For a personal homepage, name the GitHub repository `<username>.github.io` and enable GitHub Pages with **GitHub Actions** as the source.
