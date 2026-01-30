# Upwork Talent Searcher – Chrome Extension

Chrome extension for Upwork talent search: scan a search results page, find freelancer profile links, and open them in new tabs. Supports pagination via **Next page**.

## Requirements

- Chrome (Manifest V3)
- Use on: `https://www.upwork.com/nx/search/talent/*` (e.g. `?loc=united-states&q=react&page=1`)

## Install (unpacked)

1. Open Chrome → **Extensions** → **Manage extensions** → enable **Developer mode**.
2. Click **Load unpacked** and select this folder (`upwork-scrapper`).
3. Go to an Upwork talent search page, then click the extension icon.

## Usage

### On talent search pages

1. **Open** an Upwork talent search page (e.g. [Upwork talent search](https://www.upwork.com/nx/search/talent/?loc=united-states&q=react&page=1)).
2. **Click the extension icon** to open the popup.
3. **Scan this page** – finds profile links matching `a.profile-link`, `data-test="UpLink"`, `href="/freelancers/~..."` (about 10 per page).
4. **Open all in new tabs** – opens each found profile in a new tab (background tabs). **Each new profile tab automatically finds and clicks the GitHub “View profile” button** once its DOM is ready (retries every 1.5s for ~21s), so GitHub opens in new tabs without any extra step.
5. **Next page** – navigates the same tab to the next `page=` (e.g. 1 → 2).
6. **Open GitHub on all profile tabs** – (optional) if you already have profile tabs open and they didn’t auto-click, this scans all open freelancer profile tabs and clicks “View profile” in each.

Workflow: **Scan** → **Open all in new tabs** → (tabs load and auto-click View profile) → **Next page** → repeat.

### On freelancer profile pages (GitHub)

1. **Open** a freelancer’s Upwork profile (e.g. from the search results).
2. **Click the extension icon** – the popup shows the “GitHub” section.
3. **Get GitHub link** – finds a link to the freelancer’s GitHub profile (any `a[href*="github.com"]` on the page, or in the GitHub section with title “GitHub”).
4. **Open GitHub profile** – opens that link in a new tab.

If the “View profile” button in the GitHub section uses `href="javascript:"` and the real URL is set only by script, the extension will still find the GitHub link if Upwork renders another visible link to `github.com` elsewhere on the page.

## Cloudflare

Upwork is behind Cloudflare. The extension **cannot** solve challenges for you.

- If a **Cloudflare challenge** appears (e.g. “Checking your browser”), complete it **manually** in that tab.
- After you pass the check, use the extension again (e.g. **Scan this page** or **Open all in new tabs**).

The popup shows a reminder: *“If you see a Cloudflare challenge, complete it in the tab and try again.”*

## Files

| File            | Role                                                                 |
|-----------------|----------------------------------------------------------------------|
| `manifest.json` | Extension config; content script on talent search + freelancer profile URLs |
| `content.js`    | Search pages: profile links + pagination. Profile pages: GitHub link in “GitHub” section |
| `popup.html/css/js` | Popup UI: search (scan, open tabs, next page); profile (get/open GitHub link) |
| `background.js` | Service worker; opens tabs when you click “Open all in new tabs” or “Open GitHub profile” |

## Optional: icons

To add a toolbar icon, create an `icons` folder and add `icon16.png` and `icon48.png`, then in `manifest.json` set:

```json
"action": {
  "default_popup": "popup.html",
  "default_icon": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png"
  }
}
```
