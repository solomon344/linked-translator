// ── CONFIG ──────────────────────────────────────────────
const API_BASE = 'https://linkedin-translator.vps.divparser.com'; // replace later
const MAX_FREE_USES = 2;

// ── CACHED STATE ─────────────────────────────────────────
let isProUser = false;
let freeUsesCount = 0;

function loadState(cb) {
  try {
    chrome.storage.local.get(['licenseKey', 'freeUses'], (data) => {
      isProUser = !!data.licenseKey;
      freeUsesCount = data.freeUses || 0;
      if (cb) cb();
    });
  } catch (e) {
    if (cb) cb();
  }
}

// ── FIND POST TEXT ────────────────────────────────────────
// LinkedIn uses data-testid="expandable-text-box" on the post text span
function getPostText(postEl) {
  const candidates = [
    '[data-testid="expandable-text-box"]',
    'span[dir="ltr"]',
    'p[dir="ltr"]',
  ];
  for (const sel of candidates) {
    const el = postEl.querySelector(sel);
    if (el && el.innerText.trim().length > 20) return el.innerText.trim();
  }
  return null;
}

// ── FIND ACTION BAR ───────────────────────────────────────
// Anchor on the Like button's aria-label, then grab its container
function getActionsBar(postEl) {
  // The action bar contains the Like/Comment/Repost/Send buttons
  const likeBtn = postEl.querySelector(
    '[aria-label*="Reaction button"], [aria-label*="Like"], [aria-label*="React"]'
  );
  if (likeBtn) {
    // Walk up to find the flex row containing all action buttons
    let el = likeBtn.parentElement;
    for (let i = 0; i < 6; i++) {
      if (!el) break;
      // The action bar div contains multiple buttons (Like, Comment, Repost, Send)
      const buttons = el.querySelectorAll('button, a');
      if (buttons.length >= 3) return el;
      el = el.parentElement;
    }
  }
  return null;
}

// ── INJECT BUTTON ─────────────────────────────────────────
function injectButton(postEl) {
  if (postEl.querySelector('.lt-btn-wrap')) return;

  const postText = getPostText(postEl);
  if (!postText) return;

  const actionsBar = getActionsBar(postEl);
  const target = actionsBar || postEl;

  const btnWrap = document.createElement('div');
  btnWrap.className = 'lt-btn-wrap';

  const btn = document.createElement('button');
  btn.className = 'lt-translate-btn';
  btn.innerHTML = '<span class="lt-icon">📰</span> Translate';
  btn.addEventListener('click', () => handleTranslate(postEl, postText, btn));

  btnWrap.appendChild(btn);
  target.appendChild(btnWrap);
}

// ── HANDLE TRANSLATE ─────────────────────────────────────
async function handleTranslate(postEl, postText, btn) {
  await new Promise(res => loadState(res));

  const canTranslate = isProUser || freeUsesCount < MAX_FREE_USES;
  if (!canTranslate) { showPaywallBanner(postEl); return; }

  btn.innerHTML = '<span class="lt-icon lt-spin">⟳</span> Translating...';
  btn.disabled = true;

  const existing = postEl.querySelector('.lt-result');
  if (existing) existing.remove();

  try {
    const res = await fetch(`${API_BASE}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: postText })
    });
    const data = await res.json();
    if (!data.translation) throw new Error('empty');

    showTranslation(postEl, data.translation);
    btn.innerHTML = '<span class="lt-icon">✓</span> Translated';
    btn.classList.add('lt-done');

    if (!isProUser) {
      const newCount = freeUsesCount + 1;
      try { chrome.storage.local.set({ freeUses: newCount }); } catch(e) {}
      freeUsesCount = newCount;
    } else {
      try {
        const today = new Date().toDateString();
        chrome.storage.local.get(['totalTranslations', 'todayTranslations', 'lastDate'], (d) => {
          const todayCount = d.lastDate === today ? (d.todayTranslations || 0) : 0;
          chrome.storage.local.set({
            totalTranslations: (d.totalTranslations || 0) + 1,
            todayTranslations: todayCount + 1,
            lastDate: today
          });
        });
      } catch(e) {}
    }
  } catch (err) {
    console.error('[LT] Translation failed:', err.message);
    btn.innerHTML = '<span class="lt-icon">!</span> Backend not set up yet';
    btn.disabled = false;
    btn.classList.add('lt-error');
  }
}

// ── SHOW TRANSLATION ──────────────────────────────────────
function showTranslation(postEl, translation) {
  const card = document.createElement('div');
  card.className = 'lt-result';
  card.innerHTML = `
    <div class="lt-result-header">
      <span class="lt-result-label">📰 What they actually mean</span>
      <button class="lt-close">✕</button>
    </div>
    <div class="lt-result-text">${escapeHtml(translation)}</div>
    <div class="lt-result-footer">
      <span>LinkedIn Translator</span>
      <button class="lt-share-btn" data-text="${escapeAttr(translation)}">Copy & share</button>
    </div>
  `;
  card.querySelector('.lt-close').addEventListener('click', () => card.remove());
  card.querySelector('.lt-share-btn').addEventListener('click', (e) => {
    navigator.clipboard.writeText(`LinkedIn Translator says:\n\n"${e.target.dataset.text}"\n\nTry it → https://linked-translator-web.vercel.app`);
    e.target.textContent = 'Copied!';
    setTimeout(() => e.target.textContent = 'Copy & share', 2000);
  });
  postEl.appendChild(card);
}

// ── PAYWALL BANNER ────────────────────────────────────────
function showPaywallBanner(postEl) {
  const existing = postEl.querySelector('.lt-paywall-banner');
  if (existing) { existing.classList.add('lt-shake'); setTimeout(() => existing.classList.remove('lt-shake'), 400); return; }

  const banner = document.createElement('div');
  banner.className = 'lt-paywall-banner';
  banner.innerHTML = `
    <div class="lt-paywall-inner">
      <div class="lt-paywall-icon">📰</div>
      <div class="lt-paywall-copy">
        <strong>You've used your 2 free translations.</strong>
        <span>Get unlimited for $5 — one time, forever.</span>
      </div>
      <button class="lt-paywall-btn">Unlock $5 →</button>
    </div>
    <button class="lt-close lt-paywall-close">✕</button>
  `;
  banner.querySelector('.lt-paywall-btn').addEventListener('click', () => {
    try { chrome.runtime.sendMessage({ action: 'openPayment' }); } catch(e) {}
  });
  banner.querySelector('.lt-paywall-close').addEventListener('click', () => banner.remove());
  postEl.appendChild(banner);
}

// ── UTILS ─────────────────────────────────────────────────
function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escapeAttr(s) { return s.replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

// ── SCAN ──────────────────────────────────────────────────
// Use role="listitem" — stable across LinkedIn's obfuscated class changes
function scanAndInject() {
  const posts = document.querySelectorAll('[role="listitem"]');
  let injected = 0;
  posts.forEach(el => {
    // Only process items that look like feed posts (have post text)
    if (getPostText(el)) {
      injectButton(el);
      injected++;
    }
  });
  if (injected > 0) console.log(`[LT] Injected buttons into ${injected} posts`);
}

// ── INIT ──────────────────────────────────────────────────
let scanTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(scanAndInject, 600);
});

loadState(() => {
  console.log('[LT] Ready. Pro:', isProUser, '| Free uses:', freeUsesCount);
  scanAndInject();
  observer.observe(document.body, { childList: true, subtree: true });
});
