# IG grid preview for Notion

A tiny hosted web app that reads a Notion database and renders it as a
3-column Instagram-style grid. You embed the deployed URL into a Notion
page with `/embed`, and every time you reload that page it pulls fresh
data straight from Notion.

## 1. Set up the Notion side

1. Go to notion.so/my-integrations, click **New integration**, name it
   (e.g. "IG Grid"), copy the **Internal Integration Token** — this is
   your `NOTION_TOKEN`.
2. Create (or open) your content database. It needs these properties,
   named exactly:
   - `Name` — title (used as the caption/alt text)
   - `Image` — a **Files & media** property (for images you upload
     directly to Notion), **or**
   - `Image URL` — a **URL** property (for an externally hosted image —
     see the Canva note below)
   - `Order` — number (controls grid position, lowest first)
   - `Status` — select, optional (Draft / Scheduled / Posted)
3. Open the database, click **`•••`** → **Connections** → add your
   integration so it can read the data.
4. Copy the database ID from its URL:
   `notion.so/yourworkspace/<this-32-character-string>?v=...` — this is
   your `NOTION_DATABASE_ID`.

### About Canva images

Canva doesn't give you a plain image URL by default. Two options:
- Export the design (PNG) and upload it into the `Image` files property
  in Notion — simplest, but you re-upload each time you change the design.
- In Canva, use **Share → More → Embed** or a public share link that
  resolves to a direct image, and paste that into `Image URL`. Test the
  link in an incognito browser tab first — if it doesn't show a bare
  image, it won't render in the grid.

## 2. Run it locally (optional, to test first)

```bash
npm install
cp .env.example .env.local
# fill in .env.local with your real token, database ID, and @username
npm run dev
```

Visit `http://localhost:3000` — you should see your grid.

## 3. Deploy it

Easiest path is Vercel (free tier is enough for this):

1. Push this folder to a GitHub repo.
2. Go to vercel.com → **New Project** → import that repo.
3. In the project's **Environment Variables** settings, add:
   - `NOTION_TOKEN`
   - `NOTION_DATABASE_ID`
   - `NEXT_PUBLIC_IG_USERNAME`
4. Deploy. You'll get a URL like `ig-notion-grid.vercel.app`.

## 4. Embed it in Notion

On any Notion page, type `/embed`, paste your Vercel URL, and resize the
embed block. Reloading that Notion page re-fetches the embed, which
re-runs the server-side Notion query — so any edit to your database
(new row, new image, reordered `Order` number) shows up on next reload,
no re-export or re-upload of the widget itself needed.

## Customizing

- Grid columns: change `gridTemplateColumns` in `pages/index.js`.
- Filter by status (e.g. only show "Scheduled"): add a `filter` block
  to the Notion query in `lib/notion.js`, inside the `body` JSON.
- Drag-to-reorder: would need to write back to Notion's `Order` field
  from the browser, which means adding a client-side drag library and
  a small API route that calls Notion's "update page" endpoint — good
  next step once the read-only version is working.
