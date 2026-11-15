# Neon-noir personal site

A zero-build static portfolio designed for GitHub Pages.

## Personalize

Edit `profile.js` to change your name, handle, bio, links and project cards. The active animated hero is `assets/neon-hologram-hero-v3.png`; earlier generated concepts are retained for easy rollback.

## Preview locally

From this folder, run:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Publish with GitHub Pages

1. Create a repository named `<username>.github.io` for your main personal site, or any repository name for a project site.
2. Push these files to the `main` branch.
3. In repository **Settings → Pages**, choose **GitHub Actions** as the source.
4. The included workflow deploys on every push to `main`.

For a custom domain, configure it in **Settings → Pages** and then add the required DNS records at your domain provider.

## Visual asset

`assets/neon-hologram-hero-v3.png` is a darker, particle-rich pixel-art transformation of a user-provided reference image. CSS and Canvas layers add hologram breathing, pixel dust, scan-band glitches and pointer parallax without shipping a heavy video or GIF.
