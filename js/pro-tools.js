/**
 * MRSIGNALLL Pro Tools: Multi-TP Ladder, Pine Script & Trade Journal Exporters
 */

function updateMultiTP() {
  if (!lastResult) return;
  const e = number('entry');
  const t = number('target');
  if (!e || e <= 0) return;

  const tp1 = number('tp1Input') || (direction === 1 ? e * 1.02 : e * 0.98);
  const tp2 = number('tp2Input') || (direction === 1 ? e * 1.04 : e * 0.96);
  const tp3 = number('tp3Input') || (t && t > 0 ? t : (direction === 1 ? e * 1.06 : e * 0.94));

  const tp1El = document.getElementById('tp1Input');
  const tp2El = document.getElementById('tp2Input');
  const tp3El = document.getElementById('tp3Input');

  if (tp1El && !tp1El.value) tp1El.value = priceValue(tp1);
  if (tp2El && !tp2El.value) tp2El.value = priceValue(tp2);
  if (tp3El && !tp3El.value) tp3El.value = priceValue(tp3);

  const q = lastResult.q;
  const p1 = (q * 0.5) * direction * (tp1 - e);
  const p2 = (q * 0.3) * direction * (tp2 - e);
  const p3 = (q * 0.2) * direction * (tp3 - e);

  const p1El = document.getElementById('tp1Profit');
  const p2El = document.getElementById('tp2Profit');
  const p3El = document.getElementById('tp3Profit');

  if (p1El) p1El.textContent = `+${fmt(p1)} USDT (50%)`;
  if (p2El) p2El.textContent = `+${fmt(p2)} USDT (30%)`;
  if (p3El) p3El.textContent = `+${fmt(p3)} USDT (20%)`;
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
