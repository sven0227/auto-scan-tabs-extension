/**
 * Background service worker.
 * Opens multiple freelancer profile URLs in new tabs.
 * Watches for new GitHub tab after "View profile" click and stores its URL.
 */

let watchingForGitHubTab = false;
let watchTimeoutId = null;

const GITHUB_WATCH_MS = 20000;
const STORAGE_KEY_LAST_GITHUB = 'lastGitHubUrl';
const STORAGE_KEY_LAST_GITHUB_URLS = 'lastGitHubUrls';
const MAX_STORED_GITHUB_URLS = 30;

function stopWatching() {
  watchingForGitHubTab = false;
  if (watchTimeoutId) {
    clearTimeout(watchTimeoutId);
    watchTimeoutId = null;
  }
}

function isGitHubProfileUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.includes('avatars.githubusercontent.com')) return false;
  try {
    const u = new URL(url);
    if (u.hostname !== 'github.com') return false;
    const path = u.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    return path.length >= 1;
  } catch (_) {
    return false;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OPEN_TABS') {
    const urls = msg.urls || [];
    if (urls.length === 0) {
      sendResponse({ opened: 0, error: 'No URLs' });
      return false;
    }
    let opened = 0;
    for (const url of urls) {
      chrome.tabs.create({ url, active: false }, () => {
        opened++;
        if (opened === urls.length) sendResponse({ opened });
      });
    }
    return true;
  }
  if (msg.type === 'START_WATCHING_GITHUB_TAB') {
    stopWatching();
    watchingForGitHubTab = true;
    watchTimeoutId = setTimeout(stopWatching, GITHUB_WATCH_MS);
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === 'GET_LAST_GITHUB_URL') {
    chrome.storage.local.get([STORAGE_KEY_LAST_GITHUB, STORAGE_KEY_LAST_GITHUB_URLS], (data) => {
      const urls = data[STORAGE_KEY_LAST_GITHUB_URLS] || [];
      const url = data[STORAGE_KEY_LAST_GITHUB] || (urls.length ? urls[urls.length - 1] : null);
      sendResponse({ url, urls });
    });
    return true;
  }
  if (msg.type === 'CLICK_VIEW_PROFILE_ON_ALL_PROFILE_TABS') {
    startClickingViewProfileOnAllProfileTabs(sendResponse);
    return true;
  }
  return false;
});

/** Injected into each tab (MAIN world) to find and click the GitHub "View profile" button. Self-contained. */
function runClickGitHubViewProfileInPage() {
  const viewProfileText = /view\s*profile/i;
  function findLink() {
    const spans = document.querySelectorAll('span.title');
    for (const span of spans) {
      if ((span.textContent || '').trim() !== 'GitHub') continue;
      const section = span.closest('[class*="grid-container"], [class*="py-4x"], [class*="px-0"]') || span.closest('div');
      if (!section) continue;
      const viewProfile = section.querySelector('.view-profile a');
      const link = viewProfile || section.querySelector('a.up-n-link, a[class*="link"]');
      if (link && viewProfileText.test((link.textContent || '').trim())) return link;
    }
    const allLinks = document.querySelectorAll('a');
    for (const a of allLinks) {
      if (!viewProfileText.test((a.textContent || '').trim())) continue;
      let parent = a.parentElement;
      for (let d = 0; d < 20 && parent; d++, parent = parent.parentElement) {
        if ((parent.textContent || '').includes('GitHub')) return a;
      }
    }
    return null;
  }
  const link = findLink();
  if (!link) return false;
  link.scrollIntoView({ behavior: 'instant', block: 'center' });
  const rect = link.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const opts = {
    bubbles: true,
    cancelable: true,
    view: window,
    buttons: 1,
    button: 0,
    clientX: x,
    clientY: y,
    screenX: x + (window.screenX || 0),
    screenY: y + (window.screenY || 0),
  };
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (type) {
    const Ctor = type.startsWith('pointer') ? (window.PointerEvent || window.MouseEvent) : window.MouseEvent;
    link.dispatchEvent(new Ctor(type, Object.assign({}, opts, { detail: type === 'click' ? 1 : 0 })));
  });
  link.click();
  return true;
}

function startClickingViewProfileOnAllProfileTabs(sendResponse) {
  const urlPattern = 'https://www.upwork.com/freelancers/*';
  chrome.tabs.query({ url: urlPattern }, (tabs) => {
    const profileTabs = tabs.filter((t) => t.id && t.url && t.url.includes('upwork.com/freelancers/'));
    if (profileTabs.length === 0) {
      sendResponse({ started: false, count: 0, clicked: 0, closed: 0, error: 'No freelancer profile tabs found' });
      return;
    }
    stopWatching();
    watchingForGitHubTab = true;
    watchTimeoutId = setTimeout(stopWatching, GITHUB_WATCH_MS);
    let index = 0;
    let clicked = 0;
    let closed = 0;
    function doNext() {
      if (index >= profileTabs.length) {
        try { sendResponse({ started: true, count: profileTabs.length, clicked, closed }); } catch (_) {}
        return;
      }
      const tab = profileTabs[index];
      index += 1;
      chrome.tabs.update(tab.id, { active: true }, () => {
        chrome.tabs.sendMessage(tab.id, { type: 'HAS_GITHUB_VIEW_PROFILE_BUTTON' }, (res) => {
          if (chrome.runtime.lastError || res === undefined) {
            doNext();
            return;
          }
          if (res.hasButton === false) {
            chrome.tabs.remove(tab.id, () => {
              closed += 1;
              doNext();
            });
            return;
          }
          chrome.tabs.sendMessage(tab.id, { type: 'CLICK_GITHUB_VIEW_PROFILE' }, (clickRes) => {
            if (clickRes && clickRes.clicked) clicked += 1;
            doNext();
          });
        });
      });
    }
    doNext();
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!watchingForGitHubTab) return;
  const url = changeInfo.url || tab.url;
  if (!url || !isGitHubProfileUrl(url)) return;
  chrome.storage.local.get(STORAGE_KEY_LAST_GITHUB_URLS, (data) => {
    const urls = data[STORAGE_KEY_LAST_GITHUB_URLS] || [];
    if (!urls.includes(url)) {
      urls.push(url);
      const trimmed = urls.slice(-MAX_STORED_GITHUB_URLS);
      chrome.storage.local.set({
        [STORAGE_KEY_LAST_GITHUB]: url,
        [STORAGE_KEY_LAST_GITHUB_URLS]: trimmed,
      });
    }
  });
});
