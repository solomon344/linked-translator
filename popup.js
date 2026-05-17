// ── CONFIG ──────────────────────────────────────────────
const DODO_PAYMENT_URL = 'https://checkout.dodopayments.com/buy/pdt_0NbeAioqYB9igUFkOHeOW?quantity=1'; // replace
const API_BASE = 'https://linkedin-translator.vps.divparser.com'; // replace with your Hetzner VPS URL
const MAX_FREE_USES = 5;

// ── HELPERS ─────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function showState(name) {
  document.querySelectorAll('.state').forEach(el => el.classList.remove('active'));
  $(`state-${name}`)?.classList.add('active');
}

function updatePips(usesLeft) {
  const pips = Array.from(document.querySelectorAll('.pip'));
  pips.forEach((pip, index) => {
    pip.classList.toggle('used', index >= usesLeft);
  });
  $('uses-remaining').textContent = Math.max(0, usesLeft);
}

function showMessage(id, text, success = false) {
  const el = $(id);
  if (!el) return;
  el.className = `license-msg ${success ? 'success' : 'error'}`;
  el.textContent = text;
}

// ── INIT ─────────────────────────────────────────────────
chrome.storage.local.get(['licenseKey', 'freeUses', 'totalTranslations', 'todayTranslations', 'lastDate', 'installId'], async (data) => {
  const today = new Date().toDateString();
  const todayCount = data.lastDate === today ? (data.todayTranslations || 0) : 0;
  const totalCount = data.totalTranslations || 0;

  if (data.licenseKey) {
    showState('pro');
    $('stat-total').textContent = totalCount;
    $('stat-today').textContent = todayCount;
    return;
  }

  const installId = data.installId || '';
  let freeUses = data.freeUses || 0;
  let maxFreeUses = MAX_FREE_USES;
  let verified = false;

  if (installId) {
    try {
      const res = await fetch(`${API_BASE}/trial-status?installId=${encodeURIComponent(installId)}`);
      if (res.ok) {
        const status = await res.json();
        freeUses = status.freeUses ?? freeUses;
        maxFreeUses = status.maxFreeUses ?? maxFreeUses;
        verified = !!status.verified;
      }
    } catch (err) {
      console.warn('Could not load trial status', err);
    }
  }

  const usesLeft = maxFreeUses - freeUses;
  if (usesLeft <= 0) {
    showState('paywall');
  } else {
    showState('free');
    updatePips(usesLeft);
  }

  if (verified) {
    showMessage('verify-email-msg', 'Your trial is verified. You now have up to 10 free translations.', true);
  }

  chrome.storage.local.get(['pendingVerify'], (pending) => {
    if (pending.pendingVerify) {
      showState('verify');
      chrome.storage.local.remove(['pendingVerify']);
    }
  });
});

// ── PAY BUTTON ───────────────────────────────────────────
$('btn-pay')?.addEventListener('click', () => {
  chrome.tabs.create({ url: DODO_PAYMENT_URL });
});

$('btn-send-code')?.addEventListener('click', async () => {
  const email = $('verify-email').value.trim();
  if (!email) {
    showMessage('verify-email-msg', 'Enter a valid email address.');
    return;
  }

  chrome.storage.local.get(['installId'], async (data) => {
    const installId = data.installId || '';
    if (!installId) {
      showMessage('verify-email-msg', 'Missing installId. Refresh the extension.');
      return;
    }

    $('btn-send-code').textContent = 'Sending...';
    $('btn-send-code').disabled = true;

    try {
      const res = await fetch(`${API_BASE}/start-trial-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installId, email })
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('verify-email-msg', data.message || 'Code sent. Check your inbox.', true);
        showState('verify');
      } else {
        showMessage('verify-email-msg', data.error || 'Could not send code.');
      }
    } catch (err) {
      showMessage('verify-email-msg', 'Unable to connect.');
    } finally {
      $('btn-send-code').textContent = 'Send code';
      $('btn-send-code').disabled = false;
    }
  });
});

$('btn-submit-code')?.addEventListener('click', async () => {
  const code = $('verify-code').value.trim();
  if (!code) {
    showMessage('verify-code-msg', 'Enter the code from your email.');
    return;
  }

  chrome.storage.local.get(['installId'], async (data) => {
    const installId = data.installId || '';
    if (!installId) {
      showMessage('verify-code-msg', 'Missing installId. Refresh the extension.');
      return;
    }

    $('btn-submit-code').textContent = 'Verifying...';
    $('btn-submit-code').disabled = true;

    try {
      const res = await fetch(`${API_BASE}/verify-trial-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installId, code })
      });
      const data = await res.json();
      if (res.ok && data.verified) {
        showMessage('verify-code-msg', 'Verified! You now have more free uses.', true);
        chrome.storage.local.set({ freeUses: 0, trialVerified: true });
        showState('free');
        updatePips(MAX_FREE_USES);
      } else {
        showMessage('verify-code-msg', data.error || 'Invalid code.');
      }
    } catch (err) {
      showMessage('verify-code-msg', 'Unable to connect.');
    } finally {
      $('btn-submit-code').textContent = 'Verify code';
      $('btn-submit-code').disabled = false;
    }
  });
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
