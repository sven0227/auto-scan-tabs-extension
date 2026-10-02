/**
 * Content script for Upwork: talent search + freelancer profile pages.
 * Search: finds freelancer profile links. Profile: finds GitHub link in GitHub section.
 * Wrapped so the side panel can inject this file again on an already-open tab.
 */
(function () {

const PROFILE_ID_RE = /~([0-9a-f]{8,})/i;

function getBaseUrl() {
  return window.location.origin;
}

function normText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function profileIdFromHref(href) {
  if (!href || !/freelancer/i.test(href)) return null;
  const match = String(href).match(PROFILE_ID_RE);
  return match ? match[1].toLowerCase() : null;
}

function canonicalProfileUrl(id) {
  return `${getBaseUrl()}/freelancers/~${id}`;
}

function isInSiteChrome(el) {
  return !!el.closest('header, nav, footer');
}

function labelForProfileLink(el) {
  const own = normText(el.innerText || el.textContent);
  if (own && !/^view profile$/i.test(own) && own.length <= 90) return own.slice(0, 80);

  const card = el.closest(
    'article, li, [data-test*="tile" i], [data-test*="Tile"], [data-ev-label*="tile" i], [class*="freelancer-tile" i], [class*="profile-card" i]'
  );
  if (card && normText(card.innerText).length < 4000) {
    const heading = card.querySelector('h2, h3, h4, h5');
    const headingText = normText(heading && (heading.innerText || heading.textContent));
    if (headingText && headingText.length <= 120) return headingText.slice(0, 80);
  }

  if (/^view profile$/i.test(own)) {
    let parent = el.parentElement;
    for (let depth = 0; depth < 5 && parent; depth += 1, parent = parent.parentElement) {
      if (normText(parent.innerText).length >= 4000) break;
      const heading = parent.querySelector('h2, h3, h4, h5');
      const headingText = normText(heading && (heading.innerText || heading.textContent));
      if (headingText && headingText.length <= 120) return headingText.slice(0, 80);
    }
  }

  return own.slice(0, 80);
}

function addProfile(seen, results, href, text) {
  const id = profileIdFromHref(href);
  if (!id) return;
  const label = normText(text).slice(0, 80);
  if (seen.has(id)) {
    if (!label || /^view profile$/i.test(label)) return;
    const existing = results.find((item) => item.url.endsWith(`/~${id}`));
    if (
      existing &&
      (!existing.text || /^view profile$/i.test(existing.text) || existing.text === `~${id}`)
    ) {
      existing.text = label;
    }
    return;
  }
  seen.add(id);
  results.push({
    url: canonicalProfileUrl(id),
    text: label || `~${id}`,
  });
}

function queryAllDeep(selector, root) {
  const found = [];
  const visit = (node) => {
    if (!node || !node.querySelectorAll) return;
    node.querySelectorAll(selector).forEach((el) => found.push(el));
    node.querySelectorAll('*').forEach((el) => {
      if (el.shadowRoot) visit(el.shadowRoot);
    });
  };
  visit(root || document);
  return found;
}

/**
 * Collect freelancer profile links from the rendered search results.
 * One entry per profile id, so name + "View profile" on the same card count once.
 * @returns {{ url: string, text: string }[]}
 */
const PROFILE_LINK_SELECTOR =
  'a[href*="/freelancers/"], [href*="/freelancers/"], [data-href*="/freelancers/"], [data-url*="/freelancers/"]';

function collectProfileElements(elements, seen, results) {
  for (const el of elements) {
    if (isInSiteChrome(el)) continue;
    const href = el.getAttribute('href') || el.getAttribute('data-href') || el.getAttribute('data-url');
    if (!profileIdFromHref(href)) continue;
    addProfile(seen, results, href, labelForProfileLink(el));
  }
  return results;
}

function findProfilesInDom() {
  const seen = new Set();
  const results = [];
  collectProfileElements(document.querySelectorAll(PROFILE_LINK_SELECTOR), seen, results);
  if (results.length > 0) return results;
  collectProfileElements(queryAllDeep(PROFILE_LINK_SELECTOR), seen, results);
  return results;
}

function findProfilesInMarkup() {
  const seen = new Set();
  const results = [];
  const root = document.querySelector('main') || document.body;
  if (!root) return results;
  const re = /\/freelancers\/(~[0-9a-f]{8,})/gi;
  const html = root.innerHTML || '';
  let match = re.exec(html);
  while (match) {
    addProfile(seen, results, match[0], '');
    if (results.length >= 20) break;
    match = re.exec(html);
  }
  return results;
}

function findProfilesInScripts() {
  const seen = new Set();
  const results = [];
  let blob = '';
  document.querySelectorAll('script').forEach((script) => {
    const text = script.textContent || '';
    if (text.includes('ciphertext') || text.includes('/freelancers/~')) blob += `\n${text}`;
  });
  if (!blob) return results;

  const re = /"(?:ciphertext|profileCiphertext|freelancerCiphertext)"\s*:\s*"~?([0-9a-f]{8,})"/gi;
  let match = re.exec(blob);
  while (match) {
    const id = match[1].toLowerCase();
    const around = blob.slice(Math.max(0, match.index - 500), match.index + 500);
    const titleMatch = around.match(/"(?:title|shortName|profileName)"\s*:\s*"((?:\\.|[^"\\]){2,160})"/);
    const title = titleMatch ? titleMatch[1].replace(/\\"/g, '"').replace(/\\n/g, ' ') : '';
    addProfile(seen, results, `/freelancers/~${id}`, title);
    if (results.length >= 20) break;
    match = re.exec(blob);
  }
  return results;
}

function isProfileRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (typeof value.ciphertext === 'string' || typeof value.profileCiphertext === 'string') return true;
  return typeof value.profileUrl === 'string' && value.profileUrl.includes('/freelancers/');
}

function findProfilesInPageState() {
  const roots = [];
  try {
    if (window.__NUXT__) roots.push(window.__NUXT__);
  } catch (_) {}
  try {
    if (window.__NUXT_DATA__) roots.push(window.__NUXT_DATA__);
  } catch (_) {}
  try {
    if (window.$nuxt && window.$nuxt.$store && window.$nuxt.$store.state) {
      roots.push(window.$nuxt.$store.state);
    }
  } catch (_) {}
  if (roots.length === 0) return [];

  const arrays = [];
  const seenNodes = new WeakSet();
  let visited = 0;

  function walk(node, depth) {
    if (!node || typeof node !== 'object' || depth > 8 || visited > 8000) return;
    if (seenNodes.has(node)) return;
    seenNodes.add(node);
    visited += 1;

    if (Array.isArray(node)) {
      const hits = [];
      for (const item of node) {
        if (isProfileRecord(item)) hits.push(item);
      }
      if (hits.length >= 3 && hits.length <= 40 && hits.length / node.length >= 0.5) {
        arrays.push(hits);
      }
      for (const item of node) walk(item, depth + 1);
      return;
    }

    let values = [];
    try {
      values = Object.values(node);
    } catch (_) {
      return;
    }
    for (const value of values) {
      if (value && typeof value === 'object') walk(value, depth + 1);
    }
  }

  roots.forEach((root) => walk(root, 0));
  arrays.sort((a, b) => Math.abs(a.length - 10) - Math.abs(b.length - 10));
  const best = arrays[0] || [];
  const seen = new Set();
  const results = [];
  for (const profile of best) {
    const cipher = profile.ciphertext || profile.profileCiphertext || '';
    const fromUrl = typeof profile.profileUrl === 'string' ? profile.profileUrl : '';
    const href = /~[0-9a-f]{8,}/i.test(cipher) ? `/freelancers/${cipher.startsWith('~') ? cipher : `~${cipher}`}` : fromUrl;
    const text = profile.title || profile.shortName || profile.name || profile.profileName || '';
    addProfile(seen, results, href, text);
  }
  return results;
}

function findFreelancerProfileLinks() {
  try {
    const fromDom = findProfilesInDom();
    if (fromDom.length > 0) return fromDom;
  } catch (_) {}
  try {
    const fromMarkup = findProfilesInMarkup();
    if (fromMarkup.length > 0) return fromMarkup;
  } catch (_) {}
  try {
    const fromScripts = findProfilesInScripts();
    if (fromScripts.length > 0) return fromScripts;
  } catch (_) {}
  try {
    return findProfilesInPageState();
  } catch (_) {
    return [];
  }
}

function pageLooksBlocked() {
  const title = document.title || '';
  const body = normText(document.body && document.body.innerText).slice(0, 600);
  return /just a moment/i.test(title) || /cloudflare|checking your browser|verify you are human/i.test(body);
}

function scanTalentSearchPage() {
  return {
    links: findFreelancerProfileLinks(),
    blocked: pageLooksBlocked(),
  };
}

/**
 * On freelancer profile page: find GitHub profile link.
 * Looks for a[href*="github.com"] and in the GitHub section (title "GitHub", view-profile link).
 * @returns {{ url: string, text: string } | null}
 */
function findGitHubProfileLink() {
  const base = window.location.origin;

  // 1. Any direct link to github.com (user profile, not just avatars)
  const githubLinks = document.querySelectorAll('a[href*="github.com"]');
  for (const a of githubLinks) {
    const href = (a.getAttribute('href') || '').trim();
    if (!href || href.startsWith('javascript:')) continue;
    const url = href.startsWith('http') ? href : new URL(href, base).href;
    if (!url.includes('github.com')) continue;
    if (url.includes('avatars.githubusercontent.com')) continue;
    const path = new URL(url).pathname.replace(/\/$/, '');
    if (path.split('/').filter(Boolean).length >= 1) {
      return { url, text: (a.textContent || '').trim().slice(0, 60) || url };
    }
  }

  // 2. GitHub section: find container with title "GitHub", then link with data-href or href
  const spans = document.querySelectorAll('span.title');
  for (const span of spans) {
    if ((span.textContent || '').trim() !== 'GitHub') continue;
    const section = span.closest('[class*="grid-container"], [class*="py-4x"]') || span.closest('div');
    if (!section) continue;
    const viewProfile = section.querySelector('.view-profile a, a[href*="github"], a[href^="http"]');
    if (viewProfile) {
      const href = viewProfile.getAttribute('href') || viewProfile.getAttribute('data-href');
      if (href && href !== 'javascript:' && href.includes('github.com')) {
        const url = href.startsWith('http') ? href : new URL(href, base).href;
        return { url, text: 'GitHub – View profile' };
      }
    }
    const anyLink = section.querySelector('a[href*="github.com"]');
    if (anyLink) {
      const href = anyLink.getAttribute('href');
      const url = href.startsWith('http') ? href : new URL(href, base).href;
      return { url, text: 'GitHub – View profile' };
    }
  }

  return null;
}

/**
 * Find the "View profile" link inside the GitHub section.
 * Tries: span.title "GitHub" → .view-profile a; then any "View profile" link near GitHub text.
 * @returns {HTMLAnchorElement | null}
 */
function findGitHubViewProfileButton() {
  const viewProfileText = /view\s*profile/i;

  // 1. Section with span.title "GitHub" → .view-profile a (exact structure from req)
  const spans = document.querySelectorAll('span.title');
  for (const span of spans) {
    if ((span.textContent || '').trim() !== 'GitHub') continue;
    const section = span.closest('[class*="grid-container"], [class*="py-4x"], [class*="px-0"]') || span.closest('div');
    if (!section) continue;
    const viewProfile = section.querySelector('.view-profile a');
    if (viewProfile && viewProfileText.test((viewProfile.textContent || '').trim())) return viewProfile;
    const anyViewLink = section.querySelector('a.up-n-link, a[class*="link"]');
    if (anyViewLink && viewProfileText.test((anyViewLink.textContent || '').trim())) return anyViewLink;
  }

  // 2. Any "View profile" link that has an ancestor whose text contains "GitHub"
  const allLinks = document.querySelectorAll('a');
  for (const a of allLinks) {
    if (!viewProfileText.test((a.textContent || '').trim())) continue;
    let parent = a.parentElement;
    for (let d = 0; d < 20 && parent; d++, parent = parent.parentElement) {
      if ((parent.textContent || '').includes('GitHub')) return a;
    }
  }

  // 3. Any a with text "View profile" and class containing "link", inside a div that has "GitHub" somewhere above
  for (const a of document.querySelectorAll('a.up-n-link, a[class*="no-underline"]')) {
    if (!viewProfileText.test((a.textContent || '').trim())) continue;
    let parent = a.parentElement;
    let depth = 0;
    while (parent && depth < 15) {
      if ((parent.textContent || '').includes('GitHub')) return a;
      parent = parent.parentElement;
      depth++;
    }
  }

  return null;
}

/**
 * Scroll element into view and click once. Only use link.click() so the page's
 * handler runs once (dispatching multiple events was opening two GitHub tabs).
 */
function scrollAndClick(el) {
  el.scrollIntoView({ behavior: 'instant', block: 'center' });
  el.click();
}

/**
 * Click the "View profile" button in the GitHub section. The page's JS will open GitHub (e.g. new tab).
 * @returns {boolean} true if the button was found and clicked
 */
function clickGitHubViewProfileButton() {
  const btn = findGitHubViewProfileButton();
  if (!btn) return false;
  scrollAndClick(btn);
  return true;
}

function isFreelancerProfilePage() {
  return /upwork\.com\/freelancers\//.test(window.location.href);
}

/**
 * Get current page number from URL (?page=...).
 */
function getCurrentPageNumber() {
  const params = new URLSearchParams(window.location.search);
  const p = params.get('page');
  return p ? Math.max(1, parseInt(p, 10) || 1) : 1;
}

/**
 * Build URL for a different page number (same path and other params).
 */
function getUrlForPage(pageNum) {
  const url = new URL(window.location.href);
  url.searchParams.set('page', String(pageNum));
  return url.toString();
}

globalThis.__UW_TALENT_SEARCHER_API__ = {
  findFreelancerProfileLinks,
  scanTalentSearchPage,
  getCurrentPageNumber,
  getUrlForPage,
};

// Listen for messages from popup/background.
// Guarded so injecting this file again (side panel scan on an already-open tab) does not stack listeners.
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage && !globalThis.__UW_TALENT_SEARCHER_LISTENER__) {
  globalThis.__UW_TALENT_SEARCHER_LISTENER__ = true;
  chrome.runtime.onMessage.addListener(onExtensionMessage);
}

function onExtensionMessage(msg, _sender, sendResponse) {
  if (msg.type === 'GET_PROFILE_LINKS' || msg.type === 'GET_PROFILE_LINKS_V2') {
    const scan = scanTalentSearchPage();
    sendResponse(scan);
    return true;
  }
  if (msg.type === 'GET_PAGE_INFO') {
    const page = getCurrentPageNumber();
    const nextPageUrl = getUrlForPage(page + 1);
    sendResponse({ page, nextPageUrl });
    return true;
  }
  if (msg.type === 'NAVIGATE_NEXT_PAGE') {
    const nextUrl = getUrlForPage(getCurrentPageNumber() + 1);
    window.location.href = nextUrl;
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'GET_GITHUB_LINK') {
    const link = isFreelancerProfilePage() ? findGitHubProfileLink() : null;
    sendResponse({ link });
    return true;
  }
  if (msg.type === 'HAS_GITHUB_VIEW_PROFILE_BUTTON') {
    const hasButton = isFreelancerProfilePage() && !!findGitHubViewProfileButton();
    sendResponse({ hasButton });
    return false;
  }
  if (msg.type === 'CLICK_GITHUB_VIEW_PROFILE') {
    if (!isFreelancerProfilePage()) {
      sendResponse({ clicked: false });
      return false;
    }
    const delayBeforeClickMs = 300;
    setTimeout(() => {
      const clicked = clickGitHubViewProfileButton();
      sendResponse({ clicked });
    }, delayBeforeClickMs);
    return true;
  }
  return false;
}

// No auto-click: only "Open GitHub on all profile tabs" (batch) or popup "Click View profile" trigger the click,
// so we avoid double-click and "flag set by auto-click blocks batch" issues.
})();
