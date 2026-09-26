# Tangydust

Your business hub — a dark, premium, animated website that showcases all of your
subsidiary websites in one place. Each site is a card; clicking a card opens a
detail page describing the site, with a launch card on top ("Open website" and a
"Try it" button) that takes visitors straight to the site through your referral link.

## Features

- **Dark & premium design** with smooth animations (hover spotlights, scroll reveals, animated aurora background)
- **Optional login** — visitors can browse everything without signing in
- **Admin account** (first login) to manage everything:
  - Add / edit / delete site cards
  - Set name, tagline, description, referral link and accent color for each site
  - Upload or link a logo for each site
  - Add and remove demo images (screenshots) for each site
- **Demo gallery with lightbox** on every site page
- No build step, no dependencies — plain HTML/CSS/JS on GitHub Pages

## Getting started (admin)

1. Open the site and click **Sign in** (top right).
2. Log in with the default admin account:
   - Username: `admin`
   - Password: `tangydust-admin`
3. Go to **Admin** and change the password in **Settings**.

## How editing works

Edits you make in the Admin panel are saved in **your browser** (localStorage),
so your own experience updates instantly. To publish your changes for **all
visitors**, use **Admin → Settings → "Publish changes for everyone"**: it
downloads a fresh `defaults.js` file. Replace `js/defaults.js` in this repository
with that file, commit, and GitHub Pages updates within a minute.

> Note: this is a static site on GitHub Pages, so login is a lightweight
> client-side gate (passwords are hashed and stored in your browser). If you
> later need real multi-user accounts with a shared database, the site can be
> connected to a backend (e.g. Firebase or Supabase).

## Structure

```
index.html        — page shell, modals, lightbox
css/style.css     — dark premium theme & animations
js/app.js         — routing, rendering, auth, admin panel
js/defaults.js    — default sites & admin hash (replace to publish)
```
