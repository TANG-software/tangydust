/* ============================================================
   Tangydust — default content.
   This file ships with the site. When you edit sites/images in
   the Admin panel, use "Publish changes for everyone" in
   Settings to download a fresh copy of this file, then replace
   it in the repository to make your changes visible to all
   visitors (not just your own browser).
   ============================================================ */
window.TANGYDUST_DEFAULTS = {
  brand: "Tangydust",
  admin: {
    username: "admin",
    // SHA-256 of the initial password. Change the password after
    // your first sign-in — the new hash is stored in your browser.
    passHash: "a0f91469a2f4411ccdd641b04871abbeeddda785bab175a42bee2e461c4ebd90",
    mustChange: true
  },
  sites: [
    {
      id: "sample-aurora",
      name: "Aurora Notes",
      tagline: "Your thoughts, beautifully organised.",
      description:
        "Aurora Notes is a calm, focused note-taking app. Capture ideas the moment they arrive, organise them with tags and notebooks, and find anything instantly with full-text search.\n\nBuilt for people who think better on a clean page.",
      url: "https://example.com/aurora-notes?ref=tangydust",
      accent: "#7dd3fc",
      logo: "",
      images: [
        "https://picsum.photos/seed/aurora1/1200/750",
        "https://picsum.photos/seed/aurora2/1200/750",
        "https://picsum.photos/seed/aurora3/1200/750"
      ]
    },
    {
      id: "sample-forge",
      name: "Pixel Forge",
      tagline: "Design tooling that keeps up with your imagination.",
      description:
        "Pixel Forge is a lightweight browser-based design studio. Sketch interfaces, build prototypes, and hand off clean specs to your team — no installs, no lock-in.\n\nThis is a sample entry. Sign in as admin to edit or remove it and add your own sites.",
      url: "https://example.com/pixel-forge?ref=tangydust",
      accent: "#c4b5fd",
      logo: "",
      images: [
        "https://picsum.photos/seed/forge1/1200/750",
        "https://picsum.photos/seed/forge2/1200/750"
      ]
    }
  ]
};
