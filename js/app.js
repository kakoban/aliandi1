/**
 * MRSIGNALLL Position Calculator Pro - Main Application Controller
 * Binance Visual Standard Edition
 */

'use strict';

const $ = id => document.getElementById(id);
let language = 'en';
let currentTheme = 'dark';
let direction = 1; // 1 = LONG, -1 = SHORT
let lastResult = null;
let toastTimer = null;

function initTheme() {
  let savedTheme = 'dark';
  try {
    savedTheme = localStorage.getItem('mrsignalll_theme') || 'dark';
  } catch (e) {}
  setTheme(savedTheme, false);
}

function setTheme(theme, save = true) {
  currentTheme = theme;
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.body.removeAttribute('data-theme');
  }
  if (save) {
    try {
      localStorage.setItem('mrsignalll_theme', theme);
    } catch (e) {}
  }
  const btn = $('btnThemeToggle');
  if (btn) {
    const isLight = theme === 'light';
    btn.setAttribute('aria-label', isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode');
    btn.setAttribute('title', isLight ? (language === 'fa' ? 'تغییر به تم تاریک' : 'Switch to Dark Mode') : (language === 'fa' ? 'تغییر به تم روشن' : 'Switch to Light Mode'));
  }
}

function toggleTheme() {
  const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(nextTheme, true);
  if (typeof notify === 'function') {
    notify(
      language === 'fa'
        ? (nextTheme === 'light' ? 'تم روشن فعال شد ☀️' : 'تم تاریک فعال شد 🌙')
        : (nextTheme === 'light' ? 'Light mode enabled ☀️' : 'Dark mode enabled 🌙')
    );
  }
}

window.toggleTheme = toggleTheme;
window.setTheme = setTheme;
window.initTheme = initTheme;

const messages = {
  example: [
    'حالت مثال آموزشی؛ برای محاسبه دقیق قیمت زنده را دریافت کنید.',
    'Illustrative example; fetch live Binance price for live market calculation.'
  ],
  manual: [
    'ورود دستی قیمت؛ این مقدار خودکار تازه نمی‌شود.',
    'Manual entry; this price does not auto-refresh.'
  ],
  loading: [
    'در حال دریافت آخرین قیمت قرارداد خطی USDT از بایننس…',
    'Fetching live USDT contract price from Binance…'
  ],
  fetched: [
    'آخرین قیمت معامله دریافت شد؛ بازبینی استاپ و هدف لازم است. زمان: ',
    'Last trade price fetched; review your stop and target. Retrieved: '
  ],
  failed: [
    'دریافت قیمت از بایننس ممکن نشد؛ نماد یا اینترنت را بررسی کنید و دستی وارد نمایید.',
    'Binance price request failed. Check the symbol or enter price manually.'
  ],
  symbol: [
    'نماد پایه را با حروف انگلیسی وارد کنید؛ مانند BTC یا ETH.',
    'Enter a base symbol using English letters, e.g. BTC or ETH.'
  ],
  invalid: [
    'ورودی‌ها را اصلاح کنید. موجودی و قیمت‌ها باید مثبت، ریسک و مارجین در بازهٔ ۰ تا ۱۰۰ باشند.',
    'Correct the inputs. Balance and prices must be positive, risk and margin between 0 and 100.'
  ],
  longStop: [
    'در معاملهٔ خرید (LONG)، حد ضرر باید پایین‌تر از قیمت ورود باشد.',
    'For a LONG trade, stop loss must be below entry price.'
  ],
  shortStop: [
    'در معاملهٔ فروش (SHORT)، حد ضرر باید بالاتر از قیمت ورود باشد.',
    'For a SHORT trade, stop loss must be above entry price.'
  ],
  longTarget: [
    'در معاملهٔ LONG، حد سود باید بالاتر از ورود باشد؛ یا خالی بگذارید.',
    'For a LONG trade, take profit must be above entry or left blank.'
  ],
  shortTarget: [
    'در معاملهٔ SHORT، حد سود باید پایین‌تر از ورود باشد؛ یا خالی بگذارید.',
    'For a SHORT trade, take profit must be below entry or left blank.'
  ],
  settings: [
    'کارمزد بین ۰ تا ۱۰٪، مارجین نگهداری ۰ تا ۹۹٪ و فاصله مدل ۰ تا ۵۰۰٪ باشد.',
    'Fee must be 0–10%, maintenance margin 0–99%, and model buffer 0–500%.'
  ],
  infeasible: [
    'با این فاصله استاپ و نرخ نگهداری، اهرم مدل پاسخگو نیست. ورودی‌ها را بازبینی کنید.',
    'No integer leverage satisfies the modeled stop buffer. Review inputs.'
  ],
  capped: [
    'اهرم به سقف انتخابی یا حد فاصله مدل محدود شد.',
    'Leverage has been limited by your chosen cap or model limit.'
  ],
  budget: [
    'مارجین اولیه از بودجهٔ مارجین انتخابی شما فراتر رفته است.',
    'Initial margin exceeds your selected margin budget.'
  ],
  funds: [
    'مارجین به‌علاوهٔ کارمزد ورود از موجودی کل حساب بیشتر است.',
    'Margin plus entry fee exceeds your account balance.'
  ],
  excluded: [
    'کارمزد در حجم‌گیری لحاظ نشده؛ زیان نهایی از سقف ریسک بیشتر است.',
    'Fees are excluded from sizing; loss with fees exceeds risk budget.'
  ],
  lowProfit: [
    'کارمزدها سود ناخالص را مصرف می‌کنند؛ سود خالص مثبت نیست.',
    'Fees consume gross target profit; net profit is not positive.'
  ],
  overflow: [
    'ورودی‌ها خارج از دامنهٔ مجاز محاسبه هستند.',
    'Input combination is outside calculation range.'
  ],
  copied: [
    'خلاصهٔ سناریوی معامله در کلیپ‌بورد کپی شد.',
    'Trade scenario summary copied to clipboard.'
  ],
  selectCopy: [
    'کپی خودکار ممکن نشد؛ لطفاً متن را دستی کپی کنید.',
    'Automatic copying unavailable. Copy text manually.'
  ],
  title: [
    'MRSIGNALLL | Professional Binance Futures Risk & Position Calculator',
    'MRSIGNALLL | Professional Binance Futures Risk & Position Calculator'
  ]
};

const text = key => {
  if (typeof I18N_DICTIONARY !== 'undefined' && I18N_DICTIONARY[key]) {
    const entry = I18N_DICTIONARY[key];
    return entry[language] || entry['en'] || entry['fa'] || '';
  }
  if (messages[key]) {
    return messages[key][language === 'fa' ? 0 : 1] || messages[key][1] || '';
  }
  return '';
};
const fmt = (value, digits = 2) => Number.isFinite(value)
  ? value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits === 2 ? 2 : 0 })
  : '—';
const number = id => $(id).value.trim() === '' ? NaN : Number($(id).value);

function notify(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.textContent = ''; }, 4000);
}

function toggleLangDropdown(forceState) {
  const menu = document.getElementById('langDropdownMenu');
  if (!menu) return;
  if (typeof forceState === 'boolean') {
    menu.classList.toggle('show', forceState);
  } else {
    menu.classList.toggle('show');
  }
}

function selectLanguage(langCode) {
  toggleLangDropdown(false);
  setLanguage(langCode);
}

function setLanguage(value) {
  const langConfig = (typeof SUPPORTED_LANGUAGES !== 'undefined' && SUPPORTED_LANGUAGES[value])
    ? SUPPORTED_LANGUAGES[value]
    : { code: value.toUpperCase(), dir: (value === 'fa' || value === 'ar') ? 'rtl' : 'ltr' };

  language = value;
  document.documentElement.lang = language;
  document.documentElement.dir = langConfig.dir;
  document.title = text('title');

  // Update dynamic elements
  document.querySelectorAll('[data-fa][data-en]').forEach(el => {
    const attrVal = el.getAttribute(`data-${language}`);
    if (attrVal) {
      el.textContent = attrVal;
    } else if (language === 'fa') {
      el.textContent = el.dataset.fa;
    } else if (language === 'en') {
      el.textContent = el.dataset.en;
    } else {
      // Look up translation in I18N_DICTIONARY
      const enText = el.dataset.en || '';
      if (typeof translateText === 'function') {
        el.textContent = translateText(enText, language);
      } else {
        el.textContent = enText;
      }
    }
  });

  document.querySelectorAll('[data-fa-placeholder][data-en-placeholder]').forEach(el => {
    const phVal = el.getAttribute(`data-${language}-placeholder`);
    if (phVal) {
      el.placeholder = phVal;
    } else if (language === 'fa') {
      el.placeholder = el.getAttribute('data-fa-placeholder');
    } else if (language === 'en') {
      el.placeholder = el.getAttribute('data-en-placeholder');
    } else {
      const enPh = el.getAttribute('data-en-placeholder') || '';
      if (typeof translateText === 'function') {
        el.placeholder = translateText(enPh, language);
      } else {
        el.placeholder = enPh;
      }
    }
  });

  // Update current language badge in dropdown
  const codeEl = document.getElementById('langCurrentCode');
  if (codeEl) codeEl.textContent = langConfig.code;

  // Update active state in dropdown list
  document.querySelectorAll('.lang-option-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.langCode === language);
  });

  try { localStorage.setItem('mrsignalll-language', language); } catch (e) {}

  renderQuote();
  calculate();
  try {
    updateMultiTP();
    updateSubscriptionUI();
    if (typeof renderUserNav === 'function') renderUserNav();
  } catch (e) {}
}

function calculate() {
  const v = {
    direction,
    feesInRisk: $('feesInRisk') ? $('feesInRisk').checked : true
  };

  Object.keys(CalcDefaults).forEach(id => {
    v[id] = number(id);
  });
  v.target = ($('target') && $('target').value.trim() === '') ? null : number('target');

  document.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  const errors = [];
  const mark = (id, key) => {
    const el = $(id);
    if (el) el.setAttribute('aria-invalid', 'true');
    if (!errors.includes(key)) errors.push(key);
  };

  for (const id of ['balance', 'entry', 'stop']) {
    if (!Number.isFinite(v[id]) || v[id] <= 0) mark(id, 'invalid');
  }
  for (const id of ['risk', 'marginPct']) {
    if (!Number.isFinite(v[id]) || v[id] <= 0 || v[id] > 100) mark(id, 'invalid');
  }
  if (!Number.isInteger(v.maxLev) || v.maxLev < 1 || v.maxLev > 125) mark('maxLev', 'invalid');
  for (const [id, max] of [['fee', 10], ['mmr', 99], ['buffer', 500]]) {
    if (!Number.isFinite(v[id]) || v[id] < 0 || v[id] > max) mark(id, 'settings');
  }
  if (!validCoin(coin())) mark('symbol', 'symbol');

  if (v.entry > 0 && v.stop > 0 && direction * (v.entry - v.stop) <= 0) {
    mark('stop', direction === 1 ? 'longStop' : 'shortStop');
  }
  if (v.target !== null && (!Number.isFinite(v.target) || v.target <= 0)) {
    mark('target', 'invalid');
  } else if (v.target !== null && v.entry > 0 && direction * (v.target - v.entry) <= 0) {
    mark('target', direction === 1 ? 'longTarget' : 'shortTarget');
  }

  // Update Result Badge with Redundant Non-Color Signal (▲ / ▼)
  const resultSymbolEl = $('resultSymbol');
  if (resultSymbolEl) {
    const dirIcon = direction === 1 ? '▲ LONG' : '▼ SHORT';
    const c = validCoin(coin()) ? coin() : 'BTC';
    resultSymbolEl.innerHTML = `<span>${c}USDT</span> <span class="result-badge ${direction === 1 ? 'long' : 'short'}">${dirIcon}</span>`;
  }

  const fail = () => {
    lastResult = null;
    const errBox = $('error');
    if (errBox) {
      errBox.hidden = false;
      errBox.textContent = errors.map(text).join(' ');
    }
    document.querySelectorAll('[data-result]').forEach(el => el.textContent = '—');
    const warnBox = $('calcWarning');
    if (warnBox) warnBox.hidden = true;
    const copyBtn = $('copyReport');
    if (copyBtn) copyBtn.disabled = true;
  };

  if (errors.length) {
    fail();
    return;
  }

  const r = getModel(v);
  if (Object.values(r).some(val => val !== null && !Number.isFinite(val)) || r.q <= 0 || r.notional <= 0 || r.stopLoss <= 0) {
    errors.push('overflow');
    fail();
    return;
  }

  lastResult = { ...r, inputs: v, coin: coin() };
  const errBox = $('error');
  if (errBox) errBox.hidden = true;
  const copyBtn = $('copyReport');
  if (copyBtn) copyBtn.disabled = false;

  // Render values to UI with fluid micro-animation
  if ($('notional')) {
    $('notional').textContent = fmt(r.notional);
    $('notional').classList.remove('result-calc-pulse');
    void $('notional').offsetWidth;
    $('notional').classList.add('result-calc-pulse');
  }
  if ($('quantity')) $('quantity').textContent = fmt(r.q, 10) + ' ' + coin();
  if ($('riskCash')) $('riskCash').textContent = fmt(r.riskCash);

  if ($('leverage')) $('leverage').textContent = r.lev === null ? '—' : r.lev + '×';
  if ($('margin')) $('margin').textContent = r.margin === null ? '—' : fmt(r.margin) + ' USDT';
  if ($('fees')) $('fees').textContent = fmt(r.stopFees) + ' USDT';

  // Redundant Non-color signal for Stop Loss: always "- (loss)"
  if ($('stopLoss')) {
    $('stopLoss').textContent = `- ${fmt(r.stopLoss)} USDT (▼)`;
    $('stopLoss').className = 'bad';
  }

  if ($('liq')) $('liq').textContent = r.liq === null ? '—' : fmt(r.liq, r.liq >= 1 ? 2 : 8) + ' USDT';
  if ($('breakEven')) $('breakEven').textContent = r.breakEven ? fmt(r.breakEven, r.breakEven >= 1 ? 2 : 8) + ' USDT' : '—';
  if ($('rr')) $('rr').textContent = r.rr === null ? '—' : fmt(r.rr) + ' : 1';

  // Redundant Non-color signal for Profit: always "+ (gain)" or "-"
  if ($('profit')) {
    if (r.profit === null) {
      $('profit').textContent = '—';
      $('profit').className = '';
    } else if (r.profit > 0) {
      $('profit').textContent = `+ ${fmt(r.profit)} USDT (▲)`;
      $('profit').className = 'good';
    } else {
      $('profit').textContent = `- ${fmt(Math.abs(r.profit))} USDT (▼)`;
      $('profit').className = 'bad';
    }
  }

  const warnings = [];
  if (r.lev === null) warnings.push('infeasible');
  else {
    if (r.lev < r.desiredLev) warnings.push('capped');
    if (r.margin > r.marginBudget + 1e-8) warnings.push('budget');
    if (r.margin + r.entryFee > v.balance + 1e-8) warnings.push('funds');
  }
  if (!v.feesInRisk && r.stopFees > 0) warnings.push('excluded');
  if (r.profit !== null && r.profit <= 0) warnings.push('lowProfit');

  const warnBox = $('calcWarning');
  if (warnBox) {
    warnBox.hidden = warnings.length === 0;
    warnBox.textContent = warnings.map(text).join(' ');
  }

  // Update Hero trade preview lines dynamically
  updateHeroPreview(v, r);
}

function updateHeroPreview(v, r) {
  const heroNotional = $('heroNotionalVal');
  const heroBalance = $('heroBalanceVal');
  const heroRiskPct = $('heroRiskPctVal');
  const heroStopDist = $('heroStopDistVal');
  const heroTpLine = $('heroTpLine');
  const heroEntryLine = $('heroEntryLine');
  const heroSlLine = $('heroSlLine');

  if (heroNotional) heroNotional.textContent = fmt(r.riskCash);
  if (heroBalance) heroBalance.textContent = fmt(v.balance) + ' USDT';
  if (heroRiskPct) heroRiskPct.textContent = fmt(v.risk) + '%';

  const distPct = v.entry > 0 ? (Math.abs(v.entry - v.stop) / v.entry) * 100 : 2;
  if (heroStopDist) heroStopDist.textContent = fmt(distPct, 2) + '%';

  if (heroTpLine) heroTpLine.textContent = v.target ? fmt(v.target) : '—';
  if (heroEntryLine) heroEntryLine.textContent = fmt(v.entry);
  if (heroSlLine) heroSlLine.textContent = fmt(v.stop);
}

function setDirection(next) {
  if (direction === next) return;
  const e = number('entry');
  const s = number('stop');
  const t = number('target');

  if (e > 0 && s > 0 && direction * (e - s) > 0) {
    $('stop').value = priceValue(e - next * Math.abs(e - s));
  }
  if (e > 0 && t > 0 && direction * (t - e) > 0) {
    $('target').value = priceValue(e + next * Math.abs(t - e));
  }

  direction = next;
  $('long').setAttribute('aria-pressed', String(next === 1));
  $('short').setAttribute('aria-pressed', String(next === -1));
  calculate();
  try {
    updateMultiTP();
    updateSubscriptionUI();
  } catch (e) {}
}

function setCoin(symbol, autoFetch = true) {
  cancelQuote();
  $('symbol').value = symbol;
  const e = samplePrices[symbol] || 65000;
  $('entry').value = e;
  $('stop').value = priceValue(e * (1 - direction * 0.02));
  $('target').value = priceValue(e * (1 + direction * 0.06));

  if (typeof renderCoinChips === 'function') {
    renderCoinChips(symbol);
  } else {
    document.querySelectorAll('[data-coin]').forEach(el => {
      el.setAttribute('aria-pressed', String(el.dataset.coin === symbol));
    });
  }

  quoteState = { kind: 'example' };
  renderQuote();
  calculate();
  try {
    updateMultiTP();
    updateSubscriptionUI();
  } catch (e) {}

  if (autoFetch && typeof fetchPrice === 'function') {
    fetchPrice(symbol);
  }
}

async function copyReport() {
  if (!lastResult) return;
  const r = lastResult;
  const v = r.inputs;

  const labels = language === 'fa'
    ? ['خلاصهٔ پوزیشن MRSIGNALLL (بایننس خطی)', 'ورود', 'حد ضرر', 'حد سود', 'ارزش پوزیشن', 'تعداد', 'اهرم', 'مارجین', 'زیان استاپ با کارمزد', 'سود خالص هدف', 'بودجهٔ ریسک', 'قیمت سر‌به‌سر (BE)', 'تخمین لیکوئیدی']
    : ['MRSIGNALLL Trade Summary (Binance Linear)', 'Entry', 'Stop Loss', 'Take Profit', 'Position Notional', 'Quantity', 'Leverage', 'Margin', 'Stop Loss incl. fees', 'Net Profit at Target', 'Risk Budget', 'Break-Even (BE)', 'Est. Liquidation'];

  const report = [
    '=== ' + labels[0] + ' ===',
    r.coin + 'USDT / ' + (direction === 1 ? '▲ LONG' : '▼ SHORT'),
    labels[1] + ': ' + fmt(v.entry, 8) + ' USDT',
    labels[2] + ': ' + fmt(v.stop, 8) + ' USDT',
    labels[3] + ': ' + (v.target === null ? '—' : fmt(v.target, 8) + ' USDT'),
    labels[11] + ': ' + (r.breakEven ? fmt(r.breakEven, 8) + ' USDT' : '—'),
    labels[12] + ': ' + (r.liq === null ? '—' : fmt(r.liq, 8) + ' USDT'),
    labels[4] + ': ' + fmt(r.notional) + ' USDT',
    labels[5] + ': ' + fmt(r.q, 8) + ' ' + r.coin,
    labels[6] + ': ' + (r.lev === null ? '—' : r.lev + 'x'),
    labels[7] + ': ' + (r.margin === null ? '—' : fmt(r.margin) + ' USDT'),
    labels[8] + ': ' + fmt(r.stopLoss) + ' USDT',
    labels[9] + ': ' + (r.profit === null ? '—' : fmt(r.profit) + ' USDT'),
    labels[10] + ': ' + fmt(r.riskCash) + ' USDT',
    $('calcWarning') && !$('calcWarning').hidden ? $('calcWarning').textContent : '',
    language === 'fa' ? 'محاسبه در مرورگر؛ شخصاً تحقیق کنید.' : 'Browser calculation; do your own research.',
    'https://t.me/MRSIGNALLL'
  ].filter(Boolean).join('\n');

  try {
    if (!navigator.clipboard) throw new Error('No clipboard API');
    await navigator.clipboard.writeText(report);
    notify(text('copied'));
  } catch (err) {
    let area = $('manualCopy');
    if (!area) {
      area = document.createElement('textarea');
      area.id = 'manualCopy';
      area.style.cssText = 'width:100%;height:160px;margin-top:12px;font:12px/1.8 monospace;direction:ltr;background:#121519;color:#fff;border:1px solid #F0B90B;padding:8px;border-radius:6px;';
      $('copyReport').after(area);
    }
    area.value = report;
    area.focus();
    area.select();
    try {
      if (document.execCommand('copy')) {
        area.remove();
        notify(text('copied'));
        return;
      }
    } catch (e) {}
    notify(text('selectCopy'));
  }
}

// Wire Event Listeners on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  $('calcForm').addEventListener('submit', e => e.preventDefault());

  $('calcForm').addEventListener('input', event => {
    if (event.target.id === 'entry') manualEntry();
    if (event.target.id === 'symbol') {
      manualEntry();
      for (const id of ['entry', 'stop', 'target']) $(id).value = '';
      document.querySelectorAll('[data-coin]').forEach(el => {
        el.setAttribute('aria-pressed', String(el.dataset.coin === coin()));
      });
    }
    calculate();
    try {
      updateMultiTP();
      updateSubscriptionUI();
    } catch (e) {}
  });

  if ($('feesInRisk')) $('feesInRisk').addEventListener('change', calculate);
  if ($('long')) $('long').addEventListener('click', () => setDirection(1));
  if ($('short')) $('short').addEventListener('click', () => setDirection(-1));

  if ($('langFa')) $('langFa').addEventListener('click', () => setLanguage('fa'));
  if ($('langEn')) $('langEn').addEventListener('click', () => setLanguage('en'));

  if ($('fetchPrice')) $('fetchPrice').addEventListener('click', fetchPrice);
  if ($('copyReport')) $('copyReport').addEventListener('click', copyReport);

  document.querySelectorAll('[data-coin]').forEach(el => {
    el.addEventListener('click', () => setCoin(el.dataset.coin));
  });

  document.querySelectorAll('[data-stop]').forEach(el => {
    el.addEventListener('click', () => {
      const e = number('entry');
      if (e > 0) {
        $('stop').value = priceValue(e * (1 - direction * Number(el.dataset.stop) / 100));
        calculate();
      }
    });
  });

  if ($('reset')) {
    $('reset').addEventListener('click', () => {
      cancelQuote();
      direction = 1;
      $('long').setAttribute('aria-pressed', 'true');
      $('short').setAttribute('aria-pressed', 'false');
      for (const [id, value] of Object.entries(CalcDefaults)) $(id).value = value;
      $('feesInRisk').checked = true;
      setCoin('BTC');
      const manualArea = $('manualCopy');
      if (manualArea) manualArea.remove();
    });
  }

  // Wallex Plan Buttons
  document.querySelectorAll('[data-plan]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-plan]').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      currentPlan = btn.dataset.plan;
      updatePaymentDetails();
    });
  });

  // Wallex Network Buttons
  document.querySelectorAll('[data-net]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-net]').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      currentNet = btn.dataset.net;
      updatePaymentDetails();
    });
  });

  // Copy Buttons
  if ($('btnCopyAmount')) {
    $('btnCopyAmount').addEventListener('click', () => {
      const val = $('depAmountDisplay') ? $('depAmountDisplay').textContent : '1.00';
      navigator.clipboard.writeText(val.replace(/[^0-9.]/g, ''));
      notify(language === 'fa' ? 'مبلغ واریز کپی شد!' : 'Amount copied!');
    });
  }

  if ($('btnCopyAddress')) {
    $('btnCopyAddress').addEventListener('click', () => {
      const val = $('depAddressDisplay') ? $('depAddressDisplay').textContent : '';
      navigator.clipboard.writeText(val);
      notify(language === 'fa' ? 'آدرس کیف‌پول کپی شد!' : 'Wallet address copied!');
    });
  }

  if ($('btnVerifyTx')) $('btnVerifyTx').addEventListener('click', verifyTransaction);
  if ($('btnSendTgReceipt')) $('btnSendTgReceipt').addEventListener('click', sendReceiptTelegram);

  if ($('btnExtendSub')) {
    $('btnExtendSub').addEventListener('click', () => {
      saveSubscription(1, 'EXTEND', currentNet);
      notify(language === 'fa' ? 'اشتراک ۱ ماه دیگر تمدید شد!' : 'Subscription extended for 1 month!');
    });
  }

  if ($('btnResetSub')) {
    $('btnResetSub').addEventListener('click', () => {
      localStorage.removeItem('mrsignalll_sub');
      updateSubscriptionUI();
      notify(language === 'fa' ? 'اشتراک بازنشانی شد.' : 'Subscription reset.');
    });
  }

  // Pro Tools Accordion (100% Free for all users)
  if ($('togglePremiumTools')) {
    $('togglePremiumTools').addEventListener('click', () => {
      const box = $('premiumContentBox');
      const arrow = $('proToolsArrow');
      if (box) {
        box.hidden = !box.hidden;
        if (arrow) arrow.textContent = box.hidden ? '▾' : '▴';
      }
    });
  }

  if ($('btnExportPine')) $('btnExportPine').addEventListener('click', exportPineScript);
  if ($('btnExportJournal')) $('btnExportJournal').addEventListener('click', exportTradeJournal);

  // Initial Sync
  initTheme();
  if (typeof renderCoinChips === 'function') renderCoinChips('BTC');
  if (typeof updateMarketStripTickers === 'function') {
    updateMarketStripTickers();
    setInterval(updateMarketStripTickers, 30000);
  }
  updatePaymentDetails();
  updateSubscriptionUI();
  if (typeof initAuth === 'function') initAuth();

  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('langDropdownWrap');
    const menu = document.getElementById('langDropdownMenu');
    if (menu && wrap && !wrap.contains(e.target)) {
      menu.classList.remove('show');
    }
  });

  let savedLang;
  try { savedLang = localStorage.getItem('mrsignalll-language'); } catch (e) {}
  setLanguage(savedLang || 'en');
});
