/**
 * MRSIGNALLL Market Data, Multi-Exchange Live Price Fetcher & Custom Coins Manager
 */

const samplePrices = {
  BTC: 76300,
  ETH: 2420,
  SOL: 98.5,
  BNB: 580,
  XRP: 0.58,
  DOGE: 0.12,
  SUI: 0.72,
  ADA: 0.35,
  '1000PEPE': 0.0034
};

const DEFAULT_COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'SUI', 'ADA', '1000PEPE'];

let quoteState = { kind: 'example' };
let quoteController = null;
let quoteGeneration = 0;
let lastKnownPrice = null;

function getCustomCoins() {
  try {
    const raw = localStorage.getItem('mrsignalll_custom_coins');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCustomCoins(list) {
  try {
    localStorage.setItem('mrsignalll_custom_coins', JSON.stringify(list));
  } catch (e) {}
}

function getAllCoins() {
  const custom = getCustomCoins();
  const set = new Set([...DEFAULT_COINS, ...custom]);
  return Array.from(set);
}

function renderCoinChips(activeSymbol) {
  const container = document.getElementById('coins');
  if (!container) return;
  const current = (activeSymbol || coin()).trim().toUpperCase().replace(/USDT$/, '');
  const all = getAllCoins();
  const customList = getCustomCoins();

  let html = all.map(sym => {
    const isCustom = customList.includes(sym);
    const isActive = sym === current;
    if (isCustom) {
      return `<button type="button" class="custom-coin" data-coin="${sym}" aria-pressed="${isActive}" onclick="setCoin('${sym}')">
        <span>${sym}</span>
        <span class="remove-coin-btn" onclick="event.stopPropagation(); removeCustomCoin('${sym}')" title="حذف">×</span>
      </button>`;
    }
    return `<button type="button" data-coin="${sym}" aria-pressed="${isActive}" onclick="setCoin('${sym}')">${sym}</button>`;
  }).join('');

  html += `
    <button type="button" class="btn-add-coin" onclick="openAddCoinModal()" title="افزودن ارز جدید">
      <span>+</span>
      <span data-fa="ارز جدید" data-en="Add Coin">${(typeof language !== 'undefined' && language === 'fa') ? 'ارز جدید' : 'Add Coin'}</span>
    </button>
  `;

  container.innerHTML = html;
}

function openAddCoinModal() {
  const modal = document.getElementById('addCoinModal');
  if (modal) {
    modal.style.display = 'flex';
    const input = document.getElementById('newCoinInput');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 100);
    }
  }
}

function closeAddCoinModal() {
  const modal = document.getElementById('addCoinModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function submitAddCoin() {
  const input = document.getElementById('newCoinInput');
  const symbol = input ? input.value.trim().toUpperCase().replace(/USDT$/, '') : '';
  if (!symbol) return;
  await addCustomCoin(symbol);
}

async function quickAddCoin(symbol) {
  await addCustomCoin(symbol);
}

async function addCustomCoin(symbol) {
  if (!symbol) return;
  const sym = symbol.trim().toUpperCase().replace(/USDT$/, '');
  if (!validCoin(sym)) {
    if (typeof notify === 'function') {
      notify(typeof language !== 'undefined' && language === 'fa' ? 'نماد نامعتبر است (مثال: TON, AVAX)' : 'Invalid coin symbol');
    }
    return;
  }

  const custom = getCustomCoins();
  if (!custom.includes(sym) && !DEFAULT_COINS.includes(sym)) {
    custom.push(sym);
    saveCustomCoins(custom);
  }

  closeAddCoinModal();
  setCoin(sym, false);
  renderCoinChips(sym);
  await fetchPrice(sym);
}

function removeCustomCoin(symbol) {
  let custom = getCustomCoins().filter(c => c !== symbol);
  saveCustomCoins(custom);
  if (coin() === symbol) {
    setCoin('BTC', false);
  } else {
    renderCoinChips();
  }
  if (typeof notify === 'function') {
    notify(typeof language !== 'undefined' && language === 'fa' ? `ارز ${symbol} حذف شد` : `Coin ${symbol} removed`);
  }
}

function coin() {
  const input = document.getElementById('symbol');
  return input ? input.value.trim().toUpperCase().replace(/USDT$/, '') : 'BTC';
}

function validCoin(value) {
  return /^[A-Z0-9]{2,20}$/.test(value);
}

function priceValue(n) {
  return Number(n.toPrecision(12)).toString();
}

function cancelQuote() {
  quoteGeneration++;
  if (quoteController) quoteController.abort();
  quoteController = null;
  const btn = document.getElementById('fetchPrice');
  if (btn) btn.disabled = false;
}

function manualEntry() {
  cancelQuote();
  quoteState = { kind: 'manual' };
  renderQuote();
}

function renderQuote() {
  const statusEl = document.getElementById('quoteStatus');
  if (!statusEl) return;
  let value = text(quoteState.kind);
  if (quoteState.kind === 'fetched') {
    value += new Date(quoteState.time).toLocaleString(typeof language !== 'undefined' && language === 'fa' ? 'fa-IR' : 'en-GB') +
      ' · ' + quoteState.symbol + ' · ' + fmt(quoteState.price, 8) + ' USDT';
  }
  statusEl.textContent = value;
}

/**
 * Fetch live price from multi-exchange proxy (Zero CORS, Zero Geo-block)
 */
async function fetchPrice(targetSymbol) {
  const symbol = (targetSymbol || coin()).trim().toUpperCase().replace(/USDT$/, '');
  if (!validCoin(symbol)) {
    calculate();
    const symEl = document.getElementById('symbol');
    if (symEl) symEl.focus();
    return;
  }

  cancelQuote();
  const generation = quoteGeneration;
  const controller = new AbortController();
  quoteController = controller;

  const btn = document.getElementById('fetchPrice');
  if (btn) btn.disabled = true;
  quoteState = { kind: 'loading' };
  renderQuote();

  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    let price = null;
    let source = '';

    // 1. Try our backend proxy (Localhost:8000 / zero CORS / multi-exchange)
    try {
      const resp = await fetch('/api/market/price?symbol=' + encodeURIComponent(symbol), {
        signal: controller.signal,
        cache: 'no-store'
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && Number.isFinite(data.price) && data.price > 0) {
          price = data.price;
          source = data.source || 'Live';
        }
      }
    } catch (e) {
      // Fallback below
    }

    // 2. Direct Binance Futures API fallback (for non-blocked environments)
    if (!price) {
      try {
        const resp2 = await fetch(
          'https://fapi.binance.com/fapi/v2/ticker/price?symbol=' + encodeURIComponent(symbol + 'USDT'),
          { signal: controller.signal, cache: 'no-store', credentials: 'omit' }
        );
        if (resp2.ok) {
          const data2 = await resp2.json();
          const p = Number(data2.price);
          if (Number.isFinite(p) && p > 0) {
            price = p;
            source = 'Binance';
          }
        }
      } catch (e) {}
    }

    if (!price) {
      throw new Error('Price unavailable');
    }

    if (generation !== quoteGeneration) return;

    // Auto-add to custom coins if not present
    const all = getAllCoins();
    if (!all.includes(symbol)) {
      const custom = getCustomCoins();
      custom.push(symbol);
      saveCustomCoins(custom);
    }
    renderCoinChips(symbol);

    const entryInput = document.getElementById('entry');
    if (entryInput) {
      entryInput.value = priceValue(price);

      // Green/Red flash animation on tick update
      entryInput.classList.remove('price-flash-up', 'price-flash-down');
      void entryInput.offsetWidth;
      if (lastKnownPrice !== null && price < lastKnownPrice) {
        entryInput.classList.add('price-flash-down');
      } else {
        entryInput.classList.add('price-flash-up');
      }
      lastKnownPrice = price;

      samplePrices[symbol] = price;

      // Update stop and target according to current direction
      const dir = typeof direction !== 'undefined' ? direction : 1;
      const stopInput = document.getElementById('stop');
      const targetInput = document.getElementById('target');
      if (stopInput) stopInput.value = priceValue(price * (1 - dir * 0.02));
      if (targetInput) targetInput.value = priceValue(price * (1 + dir * 0.06));
    }

    quoteState = { kind: 'fetched', time: Date.now(), symbol: symbol + 'USDT', price };
    calculate();

    if (typeof notify === 'function') {
      notify(
        typeof language !== 'undefined' && language === 'fa'
          ? `قیمت زنده ${symbol} دریافت شد: ${fmt(price, price >= 1 ? 4 : 8)} USDT (${source})`
          : `Live ${symbol} price updated: ${fmt(price, price >= 1 ? 4 : 8)} USDT (${source})`
      );
    }
  } catch (error) {
    if (generation === quoteGeneration) quoteState = { kind: 'failed' };
  } finally {
    clearTimeout(timer);
    if (generation === quoteGeneration) {
      quoteController = null;
      if (btn) btn.disabled = false;
      renderQuote();
    }
  }
}

/**
 * Live Market Ticker Strip Real-Time Sync
 */
async function updateMarketStripTickers() {
  const tickerItems = document.querySelectorAll('.market-strip .ticker-item');
  if (!tickerItems || tickerItems.length === 0) return;

  for (const item of tickerItems) {
    const symEl = item.querySelector('.ticker-symbol');
    const priceEl = item.querySelector('.ticker-price');
    if (!symEl || !priceEl) continue;

    const sym = symEl.textContent.replace('/USDT', '').trim();
    try {
      const resp = await fetch('/api/market/price?symbol=' + encodeURIComponent(sym), { cache: 'no-store' });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.price) {
          priceEl.textContent = (typeof fmt === 'function') ? fmt(data.price, data.price >= 1 ? 2 : 4) : data.price;
          samplePrices[sym] = data.price;
        }
      }
    } catch (e) {}
  }
}

// Export functions to window
window.renderCoinChips = renderCoinChips;
window.openAddCoinModal = openAddCoinModal;
window.closeAddCoinModal = closeAddCoinModal;
window.submitAddCoin = submitAddCoin;
window.quickAddCoin = quickAddCoin;
window.removeCustomCoin = removeCustomCoin;
window.fetchPrice = fetchPrice;
window.updateMarketStripTickers = updateMarketStripTickers;