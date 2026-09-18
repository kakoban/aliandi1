/**
 * MRSIGNALLL Authentication & User Profile Management (Client Side)
 * Supports 3 Auth Methods: Telegram (Recommended), Email/Password, and Web3 Wallet
 */

let currentUser = null;
let authToken = null;
let emailAuthMode = 'login'; // 'login' or 'register'

function getAuthToken() {
  if (!authToken) {
    try {
      authToken = localStorage.getItem('mrsignalll_auth_token');
    } catch (e) {}
  }
  return authToken;
}

function setAuthToken(token) {
  authToken = token;
  try {
    if (token) {
      localStorage.setItem('mrsignalll_auth_token', token);
    } else {
      localStorage.removeItem('mrsignalll_auth_token');
    }
  } catch (e) {}
}

async function apiFetch(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Auth-Token'] = token;
  }
  const response = await fetch(endpoint, {
    ...options,
    headers
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || 'Request failed');
  }
  return data;
}

async function initAuth() {
  const token = getAuthToken();
  if (!token) {
    currentUser = null;
    renderUserNav();
    return;
  }

  try {
    const data = await apiFetch('/api/auth/me');
    if (data.authenticated && data.user) {
      currentUser = data.user;
    } else {
      currentUser = null;
      setAuthToken(null);
    }
  } catch (err) {
    currentUser = null;
    setAuthToken(null);
  }
  renderUserNav();
  if (typeof updateSubscriptionUI === 'function') {
    updateSubscriptionUI();
  }
  if (typeof renderCoinChips === 'function') {
    renderCoinChips();
  }
}

const AVATAR_ICONS = [
  { key: 'bull', emoji: '🐂', name: 'Bull' },
  { key: 'bear', emoji: '🐻', name: 'Bear' },
  { key: 'whale', emoji: '🐋', name: 'Whale' },
  { key: 'rocket', emoji: '🚀', name: 'Rocket' },
  { key: 'diamond', emoji: '💎', name: 'Diamond' },
  { key: 'ninja', emoji: '🥷', name: 'Ninja' },
  { key: 'wizard', emoji: '🧙', name: 'Wizard' },
  { key: 'fire', emoji: '🔥', name: 'Fire' },
  { key: 'crown', emoji: '👑', name: 'Crown' },
  { key: 'bolt', emoji: '⚡', name: 'Bolt' },
  { key: 'lion', emoji: '🦁', name: 'Lion' },
  { key: 'target', emoji: '🎯', name: 'Sniper' }
];

const AVATAR_COLORS = [
  { hex: '#F0B90B', name: 'Binance Gold' },
  { hex: '#0ECB81', name: 'Cyber Green' },
  { hex: '#229ED9', name: 'Telegram Blue' },
  { hex: '#F6465D', name: 'Liquid Ruby' },
  { hex: '#9D5BD2', name: 'Neon Purple' },
  { hex: '#F6851B', name: 'MetaMask Orange' },
  { hex: '#363D47', name: 'Stealth Titanium' }
];

function renderAvatarHtml(avatarStr, username = 'U') {
  if (avatarStr && avatarStr.startsWith('url:')) {
    const url = avatarStr.slice(4);
    return `<img src="${url}" alt="${username}" onerror="this.onerror=null;this.parentElement.innerHTML='<span class=\\'avatar-emoji\\'>👤</span>';">`;
  }
  if (avatarStr && avatarStr.startsWith('preset:')) {
    const parts = avatarStr.slice(7).split('|');
    const iconKey = parts[0] || 'bull';
    const color = parts[1] || '#F0B90B';
    const iconObj = AVATAR_ICONS.find(i => i.key === iconKey) || AVATAR_ICONS[0];
    return `<div style="width:100%;height:100%;background:${color};display:flex;align-items:center;justify-content:center;"><span class="avatar-emoji">${iconObj.emoji}</span></div>`;
  }
  const charCode = (username || 'U').charCodeAt(0) || 65;
  const defIcon = AVATAR_ICONS[charCode % AVATAR_ICONS.length];
  const defColor = AVATAR_COLORS[charCode % AVATAR_COLORS.length].hex;
  return `<div style="width:100%;height:100%;background:${defColor};display:flex;align-items:center;justify-content:center;"><span class="avatar-emoji">${defIcon.emoji}</span></div>`;
}

function renderBadgesHtml(badges, compact = false) {
  if (!Array.isArray(badges) || badges.length === 0) return '';
  return badges.map(b => {
    const bg = b.color ? `${b.color}22` : 'rgba(240, 185, 11, 0.15)';
    const border = b.color ? `${b.color}66` : 'rgba(240, 185, 11, 0.4)';
    const color = b.color || 'var(--brand-primary)';
    return `<span class="discord-badge" style="background:${bg};border:1px solid ${border};color:${color};" title="${b.desc || b.label}">
      <span class="discord-badge-icon">${b.icon || '★'}</span>
      ${!compact ? `<span>${b.label}</span>` : ''}
    </span>`;
  }).join('');
}

function renderUserNav() {
  const btnAuth = document.getElementById('btnOpenAuth');
  const chipWrap = document.getElementById('userChipWrap');
  const nameEl = document.getElementById('userNameText');
  const avatarEl = document.getElementById('userAvatarText');
  const badgeEl = document.getElementById('userRoleBadge');
  const dropUserTitle = document.getElementById('dropUserTitle');
  const dropSubStatus = document.getElementById('dropSubStatus');
  const dropAdminItem = document.getElementById('dropAdminItem');
  const inlineBadges = document.getElementById('userBadgesInline');
  const dropBadges = document.getElementById('dropBadgesRack');

  if (currentUser) {
    if (btnAuth) btnAuth.style.display = 'none';
    if (chipWrap) chipWrap.style.display = 'inline-flex';

    const displayName = currentUser.username || currentUser.telegram_username || 'Trader';
    if (nameEl) nameEl.textContent = displayName;
    if (avatarEl) {
      avatarEl.innerHTML = renderAvatarHtml(currentUser.avatar, displayName);
    }

    const role = currentUser.role || 'free';
    const sub = currentUser.subscription || {};

    if (badgeEl) {
      badgeEl.className = `role-badge ${role}`;
      if (role === 'founder') {
        badgeEl.textContent = (typeof language !== 'undefined' && language === 'fa') ? '★ فاندر سامانه' : '★ Founder';
      } else if (role === 'admin') {
        badgeEl.textContent = (typeof language !== 'undefined' && language === 'fa') ? '🛡️ ادمین سیستم' : '🛡️ Admin';
      } else if (role === 'premium' || sub.active) {
        badgeEl.textContent = (typeof language !== 'undefined' && language === 'fa') ? `VIP (${sub.daysLeft} روز)` : `VIP (${sub.daysLeft}d)`;
      } else {
        badgeEl.textContent = (typeof language !== 'undefined' && language === 'fa') ? 'عادی' : 'Free';
      }
    }

    // Render Discord badges in nav chip & dropdown
    if (inlineBadges) {
      inlineBadges.innerHTML = renderBadgesHtml(currentUser.badges, true);
    }
    if (dropBadges) {
      dropBadges.innerHTML = renderBadgesHtml(currentUser.badges, false);
    }

    if (dropUserTitle) dropUserTitle.textContent = displayName;
    if (dropSubStatus) {
      if (currentUser.bio) {
        dropSubStatus.textContent = currentUser.bio;
      } else if (role === 'founder') {
        dropSubStatus.textContent = (typeof language !== 'undefined' && language === 'fa') ? 'فاندر و صاحب سامانه (Lifetime VIP)' : 'System Founder & Owner';
      } else if (role === 'admin') {
        dropSubStatus.textContent = (typeof language !== 'undefined' && language === 'fa') ? 'ادمین سیستم و ارتباطات (Admin Access)' : 'System & Communications Admin';
      } else if (sub.active) {
        dropSubStatus.textContent = (typeof language !== 'undefined' && language === 'fa') ? `اشتراک ویژه تا ${sub.daysLeft} روز دیگر معتبر است` : `VIP Active: ${sub.daysLeft} days remaining`;
      } else {
        dropSubStatus.textContent = (typeof language !== 'undefined' && language === 'fa') ? 'پلن کاربری: عادی و دمو رایگان' : 'Account: Free Demo Tier';
      }
    }

    if (dropAdminItem) {
      dropAdminItem.style.display = (role === 'admin' || role === 'founder') ? 'flex' : 'none';
    }
  } else {
    if (btnAuth) btnAuth.style.display = 'inline-flex';
    if (chipWrap) chipWrap.style.display = 'none';
  }
}

let pendingCoinAfterLogin = null;

function promptAuthForCoin(symbol) {
  pendingCoinAfterLogin = symbol;
  const isNewCoin = symbol === 'NEW_COIN';
  const displaySym = isNewCoin
    ? (typeof language !== 'undefined' && language === 'fa' ? 'افزودن ارز دلخواه' : 'Custom Coins')
    : symbol;

  const alertBox = document.getElementById('authAlert');
  if (alertBox) {
    alertBox.className = 'auth-alert info';
    alertBox.style.display = 'block';
    alertBox.innerHTML = (typeof language !== 'undefined' && language === 'fa')
      ? `⚡ <b>محاسبه بیت‌کوین (BTC) کاملاً رایگان است.</b><br>برای دسترسی به <b>${displaySym}</b> و تمام ۵۰۰+ آلت‌کوین، به راحتی با ربات رسمی تلگرام متصل شوید (پیشنهادی):`
      : `⚡ <b>Bitcoin (BTC) is 100% free to calculate.</b><br>To unlock <b>${displaySym}</b> and 500+ live altcoins, connect in 1 tap via our official Telegram bot:`;
  }

  openAuthModal('telegram', false);

  if (typeof notify === 'function') {
    notify(
      (typeof language !== 'undefined' && language === 'fa')
        ? `برای استفاده از ${displaySym} با ربات تلگرام متصل شوید`
        : `Connect via Telegram bot to unlock ${displaySym}`
    );
  }
}

// Successful authentication handler
function onAuthSuccess(user, token) {
  setAuthToken(token);
  currentUser = user;
  renderUserNav();
  closeAuthModal();
  if (typeof updateSubscriptionUI === 'function') updateSubscriptionUI();
  if (typeof renderCoinChips === 'function') renderCoinChips();

  const nextCoin = pendingCoinAfterLogin;
  pendingCoinAfterLogin = null;

  if (nextCoin) {
    if (nextCoin === 'NEW_COIN') {
      if (typeof openAddCoinModal === 'function') openAddCoinModal();
    } else if (typeof setCoin === 'function') {
      setCoin(nextCoin, true);
    }
  }

  notify(
    (typeof language !== 'undefined' && language === 'fa')
      ? `خوش آمدید ${user.username || 'کاربر گرامی'}! تمام آلت‌کوین‌ها باز شدند.`
      : `Welcome ${user.username || 'Trader'}! All altcoins unlocked.`
  );
}

// Modal Toggle & Tabs
function openAuthModal(defaultTab = 'telegram', resetAlert = true) {
  if (resetAlert) {
    pendingCoinAfterLogin = null;
    const alertBox = document.getElementById('authAlert');
    if (alertBox) {
      alertBox.style.display = 'none';
      alertBox.className = 'auth-alert';
    }
  }
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'flex';
  switchAuthTab(defaultTab);
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'none';
  const alertBox = document.getElementById('authAlert');
  if (alertBox) alertBox.style.display = 'none';
}

function switchAuthTab(tabName) {
  document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.auth-tab-panel').forEach(p => p.classList.remove('active'));

  const activeBtn = document.getElementById(`tabBtn_${tabName}`);
  const activePanel = document.getElementById(`tabPanel_${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');
  if (activePanel) activePanel.classList.add('active');
}

function toggleEmailMode(mode) {
  emailAuthMode = mode;
  const isRegister = mode === 'register';
  const groupUsername = document.getElementById('emailGroupUsername');
  const btnSubmit = document.getElementById('btnSubmitEmail');
  const toggleText = document.getElementById('emailToggleText');

  if (groupUsername) groupUsername.style.display = isRegister ? 'block' : 'none';
  if (btnSubmit) {
    btnSubmit.textContent = isRegister
      ? (language === 'fa' ? 'ایجاد حساب کاربری جدید' : 'Create Account')
      : (language === 'fa' ? 'ورود به حساب کاربری' : 'Sign In');
  }
  if (toggleText) {
    toggleText.innerHTML = isRegister
      ? (language === 'fa' ? 'قبلاً ثبت‌نام کرده‌اید؟ <a onclick="toggleEmailMode(\'login\')">وارد شوید</a>' : 'Already have an account? <a onclick="toggleEmailMode(\'login\')">Sign In</a>')
      : (language === 'fa' ? 'حساب کاربری ندارید؟ <a onclick="toggleEmailMode(\'register\')">ثبت‌نام کنید</a>' : 'No account yet? <a onclick="toggleEmailMode(\'register\')">Sign Up</a>');
  }
}

function showAuthAlert(msg, type = 'error') {
  const alertBox = document.getElementById('authAlert');
  if (!alertBox) return;
  alertBox.className = `auth-alert ${type}`;
  alertBox.textContent = msg;
  alertBox.style.display = 'block';
}

// 1. Telegram Auth (Deep Link Bot via @mrsignallo_bot)
let tgPollingInterval = null;

async function startTelegramBotAuth() {
  const waitingBox = document.getElementById('tgWaitingBox');
  const btnConnect = document.getElementById('btnTgBotConnect');

  try {
    const res = await apiFetch('/api/auth/telegram/session');
    if (!res.success || !res.bot_url) throw new Error('Could not create bot session');

    window.open(res.bot_url, '_blank');

    if (waitingBox) waitingBox.style.display = 'block';
    if (btnConnect) btnConnect.style.display = 'none';

    if (tgPollingInterval) clearInterval(tgPollingInterval);
    const sessionCode = res.code;

    tgPollingInterval = setInterval(async () => {
      try {
        const pollData = await apiFetch(`/api/auth/telegram/poll?code=${sessionCode}`);
        if (pollData.verified && pollData.token) {
          clearInterval(tgPollingInterval);
          tgPollingInterval = null;
          onAuthSuccess(pollData.user, pollData.token);
        }
      } catch (e) {}
    }, 1500);

    setTimeout(() => {
      if (tgPollingInterval) {
        clearInterval(tgPollingInterval);
        tgPollingInterval = null;
        if (waitingBox) waitingBox.style.display = 'none';
        if (btnConnect) btnConnect.style.display = 'flex';
      }
    }, 180000);

  } catch (err) {
    showAuthAlert(err.message);
  }
}

function cancelTelegramBotAuth() {
  if (tgPollingInterval) {
    clearInterval(tgPollingInterval);
    tgPollingInterval = null;
  }
  const waitingBox = document.getElementById('tgWaitingBox');
  const btnConnect = document.getElementById('btnTgBotConnect');
  if (waitingBox) waitingBox.style.display = 'none';
  if (btnConnect) btnConnect.style.display = 'flex';
}

// 2. Email Auth
async function submitEmailAuth() {
  const emailInput = document.getElementById('authEmailInput');
  const pwdInput = document.getElementById('authPwdInput');
  const userInput = document.getElementById('authUsernameInput');

  const email = emailInput ? emailInput.value.trim() : '';
  const password = pwdInput ? pwdInput.value : '';
  const username = userInput ? userInput.value.trim() : '';

  if (!email || !password) {
    showAuthAlert(language === 'fa' ? 'لطفاً تمام فیلدها را تکمیل نمایید.' : 'Please fill all required fields.');
    return;
  }

  const endpoint = emailAuthMode === 'register' ? '/api/auth/register' : '/api/auth/login';
  const payload = { email, password };
  if (emailAuthMode === 'register') payload.username = username;

  try {
    const data = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    onAuthSuccess(data.user, data.token);
  } catch (err) {
    showAuthAlert(err.message);
  }
}

// 3. Web3 Wallet Auth
async function connectWeb3Wallet() {
  if (typeof window.ethereum === 'undefined') {
    showAuthAlert(
      language === 'fa'
        ? 'کیف‌پول وب۳ (مانند MetaMask یا TrustWallet) در مرورگر شما یافت نشد.'
        : 'Web3 Wallet extension (like MetaMask) not detected in your browser.'
    );
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error(language === 'fa' ? 'حسابی در کیف‌پول انتخاب نشد.' : 'No wallet account selected.');
    }

    const address = accounts[0];
    const data = await apiFetch('/api/auth/wallet', {
      method: 'POST',
      body: JSON.stringify({ address })
    });
    onAuthSuccess(data.user, data.token);
  } catch (err) {
    showAuthAlert(err.message);
  }
}

// Logout
async function logout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}

  setAuthToken(null);
  currentUser = null;
  toggleUserDropdown(false);
  renderUserNav();
  if (typeof setCoin === 'function') setCoin('BTC', false);
  if (typeof renderCoinChips === 'function') renderCoinChips('BTC');
  notify(language === 'fa' ? 'از حساب کاربری خارج شدید.' : 'Logged out successfully.');
  if (typeof updateSubscriptionUI === 'function') updateSubscriptionUI();
}

function toggleUserDropdown(forceState) {
  const drop = document.getElementById('userDropdown');
  if (!drop) return;
  if (typeof forceState === 'boolean') {
    drop.classList.toggle('show', forceState);
  } else {
    drop.classList.toggle('show');
  }
}

// ==========================================================================
// Admin Panel Management
// ==========================================================================
async function openAdminModal() {
  toggleUserDropdown(false);
  const modal = document.getElementById('adminModal');
  if (modal) modal.style.display = 'flex';
  loadAdminUsers();
}

function closeAdminModal() {
  const modal = document.getElementById('adminModal');
  if (modal) modal.style.display = 'none';
}

async function loadAdminUsers() {
  const tableBody = document.getElementById('adminTableBody');
  if (!tableBody) return;
  tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:16px;color:#848E9C;">در حال دریافت فهرست کاربران…</td></tr>`;

  try {
    const data = await apiFetch('/api/admin/users');
    if (!data.users || data.users.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:16px;color:#848E9C;">هیچ کاربری یافت نشد.</td></tr>`;
      return;
    }

    tableBody.innerHTML = data.users.map(u => {
      const identifier = u.telegram_username ? `@${u.telegram_username}` : (u.email || u.wallet_address || u.username);
      const roleBadge = u.role === 'admin'
        ? `<span class="role-badge admin">مدیر / Admin</span>`
        : (u.role === 'premium' ? `<span class="role-badge premium">VIP (${u.days_left}d)</span>` : `<span class="role-badge free">رایگان</span>`);

      return `
        <tr>
          <td>#${u.id}</td>
          <td><b>${u.username}</b></td>
          <td><code style="color:#848E9C;font-size:11px;">${identifier}</code></td>
          <td><span class="tag">${u.auth_provider}</span></td>
          <td>${roleBadge}</td>
          <td><b>${u.days_left} روز</b></td>
          <td>
            <button type="button" class="admin-action-btn vip" onclick="adminChangeRole(${u.id}, 'premium', 30)">+۳۰ روز VIP</button>
            <button type="button" class="admin-action-btn days" onclick="adminChangeRole(${u.id}, 'admin')">ارتقا به مدیر</button>
            <button type="button" class="admin-action-btn free" onclick="adminChangeRole(${u.id}, 'free')">عادی</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:16px;color:#F6465D;">خطا: ${err.message}</td></tr>`;
  }
}

async function adminChangeRole(userId, newRole, addDays = 0) {
  try {
    await apiFetch('/api/admin/set-user-role', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role: newRole, add_days: addDays })
    });
    notify(language === 'fa' ? 'نقش کاربر با موفقیت تغییر یافت.' : 'User role updated successfully.');
    loadAdminUsers();
    // If updating current user, refresh self
    if (currentUser && currentUser.id === userId) {
      initAuth();
    }
  } catch (err) {
    alert(err.message);
  }
}

// Global Click handler for dropdown
document.addEventListener('click', (e) => {
  const chip = document.getElementById('userChip');
  const drop = document.getElementById('userDropdown');
  if (drop && chip && !chip.contains(e.target) && !drop.contains(e.target)) {
    drop.classList.remove('show');
  }
});

// ==========================================================================
// Discord-Style Profile Customization Controller
// ==========================================================================
let currentEditAvatar = {
  type: 'preset',
  icon: 'bull',
  color: '#F0B90B',
  url: ''
};

function parseAvatar(avatarStr, username = 'U') {
  if (avatarStr && avatarStr.startsWith('url:')) {
    return { type: 'url', icon: 'bull', color: '#F0B90B', url: avatarStr.slice(4) };
  }
  if (avatarStr && avatarStr.startsWith('preset:')) {
    const parts = avatarStr.slice(7).split('|');
    return { type: 'preset', icon: parts[0] || 'bull', color: parts[1] || '#F0B90B', url: '' };
  }
  const charCode = (username || 'U').charCodeAt(0) || 65;
  const defIcon = AVATAR_ICONS[charCode % AVATAR_ICONS.length].key;
  const defColor = AVATAR_COLORS[charCode % AVATAR_COLORS.length].hex;
  return { type: 'preset', icon: defIcon, color: defColor, url: '' };
}

function openProfileModal() {
  toggleUserDropdown(false);
  if (!currentUser) return;

  const modal = document.getElementById('profileModal');
  if (!modal) return;

  currentEditAvatar = parseAvatar(currentUser.avatar, currentUser.username);

  const nameInput = document.getElementById('profileNameInput');
  const bioInput = document.getElementById('profileBioInput');
  const imgUrlInput = document.getElementById('profileImgUrlInput');

  if (nameInput) nameInput.value = currentUser.username || '';
  if (bioInput) bioInput.value = currentUser.bio || '';
  if (imgUrlInput) imgUrlInput.value = currentEditAvatar.type === 'url' ? currentEditAvatar.url : '';

  renderAvatarPresetsUI();
  updateProfilePreview();

  modal.style.display = 'flex';
}

function closeProfileModal() {
  const modal = document.getElementById('profileModal');
  if (modal) modal.style.display = 'none';
}

function renderAvatarPresetsUI() {
  const grid = document.getElementById('avatarPresetsGrid');
  if (grid) {
    grid.innerHTML = AVATAR_ICONS.map(i => `
      <button type="button" class="avatar-preset-btn ${currentEditAvatar.type === 'preset' && currentEditAvatar.icon === i.key ? 'active' : ''}" onclick="selectAvatarPreset('${i.key}')" title="${i.name}">
        <span>${i.emoji}</span>
      </button>
    `).join('');
  }

  const colorsRow = document.getElementById('colorSwatchesRow');
  if (colorsRow) {
    colorsRow.innerHTML = AVATAR_COLORS.map(c => `
      <button type="button" class="color-swatch ${currentEditAvatar.color === c.hex ? 'active' : ''}" style="background:${c.hex};" onclick="selectAvatarColor('${c.hex}')" title="${c.name}"></button>
    `).join('');
  }
}

function selectAvatarPreset(iconKey) {
  currentEditAvatar.type = 'preset';
  currentEditAvatar.icon = iconKey;
  const imgUrlInput = document.getElementById('profileImgUrlInput');
  if (imgUrlInput) imgUrlInput.value = '';
  renderAvatarPresetsUI();
  updateProfilePreview();
}

function selectAvatarColor(colorHex) {
  currentEditAvatar.color = colorHex;
  renderAvatarPresetsUI();
  updateProfilePreview();
}

function onCustomAvatarUrlInput() {
  const input = document.getElementById('profileImgUrlInput');
  const val = input ? input.value.trim() : '';
  if (val && /^https?:\/\//i.test(val)) {
    currentEditAvatar.type = 'url';
    currentEditAvatar.url = val;
  } else {
    currentEditAvatar.type = 'preset';
  }
  renderAvatarPresetsUI();
  updateProfilePreview();
}

function randomizeProfileAvatar() {
  const randomIcon = AVATAR_ICONS[Math.floor(Math.random() * AVATAR_ICONS.length)].key;
  const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)].hex;
  currentEditAvatar.type = 'preset';
  currentEditAvatar.icon = randomIcon;
  currentEditAvatar.color = randomColor;
  currentEditAvatar.url = '';

  const imgUrlInput = document.getElementById('profileImgUrlInput');
  if (imgUrlInput) imgUrlInput.value = '';

  renderAvatarPresetsUI();
  updateProfilePreview();

  const av = document.getElementById('profileAvatarPreview');
  if (av) {
    av.style.transform = 'scale(1.2) rotate(15deg)';
    setTimeout(() => { av.style.transform = ''; }, 200);
  }
}

function updateProfilePreview() {
  if (!currentUser) return;
  const nameInput = document.getElementById('profileNameInput');
  const bioInput = document.getElementById('profileBioInput');

  const displayName = (nameInput && nameInput.value.trim()) || currentUser.username || 'Trader';
  const bio = (bioInput && bioInput.value.trim()) || currentUser.bio || 'Precision Futures Trader · MRSIGNALLL';

  const namePrev = document.getElementById('profileNamePreview');
  const handlePrev = document.getElementById('profileHandlePreview');
  const bioPrev = document.getElementById('profileBioPreview');
  const bannerPrev = document.getElementById('profileBannerPreview');
  const avatarPrev = document.getElementById('profileAvatarPreview');
  const badgesPrev = document.getElementById('profileBadgesPreview');

  if (namePrev) namePrev.textContent = displayName;
  if (handlePrev) handlePrev.textContent = currentUser.telegram_username ? `@${currentUser.telegram_username}` : (currentUser.email || `@trader_${currentUser.id}`);
  if (bioPrev) bioPrev.textContent = bio;

  const themeColor = currentEditAvatar.color || '#F0B90B';
  if (bannerPrev) {
    bannerPrev.style.background = `linear-gradient(135deg, ${themeColor}77 0%, #181D24 100%)`;
  }

  if (avatarPrev) {
    const avatarStr = currentEditAvatar.type === 'url' && currentEditAvatar.url
      ? `url:${currentEditAvatar.url}`
      : `preset:${currentEditAvatar.icon}|${currentEditAvatar.color}`;
    avatarPrev.innerHTML = renderAvatarHtml(avatarStr, displayName);
  }

  if (badgesPrev) {
    badgesPrev.innerHTML = renderBadgesHtml(currentUser.badges, false);
  }
}

async function saveUserProfile() {
  if (!currentUser) return;
  const nameInput = document.getElementById('profileNameInput');
  const bioInput = document.getElementById('profileBioInput');
  const btnSave = document.getElementById('btnSaveProfile');

  const username = nameInput ? nameInput.value.trim() : '';
  const bio = bioInput ? bioInput.value.trim() : '';

  if (!username) {
    notify((typeof language !== 'undefined' && language === 'fa') ? 'نام کاربری نمی‌تواند خالی باشد.' : 'Display Name cannot be empty.');
    return;
  }

  const avatarStr = currentEditAvatar.type === 'url' && currentEditAvatar.url
    ? `url:${currentEditAvatar.url}`
    : `preset:${currentEditAvatar.icon}|${currentEditAvatar.color}`;

  if (btnSave) btnSave.disabled = true;

  try {
    const res = await apiFetch('/api/user/profile', {
      method: 'POST',
      body: JSON.stringify({
        username,
        bio,
        avatar: avatarStr
      })
    });

    if (res.success && res.user) {
      currentUser = res.user;
      renderUserNav();
      closeProfileModal();
      notify((typeof language !== 'undefined' && language === 'fa') ? 'نمایه با موفقیت ذخیره شد! 🎨' : 'Profile updated successfully! 🎨');
    }
  } catch (err) {
    notify(err.message);
  } finally {
    if (btnSave) btnSave.disabled = false;
  }
}

window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.randomizeProfileAvatar = randomizeProfileAvatar;
window.selectAvatarPreset = selectAvatarPreset;
window.selectAvatarColor = selectAvatarColor;
window.onCustomAvatarUrlInput = onCustomAvatarUrlInput;
window.updateProfilePreview = updateProfilePreview;
window.saveUserProfile = saveUserProfile;
