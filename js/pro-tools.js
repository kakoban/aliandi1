/**
 * MRSIGNALLL Pro Tools: Multi-TP Ladder, Pine Script & Trade Journal Exporters
 */

function updateMultiTP(forceRecalculate = false) {
  const tp1El = document.getElementById('tp1Input');
  const tp2El = document.getElementById('tp2Input');
  const tp3El = document.getElementById('tp3Input');
  const p1El = document.getElementById('tp1Profit');
  const p2El = document.getElementById('tp2Profit');
  const p3El = document.getElementById('tp3Profit');

  if (!tp1El || !tp2El || !tp3El) return;

  if (!lastResult) {
    if (p1El) p1El.textContent = '— (50%)';
    if (p2El) p2El.textContent = '— (30%)';
    if (p3El) p3El.textContent = '— (20%)';
    return;
  }

  const e = number('entry');
  const s = number('stop');
  const t = number('target');
  if (!Number.isFinite(e) || e <= 0) return;

  const q = lastResult.q;
  if (!Number.isFinite(q) || q <= 0) return;

  let currentTp1 = number('tp1Input');
  let currentTp2 = number('tp2Input');
  let currentTp3 = number('tp3Input');

  // Check if existing input is on the wrong side of entry or belongs to a different coin scale (>150% away)
  const isInvalidLevel = val => {
    if (!Number.isFinite(val) || val <= 0) return true;
    if (direction === 1 && val <= e) return true;
    if (direction === -1 && val >= e) return true;
    const distRatio = Math.abs(val - e) / e;
    if (distRatio > 1.5) return true;
    return false;
  };

  const shouldResetLadder = forceRecalculate ||
    !tp1El.value ||
    !tp2El.value ||
    !tp3El.value ||
    isInvalidLevel(currentTp1) ||
    isInvalidLevel(currentTp2) ||
    isInvalidLevel(currentTp3);

  if (shouldResetLadder) {
    const slDist = (Number.isFinite(s) && s > 0 && Math.abs(e - s) > 0) ? Math.abs(e - s) : (e * 0.02);
    const hasValidTarget = Number.isFinite(t) && t > 0 && (direction === 1 ? t > e : t < e);

    if (hasValidTarget) {
      const totalDist = Math.abs(t - e);
      currentTp1 = e + direction * (totalDist * 0.35);
      currentTp2 = e + direction * (totalDist * 0.70);
      currentTp3 = t;
    } else {
      currentTp1 = e + direction * (slDist * 1.5);
      currentTp2 = e + direction * (slDist * 2.5);
      currentTp3 = e + direction * (slDist * 4.0);
    }

    tp1El.value = priceValue(currentTp1);
    tp2El.value = priceValue(currentTp2);
    tp3El.value = priceValue(currentTp3);
  }

  // Calculate net profit for each TP level
  const feeRate = ((lastResult.inputs && lastResult.inputs.fee) || 0.05) / 100.0;
  const calcProfit = (tpVal, share) => {
    if (!Number.isFinite(tpVal) || tpVal <= 0) return null;
    const isProfitableSide = direction === 1 ? tpVal > e : tpVal < e;
    if (!isProfitableSide) return null;
    const shareQty = q * share;
    const gross = shareQty * direction * (tpVal - e);
    const exitFee = shareQty * tpVal * feeRate;
    const entryFee = shareQty * e * feeRate;
    const net = gross - (exitFee + entryFee);
    return net;
  };

  const p1 = calcProfit(number('tp1Input'), 0.50);
  const p2 = calcProfit(number('tp2Input'), 0.30);
  const p3 = calcProfit(number('tp3Input'), 0.20);

  const renderProfitText = (el, val, shareText) => {
    if (!el) return;
    if (val === null || !Number.isFinite(val)) {
      el.textContent = `— (${shareText})`;
      el.style.color = 'var(--text-tertiary)';
    } else if (val >= 0) {
      el.textContent = `+${fmt(val)} USDT (${shareText})`;
      el.style.color = 'var(--success)';
    } else {
      el.textContent = `-${fmt(Math.abs(val))} USDT (${shareText})`;
      el.style.color = 'var(--danger)';
    }
  };

  renderProfitText(p1El, p1, '50%');
  renderProfitText(p2El, p2, '30%');
  renderProfitText(p3El, p3, '20%');
}

/**
 * Generate TradingView Pine Script Indicator Code
 */
async function exportPineScript() {
  if (!lastResult) {
    notify(language === 'fa' ? 'ابتدا مقادیر معامله را محاسبه کنید.' : 'Calculate trade values first.');
    return;
  }
  const r = lastResult;
  const v = r.inputs;

  let pineCode = '';
  try {
    const res = await fetch('/Position_Size_Calculator.pine?v=' + Date.now());
    if (res.ok) {
      let src = await res.text();
      // Parameterize with current trade values
      src = src.replace(/input\.float\(1000\.0,\s*"Equity"/, `input.float(${v.balance}, "Equity"`);
      src = src.replace(/input\.float\(1\.0,\s*"Risk %"/, `input.float(${v.risk}, "Risk %"`);
      src = src.replace(/input\.float\(10\.0,\s*"Max Capital Alloc %"/, `input.float(${v.marginPct}, "Max Capital Alloc %"`);
      src = src.replace(/input\.string\("Long",\s*"Direction"/, `input.string("${direction === 1 ? 'Long' : 'Short'}", "Direction"`);
      src = src.replace(/input\.string\("Market \(Floating\)",\s*"Entry"/, `input.string("Manual Price", "Entry"`);
      src = src.replace(/input\.price\(0\.0,\s*"Manual Entry"/, `input.price(${v.entry}, "Manual Entry"`);
      src = src.replace(/input\.string\("Entry %",\s*"SL Mode"/, `input.string("Manual Price", "SL Mode"`);
      src = src.replace(/input\.price\(0\.0,\s*"SL Price"/, `input.price(${v.stop}, "SL Price"`);
      src = src.replace(/input\.string\("Net R:R",\s*"TP Mode"/, `input.string("Manual Price", "TP Mode"`);
      src = src.replace(/input\.price\(0\.0,\s*"TP Price"/, `input.price(${v.target || v.entry}, "TP Price"`);
      src = src.replace(/input\.float\(0\.05,\s*"Entry Fee %"/, `input.float(${v.fee}, "Entry Fee %"`);
      src = src.replace(/input\.float\(0\.05,\s*"Exit Fee %"/, `input.float(${v.fee}, "Exit Fee %"`);
      src = src.replace(/input\.float\(0\.5,\s*"MMR %"/, `input.float(${v.mmr}, "MMR %"`);
      src = src.replace(/input\.float\(25\.0,\s*"Liq Buffer %"/, `input.float(${v.buffer}, "Liq Buffer %"`);
      src = src.replace(/input\.int\(125,\s*"Max Lev"/, `input.int(${v.maxLev}, "Max Lev"`);
      pineCode = src;
    }
  } catch (e) {}

  if (!pineCode) {
    pineCode = `//@version=6
// AntiGravity Risk Pro v2 | MRSIGNALLL Futures Sizing
// Symbol: ${r.coin}USDT | Direction: ${direction === 1 ? 'Long' : 'Short'}
indicator("MRSIGNALLL - ${r.coin} Trade Setup", overlay=true)

entryPrice  = input.price(${v.entry}, "Entry Price")
stopPrice   = input.price(${v.stop}, "Stop Loss")
targetPrice = input.price(${v.target || v.entry}, "Take Profit")
breakEven   = input.price(${r.breakEven ? Number(r.breakEven.toFixed(4)) : v.entry}, "Break-Even Price")
liqPrice    = input.price(${r.liq ? Number(r.liq.toFixed(4)) : 0}, "Est. Liquidation")
direction   = input.string("${direction === 1 ? 'Long' : 'Short'}", "Position Type")
posQty      = input.float(${Number(r.q.toFixed(6))}, "Position Size (${r.coin})")
leverage    = input.int(${r.lev || 1}, "Leverage")

plot(entryPrice, "Entry Level", color=#F0B90B, linewidth=2, style=plot.style_line)
plot(stopPrice, "Stop Loss", color=#F6465D, linewidth=2, style=plot.style_line)
plot(targetPrice, "Take Profit", color=#0ECB81, linewidth=2, style=plot.style_line)
plot(breakEven, "Break-Even", color=#56B4E9, linewidth=1, style=plot.style_circles)
`;
  }

  try {
    if (!navigator.clipboard) throw new Error('No clipboard API');
    navigator.clipboard.writeText(pineCode).then(() => {
      notify(language === 'fa' ? 'کد کامل اندیکاتور TradingView v6 در کلیپ‌بورد کپی شد!' : 'Full TradingView v6 Pine Script copied to clipboard!');
    }).catch(() => {
      fallbackCopy(pineCode);
    });
  } catch(e) {
    fallbackCopy(pineCode);
  }

  function fallbackCopy(text) {
    let area = document.getElementById('manualCopy');
    if (!area) {
      area = document.createElement('textarea');
      area.id = 'manualCopy';
      area.style.cssText = 'width:100%;height:160px;margin-top:12px;font:12px/1.8 monospace;direction:ltr;background:#121519;color:#F0B90B;border:1px solid #F0B90B;padding:8px;border-radius:6px;';
      const container = document.getElementById('premiumContentBox');
      if (container) container.appendChild(area);
    }
    area.value = text;
    area.focus();
    area.select();
    notify(language === 'fa' ? 'کد Pine Script در کادر زیر آماده شد.' : 'Pine Script code generated below.');
  }
}

/**
 * Export Trade Setup to JSON Journal
 */
function exportTradeJournal() {
  if (!lastResult) {
    notify(language === 'fa' ? 'ابتدا مقادیر معامله را محاسبه کنید.' : 'Calculate trade values first.');
    return;
  }
  const r = lastResult;
  const v = r.inputs;
  const journalItem = {
    exchange: "Binance USDT-M Futures",
    date: new Date().toISOString(),
    symbol: `${r.coin}USDT`,
    direction: direction === 1 ? 'LONG' : 'SHORT',
    entry: v.entry,
    stopLoss: v.stop,
    target: v.target,
    quantity: r.q,
    notional: r.notional,
    leverage: r.lev,
    initialMargin: r.margin,
    riskCash: r.riskCash,
    estimatedLoss: r.stopLoss,
    estimatedProfit: r.profit,
    rrRatio: r.rr
  };

  const blob = new Blob([JSON.stringify(journalItem, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `MRSIGNALLL_${r.coin}_${Date.now()}.json`;
  a.click();
  notify(language === 'fa' ? 'فایل ژورنال معامله دانلود شد.' : 'Trade Journal file downloaded.');
}
