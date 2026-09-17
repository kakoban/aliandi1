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

  if (currentUser) {
    if (btnAuth) btnAuth.style.display = 'none';
    if (chipWrap) chipWrap.style.display = 'block';

    const displayName = currentUser.username || currentUser.telegram_username || 'User';
    if (nameEl) nameEl.textContent = displayName;
    if (avatarEl) avatarEl.textContent = (displayName[0] || 'U').toUpperCase();

    const role = currentUser.role || 'free';
    const sub = currentUser.subscription || {};

    if (badgeEl) {
      badgeEl.className = `role-badge ${role}`;
      if (role === 'founder') {
        badgeEl.textContent = language === 'fa' ? '★ فاندر سامانه' : '★ Founder';
      } else if (role === 'admin') {
        badgeEl.textContent = language === 'fa' ? '🛡️ ادمین سیستم' : '🛡️ Admin';
      } else if (role === 'premium' || sub.active) {
        badgeEl.textContent = language === 'fa' ? `VIP (${sub.daysLeft} روز)` : `VIP (${sub.daysLeft}d)`;
      } else {
        badgeEl.textContent = language === 'fa' ? 'عادی' : 'Free';
      }
    }

    if (dropUserTitle) dropUserTitle.textContent = displayName;
    if (dropSubStatus) {
      if (role === 'founder') {
        dropSubStatus.textContent = language === 'fa' ? 'فاندر و صاحب سامانه (Lifetime VIP)' : 'System Founder & Owner';
      } else if (role === 'admin') {
        dropSubStatus.textContent = language === 'fa' ? 'ادمین سیستم و ارتباطات (Admin Access)' : 'System & Communications Admin';
      } else if (sub.active) {
        dropSubStatus.textContent = language === 'fa' ? `اشتراک ویژه تا ${sub.daysLeft} روز دیگر معتبر است` : `VIP Active: ${sub.daysLeft} days remaining`;
      } else {
        dropSubStatus.textContent = language === 'fa' ? 'پلن کاربری: عادی و دمو رایگان' : 'Account: Free Demo Tier';
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

// Modal Toggle & Tabs
function openAuthModal(defaultTab = 'telegram') {
  const modal = document.getElementById('authModal');
  const alertBox = document.getElementById('authAlert');
  if (alertBox) alertBox.style.display = 'none';
  if (modal) modal.style.display = 'flex';
  switchAuthTab(defaultTab);
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'none';
}

function switchAuthTab(tabName) {
  document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.auth-tab-panel').forEach(p => p.classList.remove('active'));

  const activeBtn = document.getElementById(`tabBtn_${tabName}`);
  const activePanel = document.getElementById(`tabPanel_${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');
  if (activePanel) activePanel.classList.add('active');

  const alertBox = document.getElementById('authAlert');
  if (alertBox) alertBox.style.display = 'none';
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

// 1. Telegram Auth (Method 1: Deep Link Bot & Method 2: Direct Input)
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
          setAuthToken(pollData.token);
          currentUser = pollData.user;
          renderUserNav();
          closeAuthModal();
          notify(language === 'fa' ? `خوش آمدید ${currentUser.username}!` : `Welcome ${currentUser.username}!`);
          if (typeof updateSubscriptionUI === 'function') updateSubscriptionUI();
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

async function submitTelegramAuth() {
  const input = document.getElementById('tgUsernameInput');
  let val = input ? input.value.trim() : '';

  if (!val) {
    showAuthAlert(language === 'fa' ? 'لطفاً شناسه عددی یا آیدی تلگرام خود را وارد کنید.' : 'Please enter your Telegram ID or username.');
    return;
  }

  val = val.replace(/^@/, '');
  const isNumeric = /^[0-9]+$/.test(val);
  const payload = isNumeric ? { telegram_id: val } : { username: val };

  try {
    const data = await apiFetch('/api/auth/telegram', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setAuthToken(data.token);
    currentUser = data.user;
    renderUserNav();
    closeAuthModal();
    notify(language === 'fa' ? `خوش آمدید ${currentUser.username}!` : `Welcome ${currentUser.username}!`);
    if (typeof updateSubscriptionUI === 'function') updateSubscriptionUI();
  } catch (err) {
    showAuthAlert(err.message);
  }
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
    setAuthToken(data.token);
    currentUser = data.user;
    renderUserNav();
    closeAuthModal();
    notify(language === 'fa' ? `ورود با موفقیت انجام شد!` : `Successfully signed in!`);
    if (typeof updateSubscriptionUI === 'function') updateSubscriptionUI();
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

    setAuthToken(data.token);
    currentUser = data.user;
    renderUserNav();
    closeAuthModal();
    notify(language === 'fa' ? `کیف‌پول ${currentUser.username} متصل شد!` : `Wallet ${currentUser.username} connected!`);
    if (typeof updateSubscriptionUI === 'function') updateSubscriptionUI();
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
