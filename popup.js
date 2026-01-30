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
const scanGitHubBtn = document.getElementById('scanGitHub');
const openGitHubBtn = document.getElementById('openGitHub');
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
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'OPEN_TABS', urls }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus('Error opening tabs.', true);
      } else {
        setStatus(`Opened ${response?.opened ?? urls.length} tab(s).`);
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

async function openGitHubProfile() {
  if (!lastGitHubLink?.url) return;
  chrome.runtime.sendMessage({ type: 'OPEN_TABS', urls: [lastGitHubLink.url] }, () => {
    setStatus('Opened GitHub profile.');
  });
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
scanGitHubBtn.addEventListener('click', scanForGitHub);
openGitHubBtn.addEventListener('click', openGitHubProfile);

// Auto-scan when popup opens if we're on the right page
(async () => {
  const tab = await getCurrentTab();
  showSectionForTab(tab);
  if (isUpworkTalentSearchTab(tab)) {
    scanPage();
  } else if (isUpworkFreelancerProfileTab(tab)) {
    scanForGitHub();
  } else {
    setStatus('Open Upwork talent search or a freelancer profile.');
    setLinks([]);
  }
})();
