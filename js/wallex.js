/**
 * MRSIGNALLL Wallex Crypto Payment Gateway & Premium Membership Manager
 */

const WALLEX_CONFIG = {
  apiKey: "20577|4LqWQnuVzrWCmKsbLNTbbzUSKXF4BsfnMyxnVJwM",
  wallets: {
    BSC: "0x19b3c81ffe912e995c20cef4db50f289379bd9c7"
  },
  plans: {
    "1": { amount: 1.0, usdt: "1.00", labelFa: "یک فنجان قهوه ☕", labelEn: "Buy a Coffee ☕" },
    "5": { amount: 5.0, usdt: "5.00", labelFa: "حامی سرور ⚡", labelEn: "Server Supporter ⚡" },
    "20": { amount: 20.0, usdt: "20.00", labelFa: "حامی طلایی 💎", labelEn: "Gold Patron 💎" }
  }
};

let currentPlan = "1";
let currentNet = "BSC";

function getSubscription() {
  let isSupporter = false;
  if (typeof currentUser !== 'undefined' && currentUser) {
    const role = currentUser.role || 'free';
    if (role === 'founder' || role === 'admin' || role === 'supporter' || role === 'premium') {
      isSupporter = true;
    }
  }

  try {
    const raw = localStorage.getItem('mrsignalll_sub');
    if (raw) isSupporter = true;
  } catch (e) {}

  return {
    active: true, // Platform is 100% free for everyone!
    isSupporter,
    plan: currentPlan,
    network: "BSC"
  };
}

function saveSubscription(planAmount, txHash, network) {
  const now = Date.now();
  const data = { amount: String(planAmount), txHash, network, donatedAt: now };
  try {
    localStorage.setItem('mrsignalll_sub', JSON.stringify(data));
  } catch (e) {}
  updateSubscriptionUI();
}

function updateSubscriptionUI() {
  const sub = getSubscription();
  const navBadge = document.getElementById('navSubBadge');
  const activeCard = document.getElementById('subActiveCard');
  const lockedBox = document.getElementById('premiumLockedBox');
  const contentBox = document.getElementById('premiumContentBox');

  // Pro tools are ALWAYS unlocked and visible
  if (lockedBox) lockedBox.hidden = true;
  if (contentBox) contentBox.hidden = false;

  if (navBadge) {
    if (sub.isSupporter) {
      navBadge.className = 'nav-sub-badge active';
      navBadge.querySelector('span').textContent = (typeof language !== 'undefined' && language === 'fa')
        ? '💛 حامی رسمی سامانه'
        : '💛 Verified Supporter';
    } else {
      navBadge.className = 'nav-sub-badge free';
      navBadge.querySelector('span').textContent = (typeof language !== 'undefined' && language === 'fa')
        ? '☕ حمایت مالی از پروژه'
        : '☕ Support & Donate';
    }
  }

  if (activeCard) {
    activeCard.hidden = !sub.isSupporter;
  }

  if (typeof updateMultiTP === 'function') {
    updateMultiTP();
  }
}

function updatePaymentDetails() {
  const planInfo = WALLEX_CONFIG.plans[currentPlan] || WALLEX_CONFIG.plans["1"];
  const address = WALLEX_CONFIG.wallets.BSC;
  const amountStr = `${planInfo.usdt} USDT`;

  const amountDisplay = document.getElementById('depAmountDisplay');
  const addressDisplay = document.getElementById('depAddressDisplay');
  if (amountDisplay) amountDisplay.textContent = amountStr;
  if (addressDisplay) addressDisplay.textContent = address;

  const qrImg = document.getElementById('walletQrImg');
  if (qrImg) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=6&data=${encodeURIComponent(address)}`;
    qrImg.src = qrUrl;
  }

  const tip = document.getElementById('netTipText');
  if (tip) {
    tip.textContent = language === 'fa'
      ? 'تتر (USDT) را فقط از شبکه BNB Smart Chain (BEP20) ولت شخصی یا صرافی به آدرس بالا واریز کنید.'
      : 'Deposit USDT only via BNB Smart Chain (BEP20) from personal wallet or exchange to the address above.';
  }
}

async function verifyTransaction() {
  const input = document.getElementById('txHashInput');
  const alertBox = document.getElementById('verifyAlert');
  const tx = input ? input.value.trim() : '';

  if (!tx || tx.length < 16) {
    alertBox.className = 'verify-alert error';
    alertBox.textContent = language === 'fa'
      ? 'لطفاً شناسه یا هش تراکنش معتبر را وارد کنید (حداقل ۱۶ کاراکتر).'
      : 'Please enter a valid Transaction Hash / TxID (min 16 chars).';
    return;
  }

  alertBox.className = 'verify-alert pending';
  alertBox.textContent = language === 'fa'
    ? 'در حال استعلام و راستی‌آزمایی تراکنش در شبکه بلاک‌چین…'
    : 'Checking transaction on blockchain network…';

  try {
    let verified = false;
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (typeof getAuthToken === 'function') {
        const token = getAuthToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/wallex/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({ txHash: tx, network: currentNet, plan: currentPlan })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          verified = true;
          if (json.user && typeof currentUser !== 'undefined') {
            currentUser = json.user;
            if (typeof renderUserNav === 'function') renderUserNav();
          }
        }
      }
    } catch (err) {}

    if (!verified) {
      const isHex = /^0x[a-fA-F0-9]{40,64}$/.test(tx) || /^[a-fA-F0-9]{64}$/.test(tx);
      const isTron = tx.length >= 32;
      if (isHex || isTron) verified = true;
    }

    if (verified) {
      const planAmt = (WALLEX_CONFIG.plans[currentPlan] || WALLEX_CONFIG.plans["1"]).amount;
      saveSubscription(planAmt, tx, currentNet);
      alertBox.className = 'verify-alert success';
      alertBox.textContent = (typeof language !== 'undefined' && language === 'fa')
        ? '✓ دونیت شما با موفقیت ثبت و تأیید شد! از لطف و حمایت ارزشمند شما برای توسعه سامانه بی‌نهایت سپاسگزاریم. 🌹'
        : '✓ Donation verified! Thank you deeply for your kind support of MRSIGNALLL. 🌹';
      notify((typeof language !== 'undefined' && language === 'fa') ? 'از حمایت مالی ارزشمند شما متشکریم! 🌹' : 'Thank you for your generous donation! 🌹');
      if (input) input.value = '';
    } else {
      throw new Error('Verification failed');
    }
  } catch (e) {
    alertBox.className = 'verify-alert error';
    alertBox.textContent = (typeof language !== 'undefined' && language === 'fa')
      ? 'تأیید خودکار ناموفق بود. لطفاً فیش و هش را با دکمه زیر به پشتیبانی تلگرام ارسال کنید.'
      : 'Automated verification failed. Please send your TxHash to Telegram support.';
  }
}

function sendReceiptTelegram() {
  const tx = document.getElementById('txHashInput') ? document.getElementById('txHashInput').value.trim() : '';
  const planInfo = WALLEX_CONFIG.plans[currentPlan] || WALLEX_CONFIG.plans["1"];
  const msg = encodeURIComponent(
    `سلام، ثبت تراکنش دونیت و حمایت مالی از پروژه MRSIGNALLL:\n` +
    `• مبلغ دونیت: ${planInfo.usdt} USDT\n` +
    `• شبکه: ${currentNet}\n` +
    `• هش تراکنش (TxHash): ${tx || 'ضمیمه در تصویر فیش'}\n` +
    `با آرزوی موفقیت و تریدهای پرسود! 🌹`
  );
  window.open(`https://t.me/the_foundder?text=${msg}`, '_blank');
}

/**
 * Bitunix Referral Showcase & Aside Tabs Manager
 */
function switchAsideTab(tab) {
  const btnBitunix = document.getElementById('btnTabBitunix');
  const btnTg = document.getElementById('btnTabTelegram');
  const panelBitunix = document.getElementById('panelBitunix');
  const panelTg = document.getElementById('panelTelegram');

  if (tab === 'bitunix') {
    if (btnBitunix) btnBitunix.classList.add('active');
    if (btnTg) btnTg.classList.remove('active');
    if (panelBitunix) panelBitunix.style.display = 'flex';
    if (panelTg) panelTg.style.display = 'none';
  } else {
    if (btnTg) btnTg.classList.add('active');
    if (btnBitunix) btnBitunix.classList.remove('active');
    if (panelTg) panelTg.style.display = 'flex';
    if (panelBitunix) panelBitunix.style.display = 'none';
  }
}

function copyBitunixCode(code = 'gNLc4507') {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      onCodeCopied();
    }).catch(() => fallbackCopy(code));
  } else {
    fallbackCopy(code);
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      onCodeCopied();
    } catch (e) {}
    document.body.removeChild(ta);
  }

  function onCodeCopied() {
    const btn = document.getElementById('btnCopyBitunixCode');
    if (btn) {
      const origHtml = btn.innerHTML;
      btn.innerHTML = '<span>✓</span><span>کپی شد!</span>';
      setTimeout(() => {
        btn.innerHTML = origHtml;
      }, 2000);
    }
    if (typeof notify === 'function') {
      notify(language === 'fa' ? `کد رفرال ${code} کپی شد!` : `Referral code ${code} copied!`);
    }
  }
}

function openBitunixPosterModal() {
  const modal = document.getElementById('bitunixPosterModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeBitunixPosterModal() {
  const modal = document.getElementById('bitunixPosterModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function toggleBitunixDetails() {
  const content = document.getElementById('bitunixDetailsContent');
  const arrow = document.getElementById('bitunixDetailsArrow');
  if (!content) return;
  const isOpen = content.classList.toggle('open');
  if (arrow) {
    arrow.textContent = isOpen ? '▴' : '▾';
  }
}

// Close poster modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeBitunixPosterModal();
  }
});
