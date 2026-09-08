/* ==================================================================
   财经早报动态渲染模块
   功能：
   1. 指数卡片实时渲染（上证/深证/创业板/沪深合计）
   2. 全球市场概览实时渲染（美股/原油/黄金/比特币）
   3. 所有日期badge自动更新为当天日期
   4. 盘前研判banner自动生成（标题/描述/统计栏）
   数据来源：Watchlist缓存（腾讯接口）+ GlobalMarket缓存（东方财富接口）
   刷新策略：页面打开即渲染；切换页签时刷新；每15秒轮询
   ================================================================== */
(function() {
  'use strict';

  var REFRESH_MS = 15000;
  var WD = ['日','一','二','三','四','五','六'];
  var WM = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  function el(id) { return document.getElementById(id); }
  function fmtMoney(n) { return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtPct(n) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
  function fmtPrice(p) { return p >= 1000 ? p.toFixed(2) : (p >= 10 ? p.toFixed(2) : p.toFixed(3)); }
  function upColor(n) { return n > 0 ? 'var(--up)' : (n < 0 ? 'var(--down)' : 'var(--muted)'); }
  function upDir(n) { return n > 0 ? 'up' : (n < 0 ? 'down' : ''); }
  function fmtSigned(n) { return (n >= 0 ? '+' : '-') + fmtMoney(Math.abs(n)); }

  function todayFullStr() {
    var d = new Date();
    return WM[d.getMonth()] + d.getDate() + '日（周' + WD[d.getDay()] + '）';
  }

  function todayShort() {
    var d = new Date();
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function todayBadge() {
    var d = new Date();
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function prevTradeShort() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
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

  function pctOf(price, prev) { return (price - prev) / prev * 100; }

  /* ---------- 1. 指数卡片渲染 ---------- */
  function renderIndexStrip() {
    var indices = [
      { tc: 'sh000001', name: '上证', cardId: 'mb-sh-card', priceId: 'mb-sh-price', chgId: 'mb-sh-chg', volId: 'mb-sh-vol', trId: 'mb-sh-tr', snapP: 3905.20, snapC: 0.04, snapAmt: 8834, snapTr: 0.92 },
      { tc: 'sz399001', name: '深证', cardId: 'mb-sz-card', priceId: 'mb-sz-price', chgId: 'mb-sz-chg', volId: 'mb-sz-vol', trId: 'mb-sz-tr', snapP: 14094.17, snapC: 0.87, snapAmt: 9958, snapTr: 2.22 },
      { tc: 'sz399006', name: '创业板', cardId: 'mb-cyb-card', priceId: 'mb-cyb-price', chgId: 'mb-cyb-chg', volId: 'mb-cyb-vol', trId: 'mb-cyb-tr', snapP: 3545.58, snapC: 1.43, snapAmt: 4945, snapTr: 3.08 }
    ];

    var totalAmt = 0;
    var hasLive = false;

    indices.forEach(function(ix) {
      var q = getQuote(ix.tc);
      var price, pct, amt, tr;

      if (q) {
        price = q.price;
        pct = pctOf(q.price, q.prev);
        amt = q.amt > 0 ? q.amt : ix.snapAmt;
        tr = q.turnover > 0 ? q.turnover : ix.snapTr;
        hasLive = true;
      } else {
        price = ix.snapP;
        pct = ix.snapC;
        amt = ix.snapAmt;
        tr = ix.snapTr;
      }

      totalAmt += amt;

      var card = el(ix.cardId);
      if (card) card.className = 'index-card ' + upDir(pct);

      setText(ix.priceId, price.toFixed(2));
      setStyled(ix.chgId, fmtPct(pct) + ' (' + fmtSigned(price - (q ? q.prev : ix.snapP / (1 + ix.snapC / 100))) + ')', upColor(pct));
      setText(ix.volId, '成交' + (amt >= 10000 ? (amt / 10000).toFixed(2) + '万亿' : amt.toFixed(0) + '亿'));
      setText(ix.trId, '换手' + (tr ? tr.toFixed(2) + '%' : '—'));
    });

    // 沪深合计
    var totalCard = el('mb-total-card');
    var totalVol = el('mb-total-vol');
    var totalChg = el('mb-total-chg');
    var totalPct = el('mb-total-pct');
    var totalHint = el('mb-total-hint');

    if (totalVol) totalVol.textContent = (totalAmt >= 10000 ? (totalAmt / 10000).toFixed(2) + '万亿' : totalAmt.toFixed(0) + '亿');

    if (totalAmt > 0) {
      var prevTotal = 18793;
      var diff = totalAmt - prevTotal;
      var diffPct = diff / prevTotal * 100;
      if (totalChg) {
        totalChg.textContent = (diff >= 0 ? '放量' : '缩量') + Math.abs(diff).toFixed(0) + '亿';
        totalChg.className = 'index-change ' + upDir(diff);
      }
      if (totalPct) totalPct.textContent = '较前日' + (diffPct >= 0 ? '+' : '') + diffPct.toFixed(1) + '%';
      if (totalHint) totalHint.textContent = diffPct > 5 ? '放量明显' : (diffPct < -5 ? '缩量明显' : (diffPct < 0 ? '观望情绪升温' : '资金活跃'));
    }
  }

  /* ---------- 2. 全球市场渲染 ---------- */
  function renderGlobalMarkets() {
    var gm = window.GlobalMarket;
    if (!gm) return;

    var items = [
      { id: 'mb-dow', getData: function() { return gm.getQuote('100.DJIA'); }, name: '道琼斯' },
      { id: 'mb-ndx', getData: function() { return gm.getQuote('100.NDX'); }, name: '纳斯达克' },
      { id: 'mb-spx', getData: function() { return gm.getQuote('100.SPX'); }, name: '标普500' }
    ];

    items.forEach(function(it) {
      var q = it.getData();
      var valEl = el(it.id + '-val');
      var subEl = el(it.id + '-sub');
      if (!q) return;
      var pct = q.pct;
      if (valEl) { valEl.textContent = fmtPct(pct); valEl.className = 'metric-value ' + upDir(pct); }
      if (subEl) { subEl.textContent = (pct >= 0 ? '涨' : '跌') + Math.abs(q.price - q.prev).toFixed(0) + '点'; }
    });

    // 原油/黄金/比特币（东方财富商品接口）
    var commodities = [
      { id: 'mb-oil', secid: '113.NYM_CL', name: '纽约原油', sub: '+连涨' },
      { id: 'mb-gold', secid: '113.NYM_GC', name: '现货黄金', sub: '' },
      { id: 'mb-btc', secid: '133.BTCUSD', name: '比特币', sub: '' }
    ];

    commodities.forEach(function(c) {
      var q = gm.getQuote(c.secid);
      if (!q) return;
      var valEl = el(c.id + '-val');
      var subEl = el(c.id + '-sub');
      if (valEl) { valEl.textContent = q.price >= 1000 ? q.price.toFixed(0) : q.price.toFixed(2); valEl.className = 'metric-value ' + upDir(q.pct); }
      if (subEl) { subEl.textContent = fmtPct(q.pct); }
    });

    // 更新全球市场日期
    var dateEl = el('mb-global-date');
    if (dateEl) dateEl.textContent = '最新数据';
  }

  /* ---------- 3. 日期badge自动更新 ---------- */
  function updateDateBadges() {
    var badges = {
      'mb-news-date': todayBadge(),
      'recap-sector-date': todayBadge(),
      'pm-levels-badge': todayShort() + '收盘K线测算 · 实时监控',
      'wl-sector-badge': '同花顺口径 · 快照'
    };

    for (var id in badges) {
      var e = el(id);
      if (e) e.textContent = badges[id];
    }

    // 头部数据更新标签
    var header = el('header-data-update');
    if (header) {
      var st = marketStatus();
      header.textContent = '数据更新: A股 ' + (st.trading ? '实时' : '最新收盘') + ' · 美股/日韩 30分钟按需';
    }
  }

  /* ---------- 4. 盘前研判banner自动生成 ---------- */
  function renderPremarketBanner() {
    var sh = getQuote('sh000001');
    if (!sh) return;

    var headline = el('pm-headline');
    if (headline) headline.textContent = todayFullStr() + ' 盘前研判 · 基于' + prevTradeShort() + '收盘';

    // 统计栏
    var dateStat = el('pm-stat-date');
    if (dateStat) dateStat.textContent = prevTradeShort() + ' 收盘';

    var shStat = el('pm-stat-sh');
    if (shStat) {
      var pct = pctOf(sh.price, sh.prev);
      shStat.textContent = sh.price.toFixed(2) + ' (' + fmtPct(pct) + ')';
      shStat.style.color = upColor(pct);
    }

    // 持仓数据
    var holdings = [
      { tc: 'sh600498', name: '烽火通信', shares: 200, cost: 40.025 },
      { tc: 'sh600353', name: '旭光电子', shares: 200, cost: 32.385 },
      { tc: 'sh512760', name: '芯片ETF', shares: 400, cost: 1.323 },
      { tc: 'sh515050', name: '5GETF', shares: 300, cost: 1.241 }
    ];

    var INIT_CAPITAL = 23555.17;
    var CASH = 8171.33;
    var totalMV = 0, totalPnl = 0, dayPnl = 0;

    holdings.forEach(function(h) {
      var q = getQuote(h.tc);
      if (!q) return;
      var mv = q.price * h.shares;
      totalMV += mv;
      totalPnl += (q.price - h.cost) * h.shares;
      dayPnl += (q.price - q.prev) * h.shares;
    });

    if (totalMV === 0) return;

    var total = totalMV + CASH;
    var realPnl = total - INIT_CAPITAL;
    var posPct = totalMV / total * 100;

    var posStat = el('pm-stat-pos');
    if (posStat) posStat.textContent = posPct.toFixed(1) + '%';

    var cashStat = el('pm-stat-cash');
    if (cashStat) cashStat.textContent = fmtMoney(CASH) + '元';

    // 描述文本
    var desc = el('pm-desc');
    if (desc) {
      var pnlPct = realPnl / INIT_CAPITAL * 100;
      var dayPct = dayPnl / (total - dayPnl) * 100;
      var bias = sh.price > sh.prev ? '偏强' : (sh.price < sh.prev ? '偏弱' : '平开');

      var parts = [];
      parts.push('总资产' + fmtMoney(total) + '元，总市值' + fmtMoney(totalMV) + '元，总盈亏' + fmtSigned(realPnl) + '元（' + fmtPct(pnlPct) + '）。');
      parts.push('兴森科技300股、旭光电子200股、芯片ETF400份、5GETF300份。');
      if (Math.abs(dayPnl) > 0.01) parts.push(prevTradeShort() + '当日' + (dayPnl >= 0 ? '盈利' : '亏损') + fmtMoney(Math.abs(dayPnl)) + '元（' + fmtPct(dayPct) + '）。');
      parts.push('当前仓位' + posPct.toFixed(1) + '%、可用资金' + fmtMoney(CASH) + '元——');

      var shPct = pctOf(sh.price, sh.prev);
      var tone = shPct > 0.5 ? '<strong style="color:var(--up);">偏强震荡，关注突破</strong>' :
                 shPct < -0.5 ? '<strong style="color:var(--down);">弱势震荡，控制仓位</strong>' :
                 '<strong style="color:var(--accent);">窄幅震荡，轻仓观望</strong>';
      parts.push(tone + '。');

      // 关键支撑/压力提示
      var supports = [];
      if (getQuote('sz002436')) {
        var xingsen = getQuote('sz002436');
        supports.push('兴森科技' + xingsen.price.toFixed(2) + '元');
      }
      if (getQuote('sh600353')) {
        var xuguang = getQuote('sh600353');
        supports.push('旭光电子' + xuguang.price.toFixed(2) + '元');
      }
      if (supports.length) parts.push('持仓现价：' + supports.join('、') + '。');

      desc.innerHTML = parts.join('');
    }
  }

  /* ---------- 工具函数 ---------- */
  function setText(id, txt) { var e = el(id); if (e) e.textContent = txt; }
  function setStyled(id, txt, color) { var e = el(id); if (e) { e.textContent = txt; e.style.color = color; } }

  function marketStatus() {
    var now = new Date();
    var day = now.getDay();
    if (day === 0 || day === 6) return { trading: false };
    var m = now.getHours() * 60 + now.getMinutes();
    return { trading: (m >= 570 && m < 690) || (m >= 780 && m < 900) };
  }

  function isBeforeMorning() {
    var now = new Date();
    return now.getHours() * 60 + now.getMinutes() < 540;
  }

  function showMorningPending() {
    var ids = ['mb-sh-price','mb-sz-price','mb-cyb-price','mb-total-vol'];
    ids.forEach(function(id) { setText(id, '—'); });
    var chgIds = ['mb-sh-chg','mb-sz-chg','mb-cyb-chg','mb-total-chg'];
    chgIds.forEach(function(id) { setText(id, '将于9:00更新'); });
    var metaIds = ['mb-sh-vol','mb-sh-tr','mb-sz-vol','mb-sz-tr','mb-cyb-vol','mb-cyb-tr','mb-total-pct','mb-total-hint'];
    metaIds.forEach(function(id) { setText(id, '—'); });
    ['mb-sh-card','mb-sz-card','mb-cyb-card','mb-total-card'].forEach(function(id) {
      var c = el(id); if (c) c.className = 'index-card';
    });

    var gmIds = ['mb-dow-val','mb-ndx-val','mb-spx-val','mb-oil-val','mb-gold-val','mb-btc-val'];
    gmIds.forEach(function(id) { setText(id, '—'); });
    var gmSubs = ['mb-dow-sub','mb-ndx-sub','mb-spx-sub','mb-oil-sub','mb-gold-sub','mb-btc-sub'];
    gmSubs.forEach(function(id) { setText(id, '—'); });

    var headline = el('pm-headline');
    if (headline) headline.textContent = '盘前研判将于9:00更新';
    var desc = el('pm-desc');
    if (desc) desc.innerHTML = '财经早报和盘前研判在每天上午<strong style="color:var(--accent);">9:00</strong>后自动更新，请稍候。';
    ['pm-stat-date','pm-stat-sh','pm-stat-pos','pm-stat-cash'].forEach(function(id) { setText(id, '—'); });

    var gd = el('mb-global-date');
    if (gd) gd.textContent = '将于9:00更新';
    var nd = el('mb-news-date');
    if (nd) nd.textContent = '待更新';
  }

  /* ---------- 主刷新函数 ---------- */
  function refresh() {
    updateDateBadges();
    if (isBeforeMorning()) {
      showMorningPending();
      return;
    }
    renderIndexStrip();
    renderPremarketBanner();
    renderGlobalMarkets();
  }

  function sectionActive(name) {
    var s = el('section-' + name);
    return !!s && s.classList.contains('active');
  }

  var timer = null;
  function scheduleNext() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function() {
      if (!document.hidden) refresh();
      scheduleNext();
    }, REFRESH_MS);
  }

  /* ---------- 初始化 ---------- */
  function init() {
    refresh();
    scheduleNext();

    // 监听页签切换
    var origSwitch = window.switchTab;
    if (origSwitch) {
      window.switchTab = function(tab) {
        origSwitch(tab);
        setTimeout(refresh, 100);
      };
    }
  }

  window.MorningBrief = { refresh: refresh };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }
})();
