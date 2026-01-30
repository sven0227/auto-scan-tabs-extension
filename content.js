/**
 * Content script for Upwork: talent search + freelancer profile pages.
 * Search: finds freelancer profile links. Profile: finds GitHub link in GitHub section.
 */

const PROFILE_LINK_SELECTORS = [
  'a.profile-link[data-test="UpLink"][href*="/freelancers/"]',
  'a.up-n-link.profile-link[href*="/freelancers/"]',
  'a[href*="/freelancers/~"][class*="profile-link"]',
];

function getBaseUrl() {
  return window.location.origin;
}

/**
 * Collect all freelancer profile links on the current page.
 * @returns {{ url: string, text: string }[]}
 */
function findFreelancerProfileLinks() {
  const base = getBaseUrl();
  const seen = new Set();
  const results = [];

  for (const selector of PROFILE_LINK_SELECTORS) {
    const links = document.querySelectorAll(selector);
    for (const a of links) {
      const href = a.getAttribute('href');
      if (!href || !href.includes('/freelancers/')) continue;
      const fullUrl = href.startsWith('http') ? href : new URL(href, base).href;
      if (seen.has(fullUrl)) continue;
      seen.add(fullUrl);
      results.push({
        url: fullUrl,
        text: (a.textContent || '').trim().slice(0, 80),
      });
    }
  }

  // Fallback: any link whose href matches /freelancers/~...
  if (results.length === 0) {
    document.querySelectorAll('a[href*="/freelancers/~"]').forEach((a) => {
      const href = a.getAttribute('href');
      const fullUrl = href.startsWith('http') ? href : new URL(href, base).href;
      if (seen.has(fullUrl)) return;
      seen.add(fullUrl);
      results.push({
        url: fullUrl,
        text: (a.textContent || '').trim().slice(0, 80),
      });
    });
  }

  return results;
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

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_PROFILE_LINKS') {
    const links = findFreelancerProfileLinks();
    sendResponse({ links });
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
});

// No auto-click: only "Open GitHub on all profile tabs" (batch) or popup "Click View profile" trigger the click,
// so we avoid double-click and "flag set by auto-click blocks batch" issues.
