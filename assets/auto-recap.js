/* ==================================================================
   盘后自动复盘 + 次日盘前研判自动生成
   触发条件：交易日 15:00 后打开页面或切到复盘/盘前页签
   数据来源：Watchlist 缓存（腾讯接口 OHLC）
   生成内容：
   - 今日指数 K 线结构分析（开高低收、路径、收盘位置、振幅）
   - 持仓当日盈亏复盘
   - 自选股市场广度（涨跌家数、涨停数）
   - 次日倾向预判（规则打分）
   - 次日盘前支撑/压力位重算（基于今日 OHLC）
   ================================================================== */
(function() {
  'use strict';

  var IDX_LIST = [
    { tc: 'sh000001', name: '上证指数', snap: 3827.40, snapPct: -1.34 },
    { tc: 'sz399001', name: '深证成指', snap: 13680.13, snapPct: -2.12 },
    { tc: 'sz399006', name: '创业板指', snap: 3400.78, snapPct: -2.30 }
  ];

  var HOLDINGS = [
    { tc: 'sh600498', name: '烽火通信', shares: 200, cost: 40.025, snap: 40.240, snapPct: +0.54 },
    { tc: 'sh600353', name: '旭光电子', shares: 200, cost: 32.385, snap: 31.730, snapPct: -2.02 },
    { tc: 'sh512760', name: '芯片ETF', shares: 400, cost: 1.323, snap: 1.106, snapPct: -2.53 },
    { tc: 'sh515050', name: '5GETF', shares: 300, cost: 1.241, snap: 1.042, snapPct: -2.91 }
  ];

  var INIT_CAPITAL = 23555.17;
  var CASH = 8171.33;

  function el(id) { return document.getElementById(id); }
  function fmtPct(n) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
  function fmtPrice(p) { return p >= 10 ? p.toFixed(2) : p.toFixed(3); }
  function upColor(n) { return n > 0 ? 'var(--up)' : (n < 0 ? 'var(--down)' : 'var(--muted)'); }
  function fmtMoney(n) { return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtSigned(n) { return (n >= 0 ? '+' : '-') + fmtMoney(Math.abs(n)); }

  var WD = ['日','一','二','三','四','五','六'];
  var WM = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  function todayStr() {
    var d = new Date();
    return WM[d.getMonth()] + d.getDate() + '日（周' + WD[d.getDay()] + '）';
  }

  function todayShort() {
    var d = new Date();
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function nextTradeDay() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return WM[d.getMonth()] + d.getDate() + '日（周' + WD[d.getDay()] + '）';
  }

  function isPostMarket() {
    var now = new Date();
    var day = now.getDay();
    if (day === 0 || day === 6) return false;
    var m = now.getHours() * 60 + now.getMinutes();
    if (m >= 960) return true;
    return false;
  }

  function isWeekdayPreMarket() {
    var now = new Date();
    var day = now.getDay();
    if (day === 0 || day === 6) return false;
    var m = now.getHours() * 60 + now.getMinutes();
    return m < 555;
  }

  function clearStaleRecap() {
    if (!isWeekdayPreMarket()) return;
    var headline = el('recap-headline');
    var desc = el('recap-desc');
    var statsEl = el('recap-stats');
    var reviewCard = el('auto-recap-review');

    if (headline) headline.textContent = '今日复盘将于16:00后生成';
    if (desc) desc.textContent = '当前为盘前时段，盘后自动复盘尚未触发。请在今日收盘后16:00查看。';
    if (statsEl) statsEl.innerHTML = '';
    if (reviewCard) reviewCard.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);font-size:14px;">今日盘后复盘将于16:00后自动生成，请稍候。</div>';
  }

  function getQuote(tc) {
    if (window.Watchlist && window.Watchlist.getQuote) {
      var q = window.Watchlist.getQuote(tc);
      if (q && q.price > 0 && q.prev > 0) return q;
    }
    return null;
  }

  function pctOf(price, prev) { return (price - prev) / prev * 100; }

  function analyzeBar(q) {
    if (!q) return null;
    var gap = (q.open - q.prev) / q.prev * 100;
    var amp = (q.high > 0 && q.low > 0) ? (q.high - q.low) / q.prev * 100 : 0;
    var range = (q.high > 0 && q.low > 0) ? (q.high - q.low) : 0;
    var clv = range > 0 ? (q.price - q.low) / range : 0.5;
    var body = q.price - q.open;
    var bodyAbs = Math.abs(body);
    var upper = q.high > 0 ? (q.high - Math.max(q.price, q.open)) : 0;
    var lower = q.low > 0 ? (Math.min(q.price, q.open) - q.low) : 0;
    return { gap: gap, amp: amp, clv: clv, body: body, bodyAbs: bodyAbs, upper: upper, lower: lower };
  }

  function pathDesc(q) {
    var a = analyzeBar(q);
    if (!a) return '数据不足';
    var parts = [];
    if (a.gap > 0.3) parts.push('高开' + a.gap.toFixed(2) + '%');
    else if (a.gap < -0.3) parts.push('低开' + Math.abs(a.gap).toFixed(2) + '%');
    else parts.push('平开');

    if (a.body > 0) {
      if (a.clv > 0.7) parts.push('震荡走高，收于日内高位');
      else if (a.clv < 0.3) parts.push('冲高回落，收于日内低位');
      else parts.push('震荡上行');
    } else {
      if (a.clv > 0.7) parts.push('探底回升，收于日内高位');
      else if (a.clv < 0.3) parts.push('低开低走，收于日内低位');
      else parts.push('震荡走低');
    }
    return parts.join('，');
  }

  function closeLabel(clv) {
    if (clv > 0.7) return { txt: '高位', color: 'var(--up)' };
    if (clv > 0.4) return { txt: '中高位', color: 'var(--up)' };
    if (clv > 0.3) return { txt: '中低位', color: 'var(--down)' };
    return { txt: '低位', color: 'var(--down)' };
  }

  function predictBias(q) {
    var a = analyzeBar(q);
    if (!a) return { score: 0, label: '中性', desc: '数据不足，无法判断', color: 'var(--muted)' };
    var s = 0;
    if (a.clv > 0.7) s += 1;
    else if (a.clv < 0.3) s -= 1;
    var pct = pctOf(q.price, q.prev);
    if (pct > 1) s += 0.5;
    else if (pct < -1) s -= 0.5;
    if (a.gap > 0.3 && pct < a.gap - 0.5) s -= 0.5;
    if (a.gap < -0.3 && pct > a.gap + 0.5) s += 0.5;
    if (a.bodyAbs > 0.0001) {
      if (a.upper > a.bodyAbs * 1.5) s -= 0.25;
      if (a.lower > a.bodyAbs * 1.5) s += 0.25;
    }
    if (s >= 1.5) return { score: s, label: '偏多', desc: '收盘强势，次日大概率高开或冲高', color: 'var(--up)' };
    if (s >= 0.5) return { score: s, label: '略偏多', desc: '收盘偏强，次日有望试探上方压力', color: 'var(--up)' };
    if (s > -0.5) return { score: s, label: '中性', desc: '多空均衡，次日大概率震荡', color: 'var(--muted)' };
    if (s > -1.5) return { score: s, label: '略偏空', desc: '收盘偏弱，次日承压概率较大', color: 'var(--down)' };
    return { score: s, label: '偏空', desc: '收盘弱势，次日大概率低开或下探', color: 'var(--down)' };
  }

  function calcLevels(close, high, low, prev) {
    var resist = [], support = [];
    if (high > close && high > 0) {
      resist.push({ p: high, tag: 'R1 · 今日高点', txt: high.toFixed(close > 100 ? '0' : '2'), basis: '今日盘中高点 ' + high.toFixed(2), meaning: '突破则短线转强' });
    }
    var step = close > 1000 ? 10 : (close > 100 ? 5 : 1);
    var r1 = Math.ceil(close / step) * step;
    if (r1 <= close) r1 += step;
    if (resist.length === 0 || Math.abs(r1 - high) > step * 0.3) {
      resist.push({ p: r1, tag: 'R2 · 整数关口', txt: r1.toString(), basis: r1 + ' 整数心理位', meaning: '短期阻力' });
    }
    var r2 = r1 + step;
    if (resist.length < 3) {
      resist.push({ p: r2, tag: 'R3 · 次级压力', txt: r2.toString(), basis: r2 + ' 上方压力位', meaning: '放量突破打开空间' });
    }

    if (low < close && low > 0) {
      support.push({ p: low, tag: 'S1 · 今日低点', txt: low.toFixed(close > 100 ? '0' : '2'), basis: '今日盘中低点 ' + low.toFixed(2), meaning: '回踩不破可低吸' });
    }
    var s1 = Math.floor(close / step) * step;
    if (s1 >= close) s1 -= step;
    if (s1 > 0 && (support.length === 0 || Math.abs(s1 - low) > step * 0.3)) {
      support.push({ p: s1, tag: 'S2 · 整数关口', txt: s1.toString(), basis: s1 + ' 整数心理位', meaning: '短期支撑' });
    }
    if (prev > 0 && prev < close && prev !== s1) {
      support.push({ p: prev, tag: 'S3 · 昨收', txt: prev.toFixed(close > 100 ? '0' : '2'), basis: '昨日收盘 ' + prev.toFixed(2), meaning: '跌破转弱' });
    }
    var s2 = s1 - step;
    if (s2 > 0 && support.length < 3) {
      support.push({ p: s2, tag: 'S4 · 强支撑', txt: s2.toString(), basis: s2 + ' 下方支撑', meaning: '跌破转防守' });
    }
    return { resist: resist, support: support };
  }

  function getIdxData() {
    var out = [];
    for (var i = 0; i < IDX_LIST.length; i++) {
      var q = getQuote(IDX_LIST[i].tc);
      if (q) {
        out.push({
          name: IDX_LIST[i].name, tc: IDX_LIST[i].tc,
          price: q.price, open: q.open, high: q.high, low: q.low, prev: q.prev,
          pct: pctOf(q.price, q.prev), amt: q.amt || 0
        });
      }
    }
    return out;
  }

  function getHoldingsData() {
    var out = [];
    for (var i = 0; i < HOLDINGS.length; i++) {
      var h = HOLDINGS[i];
      var q = getQuote(h.tc);
      var price = q ? q.price : h.snap;
      var pct = q ? pctOf(q.price, q.prev) : h.snapPct;
      var mktVal = price * h.shares;
      var costVal = h.cost * h.shares;
      var pnl = mktVal - costVal;
      var pnlPct = costVal > 0 ? pnl / costVal * 100 : 0;
      var dayPnl = q ? (q.price - q.prev) * h.shares : 0;
      out.push({
        name: h.name, tc: h.tc, shares: h.shares, cost: h.cost,
        price: price, pct: pct, mktVal: mktVal, pnl: pnl, pnlPct: pnlPct, dayPnl: dayPnl
      });
    }
    return out;
  }

  function getBreadth() {
    if (!window.Watchlist || !window.Watchlist.getQuote) return null;
    var up = 0, down = 0, flat = 0, limitUp = 0, limitDown = 0;
    var stocks = window.Watchlist.getStocks ? window.Watchlist.getStocks() : [];
    if (!stocks || stocks.length === 0) return null;
    for (var i = 0; i < stocks.length; i++) {
      var q = getQuote(stocks[i].tc);
      if (!q) continue;
      var p = pctOf(q.price, q.prev);
      if (p > 0.01) { up++; if (p >= 9.9) limitUp++; }
      else if (p < -0.01) { down++; if (p <= -9.9) limitDown++; }
      else flat++;
    }
    var total = up + down + flat;
    return { up: up, down: down, flat: flat, limitUp: limitUp, limitDown: limitDown, total: total };
  }

  function hasData() {
    return getQuote('sh000001') !== null;
  }

  /* ===================== 渲染 ===================== */

  function updateRecapBanner(idxData) {
    var headline = el('recap-headline');
    var desc = el('recap-desc');
    if (!headline || !desc) return;
    var sh = idxData[0];
    var sz = idxData.length > 1 ? idxData[1] : null;
    var cyb = idxData.length > 2 ? idxData[2] : null;
    headline.textContent = todayStr() + ' 复盘：' + pathDesc(sh);

    var parts = [];
    parts.push('A股三大指数' + (sh.pct >= 0 ? '集体收红' : '分化') + '。');
    parts.push('上证指数' + fmtPct(sh.pct) + '报' + sh.price.toFixed(2) + '点');
    if (sz) parts.push('，深证成指' + fmtPct(sz.pct));
    if (cyb) parts.push('，创业板指' + fmtPct(cyb.pct));
    if (sz && sz.amt > 0) {
      var totalAmt = (sh.amt || 0) + (sz.amt || 0);
      parts.push('。两市成交约' + (totalAmt / 100).toFixed(0) + '亿元');
    }
    var a = analyzeBar(sh);
    if (a) {
      if (a.amp < 1) parts.push('，振幅仅' + a.amp.toFixed(2) + '%，观望情绪较重');
      else if (a.amp > 3) parts.push('，振幅' + a.amp.toFixed(2) + '%，波动较大');
    }
    parts.push('。');
    desc.textContent = parts.join('');
  }

  function updateRecapStats(idxData) {
    var statsEl = el('recap-stats');
    if (!statsEl) return;
    var sh = idxData[0];
    var br = getBreadth();
    var html = '';
    if (br) {
      html += '<div class="recap-stat-row"><span class="recap-stat-label">上涨家数</span><span class="recap-stat-value" style="color:var(--up)">' + br.up + '家</span></div>';
      html += '<div class="recap-stat-row"><span class="recap-stat-label">下跌家数</span><span class="recap-stat-value" style="color:var(--down)">' + br.down + '家</span></div>';
      html += '<div class="recap-stat-row"><span class="recap-stat-label">涨停家数</span><span class="recap-stat-value" style="color:var(--up)">' + br.limitUp + '家</span></div>';
      if (br.limitDown > 0) html += '<div class="recap-stat-row"><span class="recap-stat-label">跌停家数</span><span class="recap-stat-value" style="color:var(--down)">' + br.limitDown + '家</span></div>';
    }
    if (sh.amt > 0) {
      html += '<div class="recap-stat-row"><span class="recap-stat-label">沪市成交额</span><span class="recap-stat-value">' + (sh.amt / 100).toFixed(0) + '亿</span></div>';
    }
    statsEl.innerHTML = html;
  }

  function updateHoldingsRecap() {
    var holds = getHoldingsData();
    var totalMktVal = 0, totalCost = 0, totalDayPnl = 0;
    for (var i = 0; i < holds.length; i++) {
      totalMktVal += holds[i].mktVal;
      totalCost += holds[i].cost * holds[i].shares;
      totalDayPnl += holds[i].dayPnl;
    }
    var totalAssets = totalMktVal + CASH;
    var totalPnl = totalAssets - INIT_CAPITAL;
    var totalPnlPct = INIT_CAPITAL > 0 ? totalPnl / INIT_CAPITAL * 100 : 0;
    var dayPnlPct = (totalAssets - totalDayPnl) > 0 ? totalDayPnl / (totalAssets - totalDayPnl) * 100 : 0;
    var position = totalMktVal / totalAssets * 100;

    var html = '<div style="padding:16px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:10px;margin-bottom:20px;">';
    html += '<h3 style="font-size:15px;margin-bottom:12px;color:var(--accent);">我的持仓复盘 · ' + todayStr() + '</h3>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;font-size:13px;line-height:1.8;color:var(--ink);">';
    html += '<div>';
    html += '<p style="margin-bottom:8px;"><strong>当日盈亏：</strong><span style="color:' + (totalDayPnl >= 0 ? 'var(--up)' : 'var(--down)') + ';">' + fmtSigned(totalDayPnl) + ' 元 (' + fmtPct(dayPnlPct) + ')</span></p>';
    html += '<p style="margin-bottom:8px;"><strong>累计盈亏：</strong><span style="color:' + (totalPnl >= 0 ? 'var(--up)' : 'var(--down)') + ';">' + fmtSigned(totalPnl) + ' 元 (' + fmtPct(totalPnlPct) + ')</span></p>';
    html += '<p><strong>总资产：</strong>' + fmtMoney(totalAssets) + ' 元 · 仓位 ' + position.toFixed(1) + '%</p>';
    html += '</div><div>';
    for (var j = 0; j < holds.length; j++) {
      var h = holds[j];
      html += '<p style="margin-bottom:6px;"><strong>' + h.name + '</strong>：现价' + fmtPrice(h.price) + ' (' + fmtPct(h.pct) + ') · 盈亏' + fmtSigned(h.pnl) + ' (' + fmtPct(h.pnlPct) + ')</p>';
    }
    html += '</div></div></div>';
    return html;
  }

  function updateMarketAnalysis(idxData) {
    var sh = idxData[0];
    var a = analyzeBar(sh);
    var pred = predictBias(sh);
    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">';
    html += '<div><h3 style="font-size:15px;margin-bottom:12px;color:var(--accent);">市场研判 · ' + todayStr() + '</h3>';
    html += '<div style="font-size:13px;line-height:1.8;color:var(--ink);">';
    html += '<p style="margin-bottom:10px;"><strong>1. K线结构：</strong>' + pathDesc(sh) + '，收盘处于' + closeLabel(a ? a.clv : 0.5).txt + '。';
    if (a) html += '振幅' + a.amp.toFixed(2) + '%，' + (a.amp < 1 ? '市场波动收敛，观望情绪较重' : a.amp > 3 ? '市场分歧较大，波动剧烈' : '波动适中') + '。</p>';
    html += '<p style="margin-bottom:10px;"><strong>2. 量能：</strong>';
    if (sh.amt > 0) html += '沪市成交' + (sh.amt / 100).toFixed(0) + '亿，';
    html += '需结合昨日对比判断缩量/放量。</p>';
    html += '<p style="margin-bottom:10px;"><strong>3. 次日倾向：</strong><span style="color:' + pred.color + ';font-weight:600;">' + pred.label + '</span> — ' + pred.desc + '。</p>';
    html += '<p><strong>4. 操作建议：</strong>' + (pred.score >= 0.5 ? '持股为主，关注上方压力位能否突破' : pred.score <= -0.5 ? '控制仓位，关注支撑位能否守住' : '高抛低吸，轻仓观望') + '。</p>';
    html += '</div></div>';
    html += '<div><h3 style="font-size:15px;margin-bottom:12px;color:var(--accent);">次日预判 · ' + nextTradeDay() + '</h3>';
    html += '<div style="font-size:13px;line-height:1.8;color:var(--ink);">';
    var lv = calcLevels(sh.price, sh.high, sh.low, sh.prev);
    html += '<p style="margin-bottom:8px;"><strong style="color:var(--up);">压力位：</strong>';
    for (var i = 0; i < lv.resist.length; i++) {
      html += lv.resist[i].tag + ' ' + lv.resist[i].txt + '（' + lv.resist[i].basis + '）';
      if (i < lv.resist.length - 1) html += ' · ';
    }
    html += '</p>';
    html += '<p style="margin-bottom:8px;"><strong style="color:var(--down);">支撑位：</strong>';
    for (var i = 0; i < lv.support.length; i++) {
      html += lv.support[i].tag + ' ' + lv.support[i].txt + '（' + lv.support[i].basis + '）';
      if (i < lv.support.length - 1) html += ' · ';
    }
    html += '</p>';
    html += '<p style="margin-bottom:8px;"><strong style="color:var(--accent);">综合信号：</strong>评分 ' + pred.score.toFixed(2) + '，倾向' + pred.label + '。</p>';
    html += '<p><strong style="color:var(--accent2);">关注要点：</strong>开盘位置（高开/低开/平开）、首15分钟量能、是否回补缺口。</p>';
    html += '</div></div></div>';
    return html;
  }

  function updatePremarketForNextDay(idxData) {
    var sh = idxData[0];
    var lv = calcLevels(sh.price, sh.high, sh.low, sh.prev);
    var headline = el('pm-headline');
    if (headline) headline.textContent = nextTradeDay() + ' 盘前研判 · 基于' + todayShort() + '收盘';
    var idxPriceEl = el('pm-idx-price');
    var idxChgEl = el('pm-idx-chg');
    if (idxPriceEl) { idxPriceEl.textContent = sh.price.toFixed(2); idxPriceEl.style.color = upColor(sh.pct); }
    if (idxChgEl) { idxChgEl.textContent = fmtPct(sh.pct); idxChgEl.style.color = upColor(sh.pct); }

    var tbody = el('pm-idx-tbody');
    if (tbody) {
      var html = '';
      lv.resist.slice().reverse().forEach(function(lvItem, i) {
        var idx = lv.resist.length - 1 - i;
        html += '<tr><td class="change-up" style="font-weight:600;">压力</td>'
          + '<td>' + lvItem.tag + '</td>'
          + '<td style="font-weight:700;color:var(--up);">' + lvItem.txt + '</td>'
          + '<td style="color:var(--muted);font-size:12px;">' + lvItem.basis + '</td>'
          + '<td style="color:var(--muted);font-size:12px;">' + lvItem.meaning + '</td>'
          + '<td id="pm-idx-st-r' + idx + '"></td></tr>';
      });
      lv.support.forEach(function(lvItem, idx) {
        html += '<tr><td class="change-down" style="font-weight:600;">支撑</td>'
          + '<td>' + lvItem.tag + '</td>'
          + '<td style="font-weight:700;color:var(--down);">' + lvItem.txt + '</td>'
          + '<td style="color:var(--muted);font-size:12px;">' + lvItem.basis + '</td>'
          + '<td style="color:var(--muted);font-size:12px;">' + lvItem.meaning + '</td>'
          + '<td id="pm-idx-st-s' + idx + '"></td></tr>';
      });
      tbody.innerHTML = html;
      tbody.setAttribute('data-built', '1');
    }
  }

  function generate() {
    if (!isPostMarket()) return false;
    var idxData = getIdxData();
    if (idxData.length === 0) return false;

    updateRecapBanner(idxData);
    updateRecapStats(idxData);

    var holdsHtml = updateHoldingsRecap();
    var analysisHtml = updateMarketAnalysis(idxData);

    var reviewCard = el('trading-review-content') || el('auto-recap-review');
    if (reviewCard) {
      reviewCard.innerHTML = holdsHtml + analysisHtml;
    } else {
      var card = el('section-recap');
      if (card) {
        var existing = card.querySelector('.auto-recap-content');
        if (existing) existing.remove();
        var div = document.createElement('div');
        div.className = 'auto-recap-content card';
        div.style.cssText = 'margin-top:24px;border:1px solid rgba(245,158,11,0.3);';
        div.innerHTML = '<div class="card-title">盘后自动复盘 · ' + todayStr() + '<span class="badge">实时生成</span></div>' + holdsHtml + analysisHtml;
        card.appendChild(div);
      }
    }

    updatePremarketForNextDay(idxData);
    return true;
  }

  var initTimer = null;
  var lastGenDate = null;
  var watchTimer = null;

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function tryInit() {
    if (!isPostMarket()) return;
    if (lastGenDate === todayKey()) return;
    if (hasData()) {
      generate();
      lastGenDate = todayKey();
      return;
    }
    if (window.Watchlist && window.Watchlist.refresh) {
      window.Watchlist.refresh();
    }
    var attempts = 0;
    if (initTimer) clearInterval(initTimer);
    initTimer = setInterval(function() {
      attempts++;
      if (hasData() || attempts > 15) {
        clearInterval(initTimer);
        initTimer = null;
        generate();
        lastGenDate = todayKey();
      }
    }, 2000);
  }

  function startWatchTimer() {
    if (watchTimer) clearInterval(watchTimer);
    watchTimer = setInterval(function() {
      if (document.hidden) return;
      if (isWeekdayPreMarket()) {
        clearStaleRecap();
      } else if (isPostMarket() && lastGenDate !== todayKey()) {
        tryInit();
      }
    }, 60000);
  }

  window.AutoRecap = {
    init: function() {
      if (isWeekdayPreMarket()) {
        clearStaleRecap();
      } else if (isPostMarket()) {
        tryInit();
      }
      startWatchTimer();
    },
    onShow: function(tab) {
      if (tab !== 'recap' && tab !== 'premarket') return;
      if (isWeekdayPreMarket()) {
        clearStaleRecap();
        return;
      }
      if (!isPostMarket()) return;
      if (lastGenDate === todayKey() && hasData()) return;
      if (hasData()) { generate(); lastGenDate = todayKey(); }
      else tryInit();
    },
    isPostMarket: isPostMarket,
    generate: generate
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { window.AutoRecap.init(); });
  } else {
    window.AutoRecap.init();
  }
})();
