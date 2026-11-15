# Personal Archive

A personal portfolio with a WebGL black hole, selected work, linked services, and a cinema wall.

## Edit your content

Personal text, project entries, services, and links live in `profile.js`. The homepage is in `index.html`; the complete film archive is in `cinema.html`; visual styling is shared through `styles.css`.

The cinema archive is generated from the public Douban collection in `data/films.json`. Its importer follows the field and pagination approach of [UlyC/DouBanExport](https://github.com/UlyC/DouBanExport) (MIT), updated for the current markup and static JSON output. To refresh it:

```powershell
python tools/import_douban.py 209420532 --ffmpeg C:\path\to\ffmpeg.exe
```

The WebGL renderer in `black-hole.js` adapts the viewer from [sayed1145/glsl-black-hole at 4f21a8d](https://github.com/sayed1145/glsl-black-hole/tree/4f21a8d393cce82ad1ca323ec1acda05f6f570f9). The vendored shaders retain their MIT license. The homepage changes the composition, timing, and color grade. A shared table of ray paths lets pointer input change the viewing angle without tracing every ray again.

## Preview locally

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

Append `?look=mono` to preview the monochrome black hole.

## GitHub Pages

The included workflow deploys the site when `main` is pushed. For a personal homepage, name the GitHub repository `<username>.github.io` and enable GitHub Pages with **GitHub Actions** as the source.
