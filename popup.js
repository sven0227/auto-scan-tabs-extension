/**
 * Popup UI: scan current tab for profile links, open them, next page; on profile page get GitHub link.
 */

const statusEl = document.getElementById('status');
const linkListEl = document.getElementById('linkList');
const scanBtn = document.getElementById('scan');
const openTabsBtn = document.getElementById('openTabs');
const nextPageBtn = document.getElementById('nextPage');
const searchSection = document.getElementById('searchSection');
const githubSection = document.getElementById('githubSection');
const clickViewProfileBtn = document.getElementById('clickViewProfile');
const scanGitHubBtn = document.getElementById('scanGitHub');
const openGitHubBtn = document.getElementById('openGitHub');
const openGitHubOnAllProfileTabsBtn = document.getElementById('openGitHubOnAllProfileTabs');
const exportGitHubCsvBtn = document.getElementById('exportGitHubCsv');
const githubLinkDisplay = document.getElementById('githubLinkDisplay');
const pageHint = document.getElementById('pageHint');

let lastLinks = [];
let lastGitHubLink = null;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.className = 'status' + (isError ? ' error' : '');
}

function setLinks(links) {
  lastLinks = links;
  linkListEl.innerHTML = '';
  if (links.length === 0) {
    linkListEl.innerHTML = '<li>No profile links found</li>';
    openTabsBtn.disabled = true;
    openTabsBtn.classList.remove('primary');
    return;
  }
  openTabsBtn.disabled = false;
  openTabsBtn.classList.add('primary');
  openTabsBtn.textContent = `Open ${links.length} in new tabs`;
  links.forEach(({ url, text }) => {
    const li = document.createElement('li');
    li.title = url;
    li.textContent = text || url;
    linkListEl.appendChild(li);
  });
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isUpworkTalentSearchTab(tab) {
  return tab?.url?.includes('upwork.com/nx/search/talent');
}

function isUpworkFreelancerProfileTab(tab) {
  return tab?.url?.includes('upwork.com/freelancers/');
}

async function scanPage() {
  const tab = await getCurrentTab();
  if (!tab?.id) {
    setStatus('No active tab.', true);
    return;
  }
  if (!isUpworkTalentSearchTab(tab)) {
    setStatus('Open an Upwork talent search page first.', true);
    setLinks([]);
    return;
  }
  setStatus('Scanning...');
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PROFILE_LINKS' });
    const links = res?.links ?? [];
    setLinks(links);
    setStatus(links.length ? `Found ${links.length} profile link(s).` : 'No profile links on this page.');
  } catch (e) {
    setStatus('Scan failed. Reload the Upwork page and try again.', true);
    setLinks([]);
  }
}

async function openAllInNewTabs() {
  if (lastLinks.length === 0) return;
  setStatus('Opening tabs...');
  const urls = lastLinks.map((l) => l.url);
  chrome.runtime.sendMessage({ type: 'START_WATCHING_GITHUB_TAB' });
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'OPEN_TABS', urls }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus('Error opening tabs.', true);
      } else {
        setStatus(`Opened ${response?.opened ?? urls.length} tab(s). Each will auto-click View profile when loaded.`);
      }
      resolve();
    });
  });
}

async function goToNextPage() {
  const tab = await getCurrentTab();
  if (!tab?.id) {
    setStatus('No active tab.', true);
    return;
  }
  if (!isUpworkTalentSearchTab(tab)) {
    setStatus('Open an Upwork talent search page first.', true);
    return;
  }
  setStatus('Going to next page...');
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'NAVIGATE_NEXT_PAGE' });
    setStatus('Navigating...');
  } catch (e) {
    setStatus('Reload the Upwork page and try again.', true);
  }
}

async function scanForGitHub() {
  const tab = await getCurrentTab();
  if (!tab?.id) {
    setStatus('No active tab.', true);
    return;
  }
  if (!isUpworkFreelancerProfileTab(tab)) {
    setStatus('Open a freelancer profile page first.', true);
    setGitHubLink(null);
    return;
  }
  setStatus('Scanning for GitHub...');
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_GITHUB_LINK' });
    const link = res?.link ?? null;
    setGitHubLink(link);
    setStatus(link ? 'GitHub link found.' : 'No GitHub link on this profile.');
  } catch (e) {
    setStatus('Reload the profile page and try again.', true);
    setGitHubLink(null);
  }
}

function setGitHubLink(link) {
  lastGitHubLink = link;
  if (!link) {
    githubLinkDisplay.textContent = '';
    githubLinkDisplay.style.display = 'none';
    openGitHubBtn.disabled = true;
    return;
  }
  githubLinkDisplay.textContent = link.url;
  githubLinkDisplay.style.display = 'block';
  openGitHubBtn.disabled = false;
}

const GITHUB_POLL_MS = 400;
const GITHUB_POLL_MAX_MS = 10000;

async function getLastGitHubUrlFromBackground() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_LAST_GITHUB_URL' }, (res) => {
      resolve(res?.url ?? null);
    });
  });
}

async function getLastGitHubUrlsFromBackground() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_LAST_GITHUB_URL' }, (res) => {
      resolve(Array.isArray(res?.urls) ? res.urls : res?.url ? [res.url] : []);
    });
  });
}

async function clickViewProfile() {
  const tab = await getCurrentTab();
  if (!tab?.id || !isUpworkFreelancerProfileTab(tab)) {
    setStatus('Open a freelancer profile page first.', true);
    return;
  }
  setStatus('Clicking View profile...');
  try {
    await chrome.runtime.sendMessage({ type: 'START_WATCHING_GITHUB_TAB' });
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'CLICK_GITHUB_VIEW_PROFILE' });
    if (!res?.clicked) {
      setStatus('View profile button not found on this page.', true);
      return;
    }
    setStatus('Clicked. Detecting new tab URL...');
    const start = Date.now();
    const poll = async () => {
      const url = await getLastGitHubUrlFromBackground();
      if (url) {
        lastGitHubLink = { url, text: 'GitHub (from new tab)' };
        githubLinkDisplay.textContent = url;
        githubLinkDisplay.style.display = 'block';
        openGitHubBtn.disabled = false;
        setStatus('Got URL from new tab.');
        return;
      }
      if (Date.now() - start < GITHUB_POLL_MAX_MS) {
        setTimeout(poll, GITHUB_POLL_MS);
      } else {
        setStatus('New tab opened; URL not captured in time.');
      }
    };
    setTimeout(poll, GITHUB_POLL_MS);
  } catch (e) {
    setStatus('Reload the profile page and try again.', true);
  }
}

async function openGitHubProfile() {
  if (!lastGitHubLink?.url) return;
  chrome.runtime.sendMessage({ type: 'OPEN_TABS', urls: [lastGitHubLink.url] }, () => {
    setStatus('Opened GitHub profile.');
  });
}

async function openGitHubOnAllProfileTabs() {
  setStatus('Scanning profile tabs...');
  const tabs = await chrome.tabs.query({ url: 'https://www.upwork.com/freelancers/*' }).catch(() => []);
  const profileTabs = tabs.filter((t) => t.url && t.url.includes('upwork.com/freelancers/'));
  const foundCount = profileTabs.length;
  if (foundCount === 0) {
    setStatus('No freelancer profile tabs found.', true);
    return;
  }
  setStatus(`Found ${foundCount} profile tab(s). Finding and clicking View profile...`);
  chrome.runtime.sendMessage({ type: 'CLICK_VIEW_PROFILE_ON_ALL_PROFILE_TABS' }, (res) => {
    if (chrome.runtime.lastError) {
      setStatus('Error: ' + (chrome.runtime.lastError.message || 'unknown'), true);
      return;
    }
    if (res?.started) {
      const tabsFound = res.count ?? foundCount;
      const viewProfileClicked = res.clicked ?? 0;
      const closedNoButton = res.closed ?? 0;
      let msg = `Found ${tabsFound} profile tab(s). Clicked View profile in ${viewProfileClicked} tab(s).`;
      if (closedNoButton > 0) msg += ` Closed ${closedNoButton} tab(s) without View profile.`;
      setStatus(msg);
    } else {
      setStatus(res?.error || 'No freelancer profile tabs found.', true);
    }
  });
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

function isUpworkFreelancerProfileUrl(url) {
  return url && typeof url === 'string' && url.includes('upwork.com/freelancers/');
}

function escapeCsvField(s) {
  if (s == null || s === '') return '';
  const str = String(s);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

async function exportGitHubUrlsToCsv() {
  setStatus('Scanning opened tabs...');
  const tabs = await chrome.tabs.query({}).catch(() => []);
  const byWindowAndIndex = new Map();
  for (const t of tabs) {
    const key = `${t.windowId ?? 0},${t.index ?? 0}`;
    byWindowAndIndex.set(key, t);
  }
  const upworkTabs = tabs
    .filter((t) => t.url && isUpworkFreelancerProfileUrl(t.url))
    .sort((a, b) => (a.windowId || 0) - (b.windowId || 0) || (a.index || 0) - (b.index || 0));
  const rows = [];
  for (const upworkTab of upworkTabs) {
    const rightKey = `${upworkTab.windowId ?? 0},${(upworkTab.index ?? 0) + 1}`;
    const rightTab = byWindowAndIndex.get(rightKey);
    const githubUrl =
      rightTab && rightTab.url && isGitHubProfileUrl(rightTab.url) ? rightTab.url : '';
    rows.push({ upwork: upworkTab.url, github: githubUrl });
  }
  if (rows.length === 0) {
    setStatus('No Upwork profile tabs found. Open some profile tabs first.', true);
    return;
  }
  const header = 'upwork_profile_url,github_url';
  const csvRows = [header, ...rows.map((r) => `${escapeCsvField(r.upwork)},${escapeCsvField(r.github)}`)];
  const csv = csvRows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `upwork-github-urls-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(objectUrl);
  setStatus(`Generated CSV with ${rows.length} row(s).`);
}

function showSectionForTab(tab) {
  if (isUpworkTalentSearchTab(tab)) {
    searchSection.style.display = 'block';
    githubSection.style.display = 'none';
    pageHint.textContent = 'Use this on an Upwork talent search page.';
  } else if (isUpworkFreelancerProfileTab(tab)) {
    searchSection.style.display = 'none';
    githubSection.style.display = 'block';
    pageHint.textContent = 'Freelancer profile – get GitHub link.';
  } else {
    searchSection.style.display = 'block';
    githubSection.style.display = 'none';
    pageHint.textContent = 'Open Upwork talent search or a freelancer profile.';
  }
}

scanBtn.addEventListener('click', scanPage);
openTabsBtn.addEventListener('click', openAllInNewTabs);
nextPageBtn.addEventListener('click', goToNextPage);
openGitHubOnAllProfileTabsBtn.addEventListener('click', openGitHubOnAllProfileTabs);
exportGitHubCsvBtn.addEventListener('click', exportGitHubUrlsToCsv);
clickViewProfileBtn.addEventListener('click', clickViewProfile);
scanGitHubBtn.addEventListener('click', scanForGitHub);
openGitHubBtn.addEventListener('click', openGitHubProfile);

// Auto-scan when popup opens if we're on the right page
(async () => {
  const tab = await getCurrentTab();
  showSectionForTab(tab);
  if (isUpworkTalentSearchTab(tab)) {
    scanPage();
  } else if (isUpworkFreelancerProfileTab(tab)) {
    await scanForGitHub();
    const lastUrl = await getLastGitHubUrlFromBackground();
    if (lastUrl && !lastGitHubLink) {
      setGitHubLink({ url: lastUrl, text: 'GitHub (last captured)' });
      setStatus('Showing last captured GitHub URL.');
    }
  } else {
    setStatus('Open Upwork talent search or a freelancer profile.');
    setLinks([]);
  }
})();
