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

1. **Open** an Upwork talent search page (e.g. [Upwork talent search](https://www.upwork.com/nx/search/talent/?loc=united-states&q=react&page=1)).
2. **Click the extension icon** to open the popup.
3. **Scan this page** – finds profile links matching `a.profile-link`, `data-test="UpLink"`, `href="/freelancers/~..."` (about 10 per page).
4. **Open all in new tabs** – opens each found profile in a new tab (background tabs).
5. **Next page** – navigates the same tab to the next `page=` (e.g. 1 → 2).

Workflow: scan → open all in new tabs → next page → (after load) scan again → open all → repeat.

## Cloudflare

Upwork is behind Cloudflare. The extension **cannot** solve challenges for you.

- If a **Cloudflare challenge** appears (e.g. “Checking your browser”), complete it **manually** in that tab.
- After you pass the check, use the extension again (e.g. **Scan this page** or **Open all in new tabs**).

The popup shows a reminder: *“If you see a Cloudflare challenge, complete it in the tab and try again.”*

## Files

| File            | Role                                                                 |
|-----------------|----------------------------------------------------------------------|
| `manifest.json` | Extension config, permissions, content script on Upwork talent URLs |
| `content.js`    | Runs on search pages; finds profile links and handles page/next URL  |
| `popup.html/css/js` | Popup UI: scan, open tabs, next page                            |
| `background.js` | Service worker; opens many tabs when you click “Open all in new tabs”|

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
