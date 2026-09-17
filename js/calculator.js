/**
 * MRSIGNALLL Position & Risk Calculator Core Engine
 * Directly derived and calibrated against AntiGravity Risk Pro v2 (mrsignallpsizing.pine)
 * Pure, institutional mathematical model for linear USDT futures & isolated margin.
 */

const CalcDefaults = {
  balance: 1000,
  risk: 1,
  entry: 65000,
  stop: 63700,
  target: 68900,
  marginPct: 10,
  fee: 0.05,
  maxLev: 20,
  mmr: 0.5,
  buffer: 25
};

/**
 * 1. Loss Unit Helper (f_loss_unit)
 * Loss per base unit including maker/taker fees and funding erosion
 */
function f_loss_unit(e, s, side, feeIn, feeOut, fund = 0.0) {
  return side * (e - s) + e * feeIn + s * feeOut + e * fund;
}

/**
 * 2. Profit Unit Helper (f_profit_unit)
 * Net profit per base unit after maker/taker fees and funding erosion
 */
function f_profit_unit(e, t, side, feeIn, feeOut, fund = 0.0) {
  return side * (t - e) - e * feeIn - t * feeOut - e * fund;
}

/**
 * 3. Target Fill Price by Net R:R (f_target_fill)
 * Solves for target fill price given desired R:R (or Break-Even when rr = 0)
 */
function f_target_fill(e, lossUnit, side, feeIn, feeOut, fund = 0.0, rr = 0.0) {
  return (rr * lossUnit + e * (side + feeIn + fund)) / (side - feeOut);
}

/**
 * 4. Isolated Margin Liquidation Price Model (f_liquidation)
 * Equity model: M = E/L - E*(feeIn + fund), maintenance = P*(MMR + feeOut)
 * Exact model from AntiGravity v2 Pine Script
 */
function f_liquidation(e, lev, side, effectiveMaintenance, erosion) {
  if (!lev || lev <= 0) return null;
  const num = e * (1.0 - side / lev + side * erosion);
  const den = 1.0 - side * effectiveMaintenance;
  if (den === 0) return null;
  return Math.max(0.0, num / den);
}

/**
 * 5. Leverage Cap from Liquidation Buffer (f_leverage_cap)
 * Ensures liquidation distance is strictly beyond the stop buffer
 */
function f_leverage_cap(e, s, side, effectiveMaintenance, erosion, buffer, tickSize = 0.01, venueCap = 125) {
  const requiredDistance = side * (e - s) * (1.0 + buffer) + tickSize;
  const boundary = e - side * requiredDistance;
  if (boundary <= 0) return 0;
  const inverseLev = (requiredDistance / e) + (boundary / e) * effectiveMaintenance + erosion;
  if (inverseLev <= 0) return 0;
  const cap = Math.floor(1.0 / inverseLev);
  return Math.max(0, Math.min(venueCap, cap));
}

/**
 * Core Position Sizing & Liquidation Engine (AG Risk Pro v2)
 * @param {Object} v - Inputs
 * @returns {Object} Calculated metrics
 */
function getModel(v) {
  const side = v.direction === 1 ? 1.0 : -1.0;
  const feeIn = v.fee / 100.0;
  const feeOut = v.fee / 100.0;
  const fund = 0.0; // Funding reserve
  const mmr = v.mmr / 100.0;
  const buffer = v.buffer / 100.0;
  const effectiveMaintenance = mmr + feeOut;
  const erosion = feeIn + fund;

  const distance = Math.abs(v.entry - v.stop);
  const riskCash = (v.balance * v.risk) / 100.0;
  const marginBudget = (v.balance * v.marginPct) / 100.0;

  // 1. Loss unit per contract (with or without fee deduction from risk budget)
  const stopFeesUnit = (v.entry * feeIn + v.stop * feeOut);
  const lossUnit = distance + (v.feesInRisk ? stopFeesUnit : 0.0);

  // 2. Position Quantity (q)
  const q = lossUnit > 0 ? riskCash / lossUnit : 0;
  const notional = q * v.entry;
  const stopFees = q * stopFeesUnit;
  const stopLoss = q * distance + stopFees;

  // 3. Leverage Cap from Liquidation Safety Buffer Model (AntiGravity v2)
  const modelCap = f_leverage_cap(v.entry, v.stop, side, effectiveMaintenance, erosion, buffer, 0.01, v.maxLev);

  // 4. Desired leverage to fit capital / margin budget
  const desiredLev = Math.max(1, Math.ceil(notional / marginBudget - 1e-12));

  // 5. Chosen Leverage (Capped by model liquidation safety and maxLev)
  let lev = modelCap < 1 ? null : Math.min(desiredLev, v.maxLev, modelCap);

  // Stepdown optimization from Pine script: if lev - 1 fits within margin budget, step down
  if (lev && lev > 1) {
    if (notional / (lev - 1) <= marginBudget) {
      lev = lev - 1;
    }
  }

  const margin = (lev && lev > 0) ? notional / lev : null;

  // 6. Liquidation Price (Exact Pine v2 formula)
  const liq = (lev && lev > 0)
    ? f_liquidation(v.entry, lev, side, effectiveMaintenance, erosion)
    : null;

  // 7. Break-Even Price (Exact Pine v2 f_target_fill with rr = 0)
  const breakEven = f_target_fill(v.entry, lossUnit, side, feeIn, feeOut, fund, 0.0);

  // 8. Net Profit, Gross R:R and Net R:R
  let profit = null;
  let rr = null;
  let grossR = null;

  if (v.target !== null && v.target > 0) {
    const profitUnit = f_profit_unit(v.entry, v.target, side, feeIn, feeOut, fund);
    profit = q * profitUnit;
    rr = lossUnit > 0 ? profitUnit / lossUnit : null;
    grossR = distance > 0 ? Math.abs(v.target - v.entry) / distance : null;
  }

  return {
    q,
    notional,
    riskCash,
    stopFees,
    stopLoss,
    marginBudget,
    desiredLev,
    modelCap,
    lev,
    margin,
    liq,
    breakEven,
    profit,
    rr,
    grossR,
    lossUnit,
    entryFee: q * v.entry * feeIn
  };
}
