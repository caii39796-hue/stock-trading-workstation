/* ==================================================================
   板块热力图 + 市场热点主题 + 盘中实时复盘
   功能：
   1. 板块涨跌幅热力图（行业ETF实时涨跌渲染）
   2. 市场热点主题（涨幅榜/跌幅榜/成交活跃榜）
   3. 盘中实时持仓复盘 + 市场研判（交易日9:25-15:00）
   数据来源：Watchlist缓存（腾讯接口）
   刷新策略：交易日盘中每1秒刷新（复盘页签激活时）；非交易时段显示快照
   ================================================================== */
(function() {
  'use strict';

  var FAST_MS = 1000;
  var SLOW_MS = 15000;

  var WD = ['日','一','二','三','四','五','六'];
  var WM = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  function el(id) { return document.getElementById(id); }
  function fmtPct(n) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
  function fmtPrice(p) { return p >= 10 ? p.toFixed(2) : p.toFixed(3); }
  function fmtMoney(n) { return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtSigned(n) { return (n >= 0 ? '+' : '-') + fmtMoney(Math.abs(n)); }
  function upColor(n) { return n > 0 ? 'var(--up)' : (n < 0 ? 'var(--down)' : 'var(--muted)'); }
  function upDir(n) { return n > 0 ? 'up' : (n < 0 ? 'down' : ''); }

  function todayStr() {
    var d = new Date();
    return WM[d.getMonth()] + d.getDate() + '日（周' + WD[d.getDay()] + '）';
  }

  function todayShort() {
    var d = new Date();
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  /* ---------- 获取行情数据 ---------- */
  function getQuote(tc) {
    if (window.Watchlist && window.Watchlist.getQuote) {
      var q = window.Watchlist.getQuote(tc);
      if (q && q.price > 0 && q.prev > 0) return q;
    }
    return null;
  }

  function getSectorEtfs() {
    if (window.Watchlist && window.Watchlist.getSectorEtfs) return window.Watchlist.getSectorEtfs();
    return [];
  }

  function getIndices() {
    if (window.Watchlist && window.Watchlist.getIndices) return window.Watchlist.getIndices();
    return [];
  }

  function getHoldings() {
    if (window.Watchlist && window.Watchlist.getHoldings) return window.Watchlist.getHoldings();
    return [];
  }

  function getStocks() {
    if (window.Watchlist && window.Watchlist.getStocks) return window.Watchlist.getStocks();
    return [];
  }

  function marketStatus() {
    if (window.Watchlist && window.Watchlist.marketStatus) return window.Watchlist.marketStatus();
    return { trading: false, label: '未知' };
  }

  function pctOf(price, prev) { return (price - prev) / prev * 100; }

  /* ---------- K线分析 ---------- */
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
    if (clv > 0.7) return '高位';
    if (clv > 0.4) return '中高位';
    if (clv > 0.3) return '中低位';
    return '低位';
  }

  function predictBias(q) {
    var a = analyzeBar(q);
    if (!a) return { score: 0, label: '中性', desc: '数据不足', color: 'var(--muted)' };
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
    if (s >= 1.5) return { score: s, label: '偏多', desc: '盘中走势强势，有望延续', color: 'var(--up)' };
    if (s >= 0.5) return { score: s, label: '略偏多', desc: '走势偏强，关注上方压力', color: 'var(--up)' };
    if (s > -0.5) return { score: s, label: '中性', desc: '多空均衡，大概率震荡', color: 'var(--muted)' };
    if (s > -1.5) return { score: s, label: '略偏空', desc: '走势偏弱，承压概率较大', color: 'var(--down)' };
    return { score: s, label: '偏空', desc: '盘中走势弱势，注意下方支撑', color: 'var(--down)' };
  }

  function hasData() {
    return getQuote('sh000001') !== null;
  }

  function recapTabActive() {
    var s = document.querySelector('.section.active');
    return !!s && s.id === 'section-recap';
  }

  function isTradingHours() {
    var ms = marketStatus();
    return ms.trading;
  }

  /* ===================== 1. 板块热力图 ===================== */
  function renderHeatmap() {
    var container = el('sector-heatmap');
    if (!container) return;

    var etfs = getSectorEtfs();
    if (!etfs || etfs.length === 0) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);">等待行情数据加载…</div>';
      return;
    }

    var data = etfs.map(function(e) {
      var q = getQuote(e.tc);
      var pct, price, amt;
      if (q) {
        pct = pctOf(q.price, q.prev);
        price = q.price;
        amt = q.amt > 0 ? q.amt / 10000 : 0;
      } else {
        pct = e.snapC || 0;
        price = e.snapP || 0;
        amt = e.snapAmt || 0;
      }
      return { name: e.name, theme: e.theme, code: e.code, pct: pct, price: price, amt: amt, held: e.held };
    });

    data.sort(function(a, b) { return b.pct - a.pct; });

    var html = '';
    data.forEach(function(d) {
      var intensity = Math.min(Math.abs(d.pct) / 5, 1);
      var bg, textColor;
      if (d.pct > 0.01) {
        bg = 'rgba(239,68,68,' + (0.12 + intensity * 0.48) + ')';
        textColor = 'var(--up)';
      } else if (d.pct < -0.01) {
        bg = 'rgba(34,197,94,' + (0.12 + intensity * 0.48) + ')';
        textColor = 'var(--down)';
      } else {
        bg = 'rgba(148,163,184,0.12)';
        textColor = 'var(--muted)';
      }

      var heldMark = d.held ? ' <span style="color:var(--accent);font-size:10px;">持仓</span>' : '';
      html += '<div class="sector-tile" style="background:' + bg + ';">'
        + '<div class="sector-tile-name">' + d.name + heldMark + '</div>'
        + '<div class="sector-tile-change" style="color:' + textColor + ';">' + (d.pct >= 0 ? '+' : '') + d.pct.toFixed(2) + '%</div>'
        + '<div style="font-size:10px;color:var(--muted);margin-top:2px;">' + d.theme + '</div>'
        + '</div>';
    });

    container.innerHTML = html;

    var badge = el('recap-sector-date');
    if (badge) {
      var ms = marketStatus();
      badge.textContent = ms.trading ? '盘中实时' : todayShort() + ' 快照';
      badge.style.color = ms.trading ? 'var(--up)' : 'var(--muted)';
    }
  }

  /* ===================== 2. 市场热点主题 ===================== */
  function renderHotThemes() {
    var container = el('hot-themes-container');
    if (!container) return;

    var etfs = getSectorEtfs();
    if (!etfs || etfs.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);">等待行情数据加载…</div>';
      return;
    }

    var data = etfs.map(function(e) {
      var q = getQuote(e.tc);
      var pct, amt;
      if (q) {
        pct = pctOf(q.price, q.prev);
        amt = q.amt > 0 ? q.amt / 10000 : 0;
      } else {
        pct = e.snapC || 0;
        amt = e.snapAmt || 0;
      }
      return { name: e.name, theme: e.theme, pct: pct, amt: amt };
    });

    var sorted = data.slice().sort(function(a, b) { return b.pct - a.pct; });
    var gainers = sorted.filter(function(d) { return d.pct > 0; });
    var losers = sorted.filter(function(d) { return d.pct < 0; }).reverse();
    var volLeaders = data.slice().sort(function(a, b) { return b.amt - a.amt; }).slice(0, 6);

    var ms = marketStatus();
    var badgeTxt = ms.trading ? '盘中实时' : '近3日';

    var html = '<div class="grid-3">';

    html += '<div>';
    html += '<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--up);">领涨板块</div>';
    html += '<div class="tag-row">';
    if (gainers.length === 0) {
      html += '<span class="tag" style="color:var(--muted);">暂无上涨板块</span>';
    } else {
      gainers.forEach(function(d) {
        html += '<span class="tag hot">' + d.name + ' +' + d.pct.toFixed(2) + '%</span>';
      });
    }
    html += '</div></div>';

    html += '<div>';
    html += '<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--down);">领跌板块</div>';
    html += '<div class="tag-row">';
    if (losers.length === 0) {
      html += '<span class="tag" style="color:var(--muted);">暂无下跌板块</span>';
    } else {
      losers.forEach(function(d) {
        html += '<span class="tag cold">' + d.name + ' ' + d.pct.toFixed(2) + '%</span>';
      });
    }
    html += '</div></div>';

    html += '<div>';
    html += '<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--accent);">成交活跃</div>';
    html += '<div class="tag-row">';
    volLeaders.forEach(function(d) {
      html += '<span class="tag">' + d.name + ' ' + d.amt.toFixed(1) + '亿</span>';
    });
    html += '</div></div>';

    html += '</div>';
    container.innerHTML = html;

    var badge = el('hot-themes-badge');
    if (badge) {
      badge.textContent = badgeTxt;
      badge.style.color = ms.trading ? 'var(--up)' : 'var(--muted)';
    }
  }

  /* ===================== 3. 盘中实时复盘 ===================== */
  function getIdxData() {
    var indices = getIndices();
    var out = [];
    for (var i = 0; i < indices.length && i < 3; i++) {
      var q = getQuote(indices[i].tc);
      if (q) {
        out.push({
          name: indices[i].name, tc: indices[i].tc,
          price: q.price, open: q.open, high: q.high, low: q.low, prev: q.prev,
          pct: pctOf(q.price, q.prev), amt: q.amt || 0
        });
      }
    }
    return out;
  }

  function getHoldingsData() {
    var holds = getHoldings();
    var out = [];
    for (var i = 0; i < holds.length; i++) {
      var h = holds[i];
      var q = getQuote(h.tc);
      var price = q ? q.price : (h.snap || 0);
      var prev = q ? q.prev : 0;
      var pct = q ? pctOf(q.price, q.prev) : (h.snapPct || 0);
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
    var stocks = getStocks();
    if (!stocks || stocks.length === 0) return null;
    var up = 0, down = 0, flat = 0, limitUp = 0, limitDown = 0;
    for (var i = 0; i < stocks.length; i++) {
      var q = getQuote(stocks[i].tc);
      if (!q) continue;
      var p = pctOf(q.price, q.prev);
      if (p > 0.01) { up++; if (p >= 9.9) limitUp++; }
      else if (p < -0.01) { down++; if (p <= -9.9) limitDown++; }
      else flat++;
    }
    return { up: up, down: down, flat: flat, limitUp: limitUp, limitDown: limitDown };
  }

  function getEtfBreadth() {
    var etfs = getSectorEtfs();
    if (!etfs || etfs.length === 0) return null;
    var up = 0, down = 0, flat = 0;
    for (var i = 0; i < etfs.length; i++) {
      var q = getQuote(etfs[i].tc);
      var pct = q ? pctOf(q.price, q.prev) : (etfs[i].snapC || 0);
      if (pct > 0.01) up++;
      else if (pct < -0.01) down++;
      else flat++;
    }
    return { up: up, down: down, flat: flat, total: etfs.length };
  }

  function renderIntradayRecap() {
    var card = el('trading-review-content');
    if (!card) return;

    var idxData = getIdxData();
    var holds = getHoldingsData();
    var breadth = getBreadth();
    var etfBreadth = getEtfBreadth();

    if (idxData.length === 0 && holds.length === 0) {
      card.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);font-size:14px;">等待行情数据加载…</div>';
      return;
    }

    var sh = idxData[0] || null;
    var sz = idxData[1] || null;
    var cyb = idxData[2] || null;

    var totalMktVal = 0, totalCost = 0, totalDayPnl = 0;
    for (var i = 0; i < holds.length; i++) {
      totalMktVal += holds[i].mktVal;
      totalCost += holds[i].cost * holds[i].shares;
      totalDayPnl += holds[i].dayPnl;
    }
    var CASH_VAL = 8171.33;
    var INIT_CAP = 23555.17;
    var totalAssets = totalMktVal + CASH_VAL;
    var totalPnl = totalAssets - INIT_CAP;
    var totalPnlPct = INIT_CAP > 0 ? totalPnl / INIT_CAP * 100 : 0;
    var dayPnlPct = (totalAssets - totalDayPnl) > 0 ? totalDayPnl / (totalAssets - totalDayPnl) * 100 : 0;
    var position = totalAssets > 0 ? totalMktVal / totalAssets * 100 : 0;

    var ms = marketStatus();
    var label = ms.trading ? '盘中实时' : '收盘快照';

    /* 更新复盘横幅 */
    if (ms.trading || ms.key === 'closed') {
      var headline = el('recap-headline');
      var desc = el('recap-desc');
      if (headline && sh) {
        headline.textContent = todayStr() + ' 盘中实时 · ' + pathDesc(sh);
      }
      if (desc && sh) {
        var parts = [];
        parts.push('上证' + fmtPct(sh.pct) + '报' + sh.price.toFixed(2) + '点');
        if (sz) parts.push('，深证' + fmtPct(sz.pct));
        if (cyb) parts.push('，创业板' + fmtPct(cyb.pct));
        parts.push('。总资产' + fmtMoney(totalAssets) + '元，当日' + (totalDayPnl >= 0 ? '盈利' : '亏损') + fmtSigned(totalDayPnl) + '元');
        parts.push('（' + fmtPct(dayPnlPct) + '），仓位' + position.toFixed(1) + '%。');
        desc.textContent = parts.join('');
      }

      var statsEl = el('recap-stats');
      if (statsEl) {
        var statsHtml = '';
        if (breadth) {
          statsHtml += '<div class="recap-stat-row"><span class="recap-stat-label">自选上涨</span><span class="recap-stat-value" style="color:var(--up)">' + breadth.up + '家</span></div>';
          statsHtml += '<div class="recap-stat-row"><span class="recap-stat-label">自选下跌</span><span class="recap-stat-value" style="color:var(--down)">' + breadth.down + '家</span></div>';
          if (breadth.limitUp > 0) statsHtml += '<div class="recap-stat-row"><span class="recap-stat-label">涨停</span><span class="recap-stat-value" style="color:var(--up)">' + breadth.limitUp + '家</span></div>';
        }
        if (etfBreadth) {
          statsHtml += '<div class="recap-stat-row"><span class="recap-stat-label">板块ETF涨跌</span><span class="recap-stat-value">' + etfBreadth.up + '/' + etfBreadth.down + '</span></div>';
        }
        var totalAmt = 0;
        if (sh && sh.amt > 0) totalAmt += sh.amt;
        if (sz && sz.amt > 0) totalAmt += sz.amt;
        if (totalAmt > 0) {
          statsHtml += '<div class="recap-stat-row"><span class="recap-stat-label">两市成交额</span><span class="recap-stat-value">' + (totalAmt / 100).toFixed(0) + '亿</span></div>';
        }
        statsHtml += '<div class="recap-stat-row"><span class="recap-stat-label">当日盈亏</span><span class="recap-stat-value" style="color:' + (totalDayPnl >= 0 ? 'var(--up)' : 'var(--down)') + '">' + fmtSigned(totalDayPnl) + '元</span></div>';
        statsEl.innerHTML = statsHtml;
      }
    }

    var html = '';

    /* --- 持仓复盘 --- */
    html += '<div style="padding:16px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:10px;margin-bottom:20px;">';
    html += '<h3 style="font-size:15px;margin-bottom:12px;color:var(--accent);">📊 持仓复盘 · ' + todayStr() + ' <span style="font-size:11px;color:var(--muted);font-weight:400;">(' + label + ')</span></h3>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;font-size:13px;line-height:1.8;color:var(--ink);">';

    html += '<div>';
    html += '<p style="margin-bottom:8px;"><strong>当日盈亏：</strong><span style="color:' + (totalDayPnl >= 0 ? 'var(--up)' : 'var(--down)') + ';font-weight:600;">' + fmtSigned(totalDayPnl) + ' 元 (' + fmtPct(dayPnlPct) + ')</span></p>';
    html += '<p style="margin-bottom:8px;"><strong>累计盈亏：</strong><span style="color:' + (totalPnl >= 0 ? 'var(--up)' : 'var(--down)') + ';font-weight:600;">' + fmtSigned(totalPnl) + ' 元 (' + fmtPct(totalPnlPct) + ')</span></p>';
    html += '<p style="margin-bottom:8px;"><strong>总资产：</strong>' + fmtMoney(totalAssets) + ' 元 · 仓位 ' + position.toFixed(1) + '%</p>';

    var bestHold = null, worstHold = null;
    for (var j = 0; j < holds.length; j++) {
      if (!bestHold || holds[j].pct > bestHold.pct) bestHold = holds[j];
      if (!worstHold || holds[j].pct < worstHold.pct) worstHold = holds[j];
    }
    if (bestHold) html += '<p style="margin-bottom:8px;"><strong>盘中最强：</strong>' + bestHold.name + ' ' + fmtPct(bestHold.pct) + '</p>';
    if (worstHold && worstHold !== bestHold) html += '<p><strong>盘中最弱：</strong>' + worstHold.name + ' ' + fmtPct(worstHold.pct) + '</p>';
    html += '</div>';

    html += '<div>';
    for (var k = 0; k < holds.length; k++) {
      var h = holds[k];
      html += '<p style="margin-bottom:6px;"><strong>' + h.name + '</strong>：' + fmtPrice(h.price) + ' (' + fmtPct(h.pct) + ') · 盈亏 ' + fmtSigned(h.pnl) + ' (' + fmtPct(h.pnlPct) + ')</p>';
    }
    html += '</div>';
    html += '</div></div>';

    /* --- 市场研判 + 操作建议 --- */
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">';

    /* 市场研判 */
    html += '<div>';
    html += '<h3 style="font-size:15px;margin-bottom:12px;color:var(--accent);">市场研判 · ' + todayStr() + '</h3>';
    html += '<div style="font-size:13px;line-height:1.8;color:var(--ink);">';

    if (sh) {
      var a = analyzeBar(sh);
      var pred = predictBias(sh);
      html += '<p style="margin-bottom:10px;"><strong>1. 大盘走势：</strong>上证指数' + fmtPct(sh.pct) + '报' + sh.price.toFixed(2) + '点';
      if (sz) html += '，深证成指' + fmtPct(sz.pct);
      if (cyb) html += '，创业板指' + fmtPct(cyb.pct);
      html += '。</p>';

      if (a) {
        html += '<p style="margin-bottom:10px;"><strong>2. K线结构：</strong>' + pathDesc(sh) + '，收盘处于' + closeLabel(a.clv) + '。振幅' + a.amp.toFixed(2) + '%，';
        if (a.amp < 1) html += '波动收敛，观望情绪较重。';
        else if (a.amp > 3) html += '波动较大，多空分歧明显。';
        else html += '波动适中。';
        html += '</p>';
      }

      if (breadth) {
        html += '<p style="margin-bottom:10px;"><strong>3. 市场广度：</strong>自选股中' + breadth.up + '涨' + breadth.down + '跌';
        if (breadth.limitUp > 0) html += '，涨停' + breadth.limitUp + '家';
        html += '。';
        if (etfBreadth) html += '板块ETF中' + etfBreadth.up + '涨' + etfBreadth.down + '跌，';
        if (etfBreadth && etfBreadth.up > etfBreadth.down) html += '板块整体偏强。';
        else if (etfBreadth) html += '板块整体偏弱。';
        html += '</p>';
      }

      html += '<p style="margin-bottom:10px;"><strong>4. 盘中倾向：</strong><span style="color:' + pred.color + ';font-weight:600;">' + pred.label + '</span> — ' + pred.desc + '。</p>';
    } else {
      html += '<p>等待行情数据加载…</p>';
    }

    var totalAmt = 0;
    if (sh && sh.amt > 0) totalAmt += sh.amt;
    if (sz && sz.amt > 0) totalAmt += sz.amt;
    if (totalAmt > 0) {
      html += '<p><strong>5. 成交额：</strong>两市合计约' + (totalAmt / 100).toFixed(0) + '亿元。';
      if (totalAmt / 100 < 8000) html += '量能偏缩，反弹持续性存疑。';
      else if (totalAmt / 100 > 15000) html += '量能充沛，资金参与积极。';
      else html += '量能适中。';
      html += '</p>';
    }

    html += '</div></div>';

    /* 操作建议 */
    html += '<div>';
    html += '<h3 style="font-size:15px;margin-bottom:12px;color:var(--accent);">操作建议</h3>';
    html += '<div style="font-size:13px;line-height:1.8;color:var(--ink);">';

    var etfs = getSectorEtfs();
    var etfData = etfs.map(function(e) {
      var q = getQuote(e.tc);
      var pct = q ? pctOf(q.price, q.prev) : (e.snapC || 0);
      return { name: e.name, theme: e.theme, pct: pct };
    });
    var topSectors = etfData.filter(function(d) { return d.pct > 0; }).sort(function(a, b) { return b.pct - a.pct; }).slice(0, 3);
    var weakSectors = etfData.filter(function(d) { return d.pct < 0; }).sort(function(a, b) { return a.pct - b.pct; }).slice(0, 3);

    html += '<p style="margin-bottom:8px;"><strong style="color:var(--up);">关注方向：</strong>';
    if (topSectors.length > 0) {
      html += topSectors.map(function(d) { return d.name + '(' + d.theme + ') ' + fmtPct(d.pct); }).join('、');
    } else {
      html += '暂无强势板块';
    }
    html += '</p>';

    html += '<p style="margin-bottom:8px;"><strong style="color:var(--down);">回避方向：</strong>';
    if (weakSectors.length > 0) {
      html += weakSectors.map(function(d) { return d.name + '(' + d.theme + ') ' + fmtPct(d.pct); }).join('、');
    } else {
      html += '暂无明显弱势板块';
    }
    html += '</p>';

    html += '<p style="margin-bottom:8px;"><strong style="color:var(--accent);">仓位建议：</strong>当前仓位' + position.toFixed(1) + '%';
    if (position > 80) html += '偏高，建议逢高减仓至6-7成，留足现金应对波动。';
    else if (position < 40) html += '偏低，可逢低加仓至5-6成。';
    else html += '适中，攻守兼备。';
    html += '</p>';

    if (sh && pred) {
      html += '<p><strong style="color:var(--accent2);">持仓操作：</strong>';
      if (pred.score >= 0.5) html += '持股为主，关注上方压力位能否突破，盈利仓可适当高抛做T。';
      else if (pred.score <= -0.5) html += '控制仓位，关注支撑位能否守住，浮亏仓不宜追加。';
      else html += '高抛低吸，轻仓观望，等待方向明确。';
      html += '</p>';
    }

    html += '</div></div>';
    html += '</div>';

    card.innerHTML = html;
  }

  /* ===================== 渲染入口 ===================== */
  function renderAll() {
    renderHeatmap();
    renderHotThemes();
    if (isTradingHours() || hasData()) {
      renderIntradayRecap();
    }
  }

  /* ===================== 定时刷新 ===================== */
  var timer = null;

  function scheduleNext() {
    if (timer) clearTimeout(timer);
    var ms = (isTradingHours() && recapTabActive()) ? FAST_MS : SLOW_MS;
    timer = setTimeout(function() {
      if (!document.hidden) renderAll();
      scheduleNext();
    }, ms);
  }

  function init() {
    renderAll();
    scheduleNext();

    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) renderAll();
    });
  }

  window.SectorHeatmap = {
    init: function() { init(); },
    onShow: function() { renderAll(); },
    renderAll: renderAll
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { init(); });
  } else {
    init();
  }
})();
