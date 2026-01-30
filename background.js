/**
 * Background service worker.
 * Opens multiple freelancer profile URLs in new tabs.
 */

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
    return true; // keep channel open for async sendResponse
  }
  return false;
});
