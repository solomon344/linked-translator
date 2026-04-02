// ── CONFIG ──────────────────────────────────────────────
const DODO_PAYMENT_URL = 'https://checkout.dodopayments.com/buy/pdt_0NbeAioqYB9igUFkOHeOW?quantity=1'; // replace
const API_BASE = 'https://linkedin-translator.vps.divparser.com'; // replace with your Hetzner VPS URL
const MAX_FREE_USES = 5;

// ── HELPERS ─────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function showState(name) {
  document.querySelectorAll('.state').forEach(el => el.classList.remove('active'));
  $(`state-${name}`).classList.add('active');
}

function updatePips(usesLeft) {
  const pip1 = $('pip-1');
  const pip2 = $('pip-2');
  if (usesLeft <= 1) pip1.classList.add('used');
  if (usesLeft <= 0) pip2.classList.add('used');
  $('uses-remaining').textContent = Math.max(0, usesLeft);
}

// ── INIT ─────────────────────────────────────────────────
chrome.storage.local.get(['licenseKey', 'freeUses', 'totalTranslations', 'todayTranslations', 'lastDate'], (data) => {
  // Check if today's count should reset
  const today = new Date().toDateString();
  const todayCount = data.lastDate === today ? (data.todayTranslations || 0) : 0;
  const totalCount = data.totalTranslations || 0;

  if (data.licenseKey) {
    // Pro state
    showState('pro');
    $('stat-total').textContent = totalCount;
    $('stat-today').textContent = todayCount;
  } else {
    const usesLeft = MAX_FREE_USES - (data.freeUses || 0);
    if (usesLeft <= 0) {
      showState('paywall');
    } else {
      showState('free');
      updatePips(usesLeft);
    }
  }
});

// ── PAY BUTTON ───────────────────────────────────────────
$('btn-pay')?.addEventListener('click', () => {
  chrome.tabs.create({ url: DODO_PAYMENT_URL });
});

// ── LICENSE ACTIVATION ───────────────────────────────────
$('btn-activate')?.addEventListener('click', async () => {
  const key = $('license-input').value.trim();
  const msgEl = $('license-msg');
  const inputEl = $('license-input');

  if (!key) {
    inputEl.classList.add('error');
    msgEl.className = 'license-msg error';
    msgEl.textContent = 'Please enter your license key.';
    return;
  }

  $('btn-activate').textContent = 'Checking...';
  $('btn-activate').disabled = true;

  try {
    const res = await fetch(`${API_BASE}/verify-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });

    const data = await res.json();

    if (data.valid) {
      inputEl.classList.remove('error');
      inputEl.classList.add('success');
      msgEl.className = 'license-msg success';
      msgEl.textContent = 'License activated!';

      chrome.storage.local.set({ licenseKey: key });

      setTimeout(() => {
        showState('pro');
        $('stat-total').textContent = 0;
        $('stat-today').textContent = 0;
      }, 800);
    } else {
      inputEl.classList.add('error');
      inputEl.classList.remove('success');
      msgEl.className = 'license-msg error';
      msgEl.textContent = data.message || 'Invalid key. Check your email.';
      $('btn-activate').textContent = 'Activate';
      $('btn-activate').disabled = false;
    }
  } catch (err) {
    inputEl.classList.add('error');
    msgEl.className = 'license-msg error';
    msgEl.textContent = 'Could not connect. Try again.';
    $('btn-activate').textContent = 'Activate';
    $('btn-activate').disabled = false;
  }
});

// ── REVOKE LICENSE ───────────────────────────────────────
$('btn-revoke')?.addEventListener('click', () => {
  if (confirm('Deactivate your license on this device?')) {
    chrome.storage.local.remove(['licenseKey'], () => {
      showState('paywall');
    });
  }
});
