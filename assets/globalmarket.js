/* ==================================================================
   全球市场模块：美股市场 / 日韩市场 / 全球复盘
   数据源：东方财富 push2delay 行情接口（JSONP，收盘数据准确，盘中约15分钟延迟）
          A股指数：腾讯 qt.gtimg.cn（快照兜底 8/21 收盘）
   刷新策略：页面打开首次拉取；切换页签且数据超过30分钟时刷新；
            页签可见期间每30分钟自动刷新一次（按需更新，非实时）
   复盘逻辑：基于当根日K的开高低收/昨收，计算跳空、振幅、
            收盘位置(CLV)、影线结构，规则化生成波动整理与次日预判
   ================================================================== */
(function() {
  'use strict';

  var REFRESH_MS = 30 * 60 * 1000;
  var UT = 'fa5fd1943c7b386f172d6893dbfba10b';
  var FIELDS = 'f2,f3,f4,f5,f6,f12,f13,f14,f15,f16,f17,f18';
  var cbSeq = 0;

  /* ================= 数据定义（snap* 为 8/21 收盘快照兜底） ================= */

  var US_INDICES = [
    { secid: '100.DJIA', code: 'DJIA', name: '道琼斯工业指数', snapP: 53277.01, snapC: 0.98, snapO: 52768.87, snapH: 53355.92, snapL: 52768.87, snapPrev: 52759.21 },
    { secid: '100.NDX', code: 'NDX', name: '纳斯达克指数', snapP: 26180.45, snapC: 0.43, snapO: 26198.83, snapH: 26269.85, snapL: 26049.30, snapPrev: 26067.17 },
    { secid: '100.NDX100', code: 'NDX100', name: '纳斯达克100', snapP: 29308.86, snapC: 0.33, snapO: 29359.60, snapH: 29405.12, snapL: 29142.44, snapPrev: 29213.16 },
    { secid: '251.SOX', code: 'SOX', name: '费城半导体指数', snapP: 11740.37, snapC: -0.51, snapO: 11901.79, snapH: 11943.96, snapL: 11631.72, snapPrev: 11800.02 }
  ];

  var US_STOCKS = [
    { secid: '105.AAPL', code: 'AAPL', name: '苹果', group: '平台大盘', snapP: 309.35, snapC: -0.63, snapO: 312.05, snapH: 312.38, snapL: 307.01, snapPrev: 311.30, snapAmt: 145.2 },
    { secid: '105.MSFT', code: 'MSFT', name: '微软', group: '平台大盘', snapP: 483.24, snapC: 0.43, snapO: 479.88, snapH: 486.36, snapL: 478.53, snapPrev: 481.15, snapAmt: 108.7 },
    { secid: '105.GOOGL', code: 'GOOGL', name: '谷歌-A', group: '平台大盘', snapP: 344.82, snapC: 1.22, snapO: 342.58, snapH: 346.20, snapL: 340.40, snapPrev: 340.67, snapAmt: 71.8 },
    { secid: '105.TSLA', code: 'TSLA', name: '特斯拉', group: '平台大盘', snapP: 362.86, snapC: 5.14, snapO: 349.88, snapH: 366.50, snapL: 346.90, snapPrev: 345.13, snapAmt: 213.5 },
    { secid: '105.NVDA', code: 'NVDA', name: '英伟达', group: 'AI芯片', snapP: 214.72, snapC: -0.98, snapO: 218.42, snapH: 218.74, snapL: 214.50, snapPrev: 216.85, snapAmt: 213.4 },
    { secid: '105.AVGO', code: 'AVGO', name: '博通', group: 'AI芯片', snapP: 368.45, snapC: 1.21, snapO: 370.69, snapH: 375.13, snapL: 365.05, snapPrev: 364.03, snapAmt: 70.2 },
    { secid: '105.AMD', code: 'AMD', name: '超威半导体', group: 'AI芯片', snapP: 473.25, snapC: 0.81, snapO: 476.50, snapH: 477.36, snapL: 462.11, snapPrev: 469.46, snapAmt: 67.5 },
    { secid: '105.MU', code: 'MU', name: '美光科技', group: '存储芯片', snapP: 966.78, snapC: -0.77, snapO: 989.68, snapH: 989.96, snapL: 958.26, snapPrev: 974.33, snapAmt: 211.6 },
    { secid: '105.LITE', code: 'LITE', name: 'Lumentum', group: '光模块/光器件', snapP: 866.71, snapC: -1.43, snapO: 898.62, snapH: 922.99, snapL: 855.01, snapPrev: 879.28, snapAmt: 32.3 },
    { secid: '105.AAOI', code: 'AAOI', name: '应用光电', group: '光模块/光器件', snapP: 124.82, snapC: -3.32, snapO: 129.37, snapH: 133.72, snapL: 121.89, snapPrev: 129.10, snapAmt: 12.1 },
    { secid: '106.GLW', code: 'GLW', name: '康宁', group: '光模块/光器件', snapP: 149.84, snapC: -1.06, snapO: 153.85, snapH: 155.48, snapL: 148.05, snapPrev: 151.45, snapAmt: 9.3 },
    { secid: '105.TSEM', code: 'TSEM', name: 'Tower半导体', group: '晶圆代工', snapP: 222.59, snapC: -0.53, snapO: 226.95, snapH: 229.79, snapL: 217.82, snapPrev: 223.78, snapAmt: 1.8 }
  ];

  var ASIA_INDICES = [
    { secid: '100.N225', code: 'N225', name: '日经225', market: '日本', snapP: 66016.36, snapC: -0.30, snapO: 65427.69, snapH: 66125.88, snapL: 65260.22, snapPrev: 66216.79 },
    { secid: '100.KS11', code: 'KS11', name: '韩国KOSPI', market: '韩国', snapP: 6912.95, snapC: 0.88, snapO: 6759.95, snapH: 6954.12, snapL: 6742.44, snapPrev: 6852.58 }
  ];

  var JP_STOCKS = [
    { secid: '176.8035', code: '8035', name: '东京电子', group: '半导体设备', snapP: 54290, snapC: 0.50, snapO: 53020, snapH: 54770, snapL: 52910, snapPrev: 54020, snapVolWan: 214.5 },
    { secid: '176.6857', code: '6857', name: '爱德万测试', group: '半导体设备', snapP: 35900, snapC: 1.53, snapO: 34660, snapH: 35970, snapL: 34660, snapPrev: 35360, snapVolWan: 653.2 },
    { secid: '176.6146', code: '6146', name: 'DISCO', group: '半导体设备', snapP: 61360, snapC: 1.72, snapO: 59320, snapH: 61360, snapL: 59140, snapPrev: 60320, snapVolWan: 101.2 },
    { secid: '176.9984', code: '9984', name: '软银集团', group: '科技投资', snapP: 5255, snapC: -2.45, snapO: 5248, snapH: 5357, snapL: 5223, snapPrev: 5387, snapVolWan: 2882.6 },
    { secid: '176.6758', code: '6758', name: '索尼集团', group: '消费电子', snapP: 3785, snapC: 0.21, snapO: 3739, snapH: 3785, snapL: 3735, snapPrev: 3777, snapVolWan: 905.0 },
    { secid: '176.6861', code: '6861', name: '基恩士', group: '传感器/机器视觉', snapP: 79900, snapC: -0.98, snapO: 78950, snapH: 80470, snapL: 78690, snapPrev: 80690, snapVolWan: 39.4 },
    { secid: '176.4063', code: '4063', name: '信越化学', group: '半导体材料', snapP: 6051, snapC: -1.79, snapO: 6100, snapH: 6117, snapL: 6025, snapPrev: 6161, snapVolWan: 519.2 },
    { secid: '176.7203', code: '7203', name: '丰田汽车', group: '汽车', snapP: 3132, snapC: 2.15, snapO: 3066, snapH: 3132, snapL: 3056, snapPrev: 3066, snapVolWan: 2592.5 }
  ];

  var KR_STOCKS = [
    { secid: '177.005930', code: '005930', name: '三星电子', group: '存储/半导体', snapP: 281500, snapC: 3.87, snapO: 267000, snapH: 285000, snapL: 266000, snapPrev: 271000, snapVolWan: 2551.3 },
    { secid: '177.000660', code: '000660', name: 'SK海力士', group: '存储/半导体', snapP: 1730000, snapC: 2.31, snapO: 1675000, snapH: 1773000, snapL: 1669000, snapPrev: 1691000, snapVolWan: 399.9 },
    { secid: '177.373220', code: '373220', name: 'LG新能源', group: '电池', snapP: 343500, snapC: -4.05, snapO: 355500, snapH: 356000, snapL: 341500, snapPrev: 358000, snapVolWan: 24.9 },
    { secid: '177.006400', code: '006400', name: '三星SDI', group: '电池', snapP: 478000, snapC: -4.30, snapO: 487500, snapH: 492000, snapL: 476000, snapPrev: 499500, snapVolWan: 28.6 },
    { secid: '177.035420', code: '035420', name: 'NAVER', group: '互联网/AI', snapP: 222000, snapC: 1.14, snapO: 219000, snapH: 225000, snapL: 214000, snapPrev: 219500, snapVolWan: 98.6 },
    { secid: '177.035720', code: '035720', name: 'Kakao', group: '互联网/AI', snapP: 35800, snapC: -7.49, snapO: 38150, snapH: 38750, snapL: 33600, snapPrev: 38700, snapVolWan: 1005.0 },
    { secid: '177.005380', code: '005380', name: '现代汽车', group: '汽车', snapP: 415000, snapC: -0.60, snapO: 406500, snapH: 420500, snapL: 405000, snapPrev: 417500, snapVolWan: 37.2 },
    { secid: '177.000270', code: '000270', name: '起亚汽车', group: '汽车', snapP: 130900, snapC: -0.15, snapO: 129900, snapH: 131800, snapL: 129400, snapPrev: 131100, snapVolWan: 66.7 }
  ];

  // A股指数（全球复盘用，腾讯行情；快照 8/21 收盘，含开高低收）
  var A_INDICES = [
    { tc: 'sh000001', name: '上证指数', snapP: 3905.20, snapC: 0.04, snapPrev: 3903.72, snapO: 3891.18, snapH: 3912.13, snapL: 3883.79 },
    { tc: 'sz399001', name: '深证成指', snapP: 14094.17, snapC: 0.87, snapPrev: 13972.78, snapO: 13935.64, snapH: 14132.04, snapL: 13866.39 },
    { tc: 'sz399006', name: '创业板指', snapP: 3545.58, snapC: 1.43, snapPrev: 3495.59, snapO: 3495.11, snapH: 3563.06, snapL: 3478.52 }
  ];

  /* ================= 状态 ================= */

  var usData = {};      // secid -> quote
  var asiaData = {};    // secid -> quote
  var aData = {};       // tc -> {price, prev, pct}
  var lastUpdate = { us: null, asia: null, a: null };
  var lastOk = { us: false, asia: false, a: false };
  var loading = { us: false, asia: false, a: false };

  /* ================= 工具 ================= */

  function el(id) { return document.getElementById(id); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function num(v) {
    if (typeof v === 'number') return v;
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }
  function fmtPct(n) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
  function fmtInt(n) { return Math.round(n).toLocaleString('en-US'); }
  function chgCls(n) { return n > 0 ? 'change-up' : (n < 0 ? 'change-down' : ''); }
  function upColor(n) { return n > 0 ? 'var(--up)' : (n < 0 ? 'var(--down)' : 'var(--muted)'); }

  function marketLocal(offsetUTC) {
    var d = new Date(Date.now() + offsetUTC * 3600 * 1000);
    return { day: d.getUTCDay(), h: d.getUTCHours(), m: d.getUTCMinutes(), date: d };
  }
  function usIsDst() {
    var mo = new Date().getMonth() + 1;
    return mo >= 4 && mo <= 10;
  }
  function usOffsetUTC() { return usIsDst() ? -4 : -5; }

  function lastTradeDate(offsetUTC, closeHour) {
    var t = marketLocal(offsetUTC);
    var d = new Date(t.date.getTime());
    if (t.h * 60 + t.m < closeHour * 60) d = new Date(d.getTime() - 24 * 3600 * 1000);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = new Date(d.getTime() - 24 * 3600 * 1000);
    return d;
  }
  function fmtTradeDate(d) {
    var wd = '周' + '日一二三四五六'.charAt(d.getUTCDay());
    return (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日（' + wd + '）';
  }
  function fmtHM(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }

  /* ================= 市场时段 ================= */

  function usStatus() {
    var us = marketLocal(usOffsetUTC());
    var day = us.day, m = us.h * 60 + us.m;
    if (day === 0 || day === 6) return { label: '美股周末休市', trading: false };
    if (m < 570) return { label: '美股盘前', trading: false };
    if (m < 960) return { label: '美股交易中', trading: true };
    if (m < 1020) return { label: '美股盘后', trading: false };
    return { label: '美股已收盘', trading: false };
  }
  function jpStatus() {
    var jp = marketLocal(9);
    var day = jp.day, m = jp.h * 60 + jp.m;
    if (day === 0 || day === 6) return { label: '日本周末休市', trading: false };
    if (m < 540) return { label: '日股盘前', trading: false };
    if (m < 690) return { label: '日股早盘交易中', trading: true };
    if (m < 750) return { label: '日股午间休市', trading: false };
    if (m < 900) return { label: '日股午盘交易中', trading: true };
    return { label: '日股已收盘', trading: false };
  }
  function krStatus() {
    var kr = marketLocal(9);
    var day = kr.day, m = kr.h * 60 + kr.m;
    if (day === 0 || day === 6) return { label: '韩国周末休市', trading: false };
    if (m < 540) return { label: '韩股盘前', trading: false };
    if (m < 930) return { label: '韩股交易中', trading: true };
    return { label: '韩股已收盘', trading: false };
  }

  /* ================= 行情拉取 ================= */

  function fetchEM(secids, cb) {
    var name = '__gmEmCb' + (++cbSeq);
    var s = document.createElement('script');
    var done = false;
    function finish(data) {
      if (done) return;
      done = true;
      try { delete window[name]; } catch (e) { window[name] = undefined; }
      if (s.parentNode) s.parentNode.removeChild(s);
      cb(data);
    }
    window[name] = function(data) { finish(data); };
    s.onerror = function() { finish(null); };
    s.src = 'https://push2delay.eastmoney.com/api/qt/ulist.np/get?ut=' + UT
      + '&fltt=2&invt=2&fields=' + FIELDS
      + '&secids=' + secids.join(',') + '&cb=' + name;
    document.head.appendChild(s);
    setTimeout(function() { finish(null); }, 12000);
  }

  function parseDiff(data) {
    var out = {};
    try {
      var diff = data && data.data && data.data.diff;
      if (!diff) return out;
      Object.keys(diff).forEach(function(k) {
        var it = diff[k];
        var key = it.f13 + '.' + it.f12;
        out[key] = {
          code: it.f12,
          name: it.f14,
          price: num(it.f2),
          pct: num(it.f3),
          chg: num(it.f4),
          vol: num(it.f5),
          amt: num(it.f6),
          high: num(it.f15),
          low: num(it.f16),
          open: num(it.f17),
          prev: num(it.f18)
        };
      });
    } catch (e) {}
    return out;
  }

  function fetchTencent(codes, cb) {
    var s = document.createElement('script');
    s.charset = 'GBK';
    s.src = 'https://qt.gtimg.cn/q=' + codes.join(',');
    var done = false;
    function finish(ok) {
      if (done) return;
      done = true;
      s.onload = s.onerror = null;
      if (s.parentNode) s.parentNode.removeChild(s);
      cb(ok);
    }
    s.onload = function() { finish(true); };
    s.onerror = function() { finish(false); };
    document.head.appendChild(s);
    setTimeout(function() { finish(false); }, 10000);
  }

  function parseTencent(tc) {
    try {
      var raw = window['v_' + tc];
      if (!raw || typeof raw !== 'string') return null;
      var f = raw.split('~');
      var price = parseFloat(f[3]), prev = parseFloat(f[4]);
      if (!isFinite(price) || price <= 0 || !isFinite(prev) || prev <= 0) return null;
      var q = { price: price, prev: prev, pct: (price - prev) / prev * 100 };
      var open = parseFloat(f[5]), high = parseFloat(f[33]), low = parseFloat(f[34]);
      if (isFinite(open) && open > 0) q.open = open;
      if (isFinite(high) && high > 0) q.high = high;
      if (isFinite(low) && low > 0) q.low = low;
      return q;
    } catch (e) { return null; }
  }

  /* ================= 数据刷新 ================= */

  function refreshUS(cb) {
    if (loading.us) { if (cb) cb(); return; }
    loading.us = true;
    var secids = [];
    US_INDICES.forEach(function(x) { secids.push(x.secid); });
    US_STOCKS.forEach(function(x) { secids.push(x.secid); });
    fetchEM(secids, function(data) {
      loading.us = false;
      var got = parseDiff(data);
      var count = Object.keys(got).length;
      if (count > 0) {
        for (var k in got) usData[k] = got[k];
        lastOk.us = true;
      } else {
        lastOk.us = false;
      }
      lastUpdate.us = new Date();
      renderUS();
      if (cb) cb();
    });
  }

  function refreshAsia(cb) {
    if (loading.asia) { if (cb) cb(); return; }
    loading.asia = true;
    var secids = [];
    ASIA_INDICES.forEach(function(x) { secids.push(x.secid); });
    JP_STOCKS.forEach(function(x) { secids.push(x.secid); });
    KR_STOCKS.forEach(function(x) { secids.push(x.secid); });
    fetchEM(secids, function(data) {
      loading.asia = false;
      var got = parseDiff(data);
      if (Object.keys(got).length > 0) {
        for (var k in got) asiaData[k] = got[k];
        lastOk.asia = true;
      } else {
        lastOk.asia = false;
      }
      lastUpdate.asia = new Date();
      renderAsia();
      if (cb) cb();
    });
  }

  function refreshA(cb) {
    if (loading.a) { if (cb) cb(); return; }
    loading.a = true;
    var codes = A_INDICES.map(function(x) { return x.tc; });
    fetchTencent(codes, function(ok) {
      loading.a = false;
      var any = false;
      codes.forEach(function(tc) {
        var q = parseTencent(tc);
        if (q) { aData[tc] = q; any = true; }
      });
      lastOk.a = ok && any;
      lastUpdate.a = new Date();
      if (cb) cb();
    });
  }

  /* ================= 行情取值（实时优先，快照兜底） ================= */

  function quoteOf(meta, store) {
    var q = store[meta.secid || meta.tc];
    if (q && q.price > 0 && (q.prev > 0 || q.pct !== 0)) {
      return {
        price: q.price, prev: q.prev, pct: q.pct, chg: q.chg,
        open: q.open, high: q.high, low: q.low,
        vol: q.vol, amt: q.amt, live: true
      };
    }
    var prev = meta.snapPrev || (meta.snapPrev === undefined ? meta.snapP / (1 + meta.snapC / 100) : meta.snapPrev);
    return {
      price: meta.snapP, prev: prev, pct: meta.snapC,
      chg: meta.snapP - prev,
      open: meta.snapO || 0, high: meta.snapH || 0, low: meta.snapL || 0,
      vol: meta.snapVolWan ? meta.snapVolWan * 10000 : 0,
      amt: meta.snapAmt ? meta.snapAmt * 1e8 : 0,
      live: false
    };
  }

  /* ================= K线结构分析 ================= */

  function analyzeBar(q) {
    if (!q || !q.prev || !(q.high > 0) || !(q.low > 0)) return null;
    var gap = (q.open - q.prev) / q.prev * 100;
    var amp = (q.high - q.low) / q.prev * 100;
    var range = q.high - q.low;
    var clv = range > 0 ? (q.price - q.low) / range : 0.5;
    var body = q.price - q.open;
    var upper = q.high - Math.max(q.price, q.open);
    var lower = Math.min(q.price, q.open) - q.low;
    return { gap: gap, amp: amp, clv: clv, body: body, upper: upper, lower: lower };
  }

  function pathText(a, pct) {
    if (!a) return '—';
    var t = [];
    if (a.gap > 0.4) t.push('高开' + a.gap.toFixed(1) + '%');
    else if (a.gap < -0.4) t.push('低开' + Math.abs(a.gap).toFixed(1) + '%');
    else t.push('平开');
    if (a.body > 0 && a.gap < -0.3) t.push('低开高走');
    else if (a.body < 0 && a.gap > 0.3) t.push('高开低走');
    else if (a.body > 0) t.push('震荡上行');
    else t.push('震荡回落');
    if (a.clv >= 0.75) t.push('收于日内高位');
    else if (a.clv <= 0.25) t.push('收于日内低位');
    else t.push('收盘居中');
    return t.join('，');
  }

  // 次日倾向打分：>0.5 偏多 / <-0.5 偏空 / 其余 中性震荡
  function predictScore(q) {
    var a = analyzeBar(q);
    if (!a) return 0;
    var s = 0;
    if (a.clv > 0.7) s += 1; else if (a.clv < 0.3) s -= 1;
    if (q.pct > 1) s += 0.5; else if (q.pct < -1) s -= 0.5;
    if (a.gap > 0.3 && q.pct < a.gap - 0.5) s -= 0.5;
    if (a.gap < -0.3 && q.pct > a.gap + 0.5) s += 0.5;
    var bodyAbs = Math.abs(a.body);
    if (bodyAbs > 0.0001) {
      if (a.upper > bodyAbs * 1.5) s -= 0.25;
      if (a.lower > bodyAbs * 1.5) s += 0.25;
    }
    return s;
  }

  function biasLabel(score) {
    if (score > 0.5) return { text: '偏多', cls: 'change-up' };
    if (score < -0.5) return { text: '偏空', cls: 'change-down' };
    return { text: '中性震荡', cls: '' };
  }

  function clvBar(clv) {
    var pctPos = Math.max(0, Math.min(100, Math.round(clv * 100)));
    var color = clv >= 0.7 ? 'var(--up)' : (clv <= 0.3 ? 'var(--down)' : 'var(--accent)');
    return '<div style="display:flex;align-items:center;gap:8px;">'
      + '<div style="position:relative;flex:1;min-width:70px;height:6px;background:var(--bg3);border-radius:3px;">'
      + '<div style="position:absolute;left:' + pctPos + '%;top:-3px;width:4px;height:12px;background:' + color + ';border-radius:2px;"></div>'
      + '</div>'
      + '<span style="font-size:11px;color:' + color + ';white-space:nowrap;">' + pctPos + '%</span>'
      + '</div>';
  }

  /* ================= 美股渲染 ================= */

  function renderUSStatus() {
    var pill = el('us-status-pill');
    if (pill) {
      var st = usStatus();
      var failed = lastUpdate.us && !lastOk.us;
      pill.innerHTML = '<span class="wl-status-dot"></span>' + (failed ? '行情连接失败 · 显示快照' : st.label);
      pill.className = 'wl-status-pill ' + (failed ? 'error' : (st.trading ? 'open' : 'closed'));
    }
    var t = el('us-update-time');
    if (t) {
      t.textContent = lastUpdate.us
        ? '最后更新 ' + fmtHM(lastUpdate.us)
        : '等待首次刷新…';
    }
    var hint = el('us-auto-hint');
    if (hint) hint.textContent = '每30分钟按需更新 · 非实时';
    var badge = el('us-idx-badge');
    if (badge) {
      var stt = usStatus();
      badge.textContent = lastOk.us
        ? (stt.trading ? '东财行情 · 盘中约15分钟延迟' : '东财行情 · ' + fmtTradeDate(lastTradeDate(usOffsetUTC(), 16)) + '收盘')
        : '快照 8/21';
    }
    var db = el('us-data-date');
    if (db) db.textContent = '数据时点：' + fmtTradeDate(lastTradeDate(usOffsetUTC(), 16)) + '（美东）';
  }

  function renderUSIndices() {
    var wrap = el('us-index-cards');
    if (!wrap) return;
    var html = '';
    US_INDICES.forEach(function(ix) {
      var q = quoteOf(ix, usData);
      var dir = q.pct > 0 ? 'up' : (q.pct < 0 ? 'down' : '');
      var a = analyzeBar(q);
      html += '<div class="index-card ' + dir + '">'
        + '<div class="index-name">' + ix.name + '</div>'
        + '<div class="index-value" style="font-size:22px;">' + fmtInt(q.price) + '</div>'
        + '<div class="index-change ' + dir + '">' + fmtPct(q.pct) + ' (' + (q.chg >= 0 ? '+' : '') + fmtInt(q.chg) + ')</div>'
        + '<div class="index-meta"><span>振幅 ' + (a ? a.amp.toFixed(2) + '%' : '—') + '</span><span>' + ix.code + '</span></div>'
        + '</div>';
    });
    wrap.innerHTML = html;
  }

  function renderUSStocks() {
    var tbody = el('us-stock-tbody');
    if (!tbody) return;
    var list = US_STOCKS.map(function(s) {
      var q = quoteOf(s, usData);
      return { meta: s, q: q };
    });
    list.sort(function(a, b) { return b.q.pct - a.q.pct; });
    var html = '';
    list.forEach(function(it) {
      var s = it.meta, q = it.q, cls = chgCls(q.pct);
      var a = analyzeBar(q);
      var amt = q.amt > 0 ? (q.amt / 1e8).toFixed(1) : (s.snapAmt ? s.snapAmt.toFixed(1) : '—');
      html += '<tr>'
        + '<td><span class="stock-name">' + s.name + '</span></td>'
        + '<td><span class="stock-code">' + s.code + '</span></td>'
        + '<td style="font-weight:600">' + q.price.toFixed(2) + '</td>'
        + '<td class="' + cls + '" style="font-weight:600">' + fmtPct(q.pct) + '</td>'
        + '<td>' + (q.open ? q.open.toFixed(2) : '—') + '</td>'
        + '<td>' + (q.high ? q.high.toFixed(2) : '—') + '</td>'
        + '<td>' + (q.low ? q.low.toFixed(2) : '—') + '</td>'
        + '<td>' + (a ? a.amp.toFixed(2) + '%' : '—') + '</td>'
        + '<td>' + amt + '</td>'
        + '<td><span style="font-size:11px;color:var(--muted);border:1px solid var(--rule);padding:1px 8px;border-radius:999px;white-space:nowrap;">' + s.group + '</span></td>'
        + '</tr>';
    });
    tbody.innerHTML = html;
  }

  function usGroupAvg(group) {
    var arr = US_STOCKS.filter(function(s) { return s.group === group; });
    if (!arr.length) return null;
    var sum = 0;
    arr.forEach(function(s) { sum += quoteOf(s, usData).pct; });
    return sum / arr.length;
  }

  function renderUSRecap() {
    var tbody = el('us-recap-tbody');
    if (tbody) {
      var html = '';
      US_INDICES.forEach(function(ix) {
        var q = quoteOf(ix, usData);
        var a = analyzeBar(q);
        var score = predictScore(q);
        var bias = biasLabel(score);
        html += '<tr>'
          + '<td><span class="stock-name">' + ix.name + '</span></td>'
          + '<td style="font-weight:600">' + fmtInt(q.price) + '</td>'
          + '<td class="' + chgCls(q.pct) + '" style="font-weight:600">' + fmtPct(q.pct) + '</td>'
          + '<td>' + (a ? a.amp.toFixed(2) + '%' : '—') + '</td>'
          + '<td style="font-size:12px;color:var(--muted);">' + pathText(a, q.pct) + '</td>'
          + '<td style="min-width:110px;">' + (a ? clvBar(a.clv) : '—') + '</td>'
          + '<td class="' + bias.cls + '" style="font-weight:600">' + bias.text + '</td>'
          + '</tr>';
      });
      tbody.innerHTML = html;
    }
    var box = el('us-recap-text');
    if (box) {
      var dj = quoteOf(US_INDICES[0], usData);
      var ndx = quoteOf(US_INDICES[1], usData);
      var sox = quoteOf(US_INDICES[3], usData);
      var ad = analyzeBar(dj), an = analyzeBar(ndx), asx = analyzeBar(sox);
      var parts = [];
      // 1. 指数分化
      var spread = sox.pct - ndx.pct;
      if (spread < -0.6) parts.push('隔夜美股呈现<strong style="color:var(--ink);">"大盘强、半导体弱"</strong>的分化格局：费半' + fmtPct(sox.pct) + '明显跑输纳指' + fmtPct(ndx.pct) + '，科技内部资金从硬科技向平台大盘轮动');
      else if (spread > 0.6) parts.push('隔夜美股呈现<strong style="color:var(--ink);">"半导体领跑"</strong>的进攻格局：费半' + fmtPct(sox.pct) + '强于纳指' + fmtPct(ndx.pct) + '，AI硬件链景气度占优');
      else parts.push('隔夜美股大盘与半导体方向一致，费半' + fmtPct(sox.pct) + '与纳指' + fmtPct(ndx.pct) + '分化不大');
      // 2. 关键指数尾盘结构
      if (asx && asx.clv <= 0.35) parts.push('费半冲高回落、收在日内' + Math.round(asx.clv * 100) + '%分位，尾盘抛压明显（最高' + fmtInt(sox.high) + ' → 收' + fmtInt(sox.price) + '）');
      if (asx && asx.clv >= 0.65) parts.push('费半尾盘强势，收在日内' + Math.round(asx.clv * 100) + '%分位，短线承接有力');
      if (ad && ad.clv >= 0.75) parts.push('道指' + fmtPct(dj.pct) + '收于日内高位，传统权重动能扎实');
      if (an && an.clv <= 0.4) parts.push('纳指虽然收涨但收盘位置仅' + Math.round(an.clv * 100) + '%分位，尾盘上攻乏力');
      // 3. 分组表现
      var groups = [['平台大盘', '平台大盘（苹果/微软/谷歌/特斯拉）'], ['AI芯片', 'AI芯片（英伟达/博通/AMD）'], ['光模块/光器件', '光模块链（AAOI/LITE/康宁）']];
      var gTxt = [];
      groups.forEach(function(g) {
        var v = usGroupAvg(g[0]);
        if (v !== null) gTxt.push(g[1] + ' <span class="' + chgCls(v) + '" style="font-weight:600">' + fmtPct(v) + '</span>');
      });
      if (gTxt.length) parts.push('分组看：' + gTxt.join('；'));
      // 4. 个股涨跌榜
      var arr = US_STOCKS.map(function(s) { return { n: s.name, p: quoteOf(s, usData).pct }; });
      arr.sort(function(a, b) { return b.p - a.p; });
      var top = arr[0], bottom = arr[arr.length - 1];
      parts.push('个股层面：<span style="color:var(--up);">' + top.n + ' ' + fmtPct(top.p) + '</span>领涨、<span style="color:var(--down);">' + bottom.n + ' ' + fmtPct(bottom.p) + '</span>垫底');
      box.innerHTML = parts.map(function(p, i) { return '<p style="margin-bottom:8px;">' + (i + 1) + '. ' + p + '。</p>'; }).join('');
    }
  }

  function renderUSPrediction() {
    var box = el('us-prediction');
    if (!box) return;
    // 综合评分（偏科技权重）
    var scores = [
      { w: 0.30, s: predictScore(quoteOf(US_INDICES[3], usData)) },
      { w: 0.25, s: predictScore(quoteOf(US_INDICES[1], usData)) },
      { w: 0.25, s: predictScore(quoteOf(US_INDICES[2], usData)) },
      { w: 0.20, s: predictScore(quoteOf(US_INDICES[0], usData)) }
    ];
    var total = 0;
    scores.forEach(function(x) { total += x.w * x.s; });
    var sox = quoteOf(US_INDICES[3], usData);
    var ndx = quoteOf(US_INDICES[1], usData);
    var aiAvg = usGroupAvg('AI芯片');
    var optAvg = usGroupAvg('光模块/光器件');
    var mu = quoteOf(US_STOCKS.find(function(s) { return s.code === 'MU'; }), usData);

    var bias = biasLabel(total);
    var html = '';

    html += '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;flex-wrap:wrap;">'
      + '<span style="font-size:13px;color:var(--muted);">综合信号评分（费半0.3/纳指0.25/纳1000.25/道指0.2加权）：</span>'
      + '<span class="' + bias.cls + '" style="font-size:18px;font-weight:700;">' + total.toFixed(2) + ' · ' + bias.text + '</span>'
      + '</div>';

    var scenarios = [];
    if (total > 0.5) {
      scenarios.push(['情景A · 延续上行（概率偏高）', 'var(--up)', 'rgba(239,68,68,0.06)',
        '收盘结构强（多数指数收于日内高位），隔夜动能有望延续到下一交易日。若下一交易日费半高开且半小时站稳，A股半导体链（芯片ETF、兴森科技、存储自选股）开盘大概率高开联动，可按既定做T计划在冲高时先兑现部分。']);
    } else if (total < -0.5) {
      scenarios.push(['情景A · 承压下行（概率偏高）', 'var(--down)', 'rgba(34,197,94,0.06)',
        '收盘结构弱（尾盘抛压、收盘位置低），隔夜美股走弱将压制下一交易日A股科技股开盘情绪。芯片ETF、兴森科技若低开跌破防守位，按止损纪律执行不犹豫；低开过深反而可能是错杀低吸机会，重点看费半期货与旭光电子的相对强弱。']);
    } else {
      scenarios.push(['情景A · 区间震荡（概率最大）', 'var(--accent)', 'rgba(245,158,11,0.06)',
        '收盘结构多空交织，指数涨跌互现且收盘位置分化，隔夜方向指引不强。下一交易日A股科技链大概率平开震荡，以个股关键位做T为主，不追高不杀跌。']);
    }
    scenarios.push(['情景B · 结构分化', 'var(--accent2)', 'rgba(59,130,246,0.06)',
      '重点观察费半与纳指的剪刀差：当前费半' + fmtPct(sox.pct) + ' vs 纳指' + fmtPct(ndx.pct) + (sox.pct - ndx.pct < -0.5 ? '，半导体明显跑输——若下一交易日收敛（费半补涨），A股半导体链存在修复性机会；若继续走阔，警惕AI硬件高位股补跌' : '，两者基本同步——板块内部按个股节奏操作即可') + '。']);
    var optTxt = optAvg !== null ? '，光模块链（AAOI/LITE/康宁）' + fmtPct(optAvg) : '';
    scenarios.push(['情景C · 板块轮动关注点', 'var(--muted)', 'rgba(100,116,139,0.06)',
      'AI芯片组隔夜' + (aiAvg !== null ? fmtPct(aiAvg) : '—') + optTxt + '，美光（存储风向标）' + fmtPct(mu.pct) + '。存储链强弱直接影响A股存储自选股（兆易创新/江波龙/佰维存储/长鑫科技）次日开盘，光模块链强弱映射中际旭创/新易盛/天孚通信方向。']);

    scenarios.forEach(function(sc) {
      html += '<div style="padding:14px 16px;background:' + sc[2] + ';border:1px solid rgba(100,116,139,0.25);border-left:3px solid ' + sc[1] + ';border-radius:10px;margin-bottom:12px;">'
        + '<div style="font-size:13px;font-weight:700;color:' + sc[1] + ';margin-bottom:6px;">' + sc[0] + '</div>'
        + '<div style="font-size:12.5px;color:var(--muted);line-height:1.8;">' + sc[3] + '</div>'
        + '</div>';
    });

    html += '<div style="font-size:12px;color:var(--muted);line-height:1.8;">'
      + '预判说明：倾向评分基于当根日K的收盘位置、跳空方向、影线结构与涨跌幅的规则化加权，为概率提示而非确定性结论；隔夜中概/美股期货、盘前宏观数据（CPI/非农/议息）与龙头财报都可能改变路径，开盘前请结合「盘前研判」页的上证关键位（3888支撑/3912压力）综合执行。'
      + '</div>';

    box.innerHTML = html;
  }

  function renderUS() {
    renderUSStatus();
    renderUSIndices();
    renderUSStocks();
    renderUSRecap();
    renderUSPrediction();
  }

  /* ================= 日韩渲染 ================= */

  function renderAsiaStatus() {
    var jp = jpStatus(), kr = krStatus();
    var pill = el('as-status-pill');
    if (pill) {
      var failed = lastUpdate.asia && !lastOk.asia;
      var label = jp.trading || kr.trading ? '亚太交易中' : (jp.label + ' · ' + kr.label);
      pill.innerHTML = '<span class="wl-status-dot"></span>' + (failed ? '行情连接失败 · 显示快照' : label);
      pill.className = 'wl-status-pill ' + (failed ? 'error' : (jp.trading || kr.trading ? 'open' : 'closed'));
    }
    var t = el('as-update-time');
    if (t) t.textContent = lastUpdate.asia ? '最后更新 ' + fmtHM(lastUpdate.asia) : '等待首次刷新…';
    var hint = el('as-auto-hint');
    if (hint) hint.textContent = '每30分钟更新一次 · 非实时';
    var badge = el('as-idx-badge');
    if (badge) badge.textContent = lastOk.asia ? '东财行情 · ' + fmtTradeDate(lastTradeDate(9, 15)) + '收盘' : '快照 8/21';
    var db = el('as-data-date');
    if (db) db.textContent = '数据时点：' + fmtTradeDate(lastTradeDate(9, 15)) + '（东京/首尔）';
  }

  function renderAsiaIndices() {
    var wrap = el('as-index-cards');
    if (!wrap) return;
    var html = '';
    ASIA_INDICES.forEach(function(ix) {
      var q = quoteOf(ix, asiaData);
      var dir = q.pct > 0 ? 'up' : (q.pct < 0 ? 'down' : '');
      var a = analyzeBar(q);
      html += '<div class="index-card ' + dir + '">'
        + '<div class="index-name">' + ix.name + '</div>'
        + '<div class="index-value" style="font-size:22px;">' + fmtInt(q.price) + '</div>'
        + '<div class="index-change ' + dir + '">' + fmtPct(q.pct) + ' (' + (q.chg >= 0 ? '+' : '') + fmtInt(q.chg) + ')</div>'
        + '<div class="index-meta"><span>振幅 ' + (a ? a.amp.toFixed(2) + '%' : '—') + '</span><span>' + ix.market + '</span></div>'
        + '</div>';
    });
    wrap.innerHTML = html;
  }

  function renderAsiaStocks(tbodyId, list, store, currency) {
    var tbody = el(tbodyId);
    if (!tbody) return;
    var arr = list.map(function(s) { return { meta: s, q: quoteOf(s, store) }; });
    arr.sort(function(a, b) { return b.q.pct - a.q.pct; });
    var html = '';
    arr.forEach(function(it) {
      var s = it.meta, q = it.q, cls = chgCls(q.pct);
      var a = analyzeBar(q);
      var volWan = q.vol > 0 ? (q.vol / 10000).toFixed(1) : (s.snapVolWan ? s.snapVolWan.toFixed(1) : '—');
      html += '<tr>'
        + '<td><span class="stock-name">' + s.name + '</span></td>'
        + '<td><span class="stock-code">' + s.code + '</span></td>'
        + '<td style="font-weight:600">' + fmtInt(q.price) + '</td>'
        + '<td class="' + cls + '" style="font-weight:600">' + fmtPct(q.pct) + '</td>'
        + '<td>' + (q.open ? fmtInt(q.open) : '—') + '</td>'
        + '<td>' + (q.high ? fmtInt(q.high) : '—') + '</td>'
        + '<td>' + (q.low ? fmtInt(q.low) : '—') + '</td>'
        + '<td>' + (a ? a.amp.toFixed(2) + '%' : '—') + '</td>'
        + '<td>' + volWan + '</td>'
        + '<td><span style="font-size:11px;color:var(--muted);border:1px solid var(--rule);padding:1px 8px;border-radius:999px;white-space:nowrap;">' + s.group + '</span></td>'
        + '</tr>';
    });
    tbody.innerHTML = html;
  }

  function asiaGroupAvg(list, group) {
    var arr = list.filter(function(s) { return s.group === group; });
    if (!arr.length) return null;
    var sum = 0;
    arr.forEach(function(s) { sum += quoteOf(s, asiaData).pct; });
    return sum / arr.length;
  }

  function renderAsiaSummary() {
    var box = el('as-summary');
    if (!box) return;
    var n225 = quoteOf(ASIA_INDICES[0], asiaData);
    var ks11 = quoteOf(ASIA_INDICES[1], asiaData);
    var samsung = quoteOf(KR_STOCKS[0], asiaData);
    var hynix = quoteOf(KR_STOCKS[1], asiaData);
    var jpSemiAvg = asiaGroupAvg(JP_STOCKS, '半导体设备');
    var parts = [];

    // 1. 两大指数方向
    if (n225.pct < 0 && ks11.pct > 0) {
      parts.push('亚太两大市场<strong style="color:var(--ink);">涨跌互现</strong>：日经225 ' + fmtPct(n225.pct) + '回调，KOSPI ' + fmtPct(ks11.pct) + '上涨，韩股受益于半导体权重（三星/SK海力士占KOSPI权重高）的独立行情');
    } else if (n225.pct > 0 && ks11.pct < 0) {
      parts.push('亚太分化：日经225 ' + fmtPct(n225.pct) + '走强，KOSPI ' + fmtPct(ks11.pct) + '走弱');
    } else {
      parts.push('亚太方向一致：日经225 ' + fmtPct(n225.pct) + '，KOSPI ' + fmtPct(ks11.pct));
    }

    // 2. 存储双雄
    parts.push('<strong style="color:var(--ink);">存储双雄</strong>：三星电子 ' + fmtPct(samsung.pct) + '、SK海力士 ' + fmtPct(hynix.pct) + (samsung.pct > 1 && hynix.pct > 1
      ? '——双双大涨，全球存储涨价周期逻辑继续强化，直接利好A股存储链自选股（兆易创新/江波龙/佰维存储/长鑫科技）次日表现'
      : (samsung.pct < 0 && hynix.pct < 0 ? '——同步回调，存储链短线情绪转弱' : '——涨跌不一，存储链方向指引中性')));

    // 3. 日本半导体设备
    if (jpSemiAvg !== null) {
      parts.push('<strong style="color:var(--ink);">日本半导体设备链</strong>（东京电子/爱德万/DISCO）平均 ' + fmtPct(jpSemiAvg) + (jpSemiAvg > 0.5
        ? '——设备商景气上行映射全球晶圆厂扩产持续，利好A股设备链（北方华创/中微公司）与材料链'
        : '——设备链表现平淡，对A股设备链指引中性'));
    }

    // 4. 对A股的前瞻意义
    parts.push('<strong style="color:var(--accent);">前瞻意义</strong>：日韩半导体收盘领先A股一个交易日，当日存储/设备链收盘强弱可作为次日A股半导体与PCB链开盘情绪的前瞻参考；结合美股页费半表现共振判断，方向一致时信号可靠性更高');

    box.innerHTML = parts.map(function(p) { return '<p style="margin-bottom:8px;">' + p + '。</p>'; }).join('');
  }

  function renderAsia() {
    renderAsiaStatus();
    renderAsiaIndices();
    renderAsiaStocks('jp-stock-tbody', JP_STOCKS, asiaData, 'JPY');
    renderAsiaStocks('kr-stock-tbody', KR_STOCKS, asiaData, 'KRW');
    renderAsiaSummary();
  }

  /* ================= 全球复盘 ================= */

  function aQuoteOf(meta) {
    if (window.Watchlist && window.Watchlist.getQuote) {
      var q = window.Watchlist.getQuote(meta.tc);
      if (q && q.price > 0 && q.prev > 0) {
        return { price: q.price, prev: q.prev, pct: (q.price - q.prev) / q.prev * 100, open: q.open, high: q.high, low: q.low };
      }
    }
    if (aData[meta.tc] && aData[meta.tc].price > 0) return aData[meta.tc];
    return {
      price: meta.snapP, prev: meta.snapPrev || meta.snapP / (1 + meta.snapC / 100), pct: meta.snapC,
      open: meta.snapO || 0, high: meta.snapH || 0, low: meta.snapL || 0
    };
  }

  function globalReady() {
    // 美股收盘后（北京时间约04:00/05:00后）复盘数据完整
    var st = usStatus();
    return !st.trading;
  }

  function renderGlobal() {
    var box = el('gr-content');
    if (!box) return;

    var sh = aQuoteOf(A_INDICES[0]);
    var sz = aQuoteOf(A_INDICES[1]);
    var cyb = aQuoteOf(A_INDICES[2]);
    var n225 = quoteOf(ASIA_INDICES[0], asiaData);
    var ks11 = quoteOf(ASIA_INDICES[1], asiaData);
    var dj = quoteOf(US_INDICES[0], usData);
    var ndx = quoteOf(US_INDICES[1], usData);
    var ndx100 = quoteOf(US_INDICES[2], usData);
    var sox = quoteOf(US_INDICES[3], usData);

    var all = [
      { n: '上证指数', q: sh, mkt: 'A股' },
      { n: '深证成指', q: sz, mkt: 'A股' },
      { n: '创业板指', q: cyb, mkt: 'A股' },
      { n: '日经225', q: n225, mkt: '日本' },
      { n: '韩国KOSPI', q: ks11, mkt: '韩国' },
      { n: '道琼斯', q: dj, mkt: '美股' },
      { n: '纳斯达克', q: ndx, mkt: '美股' },
      { n: '纳斯达克100', q: ndx100, mkt: '美股' },
      { n: '费城半导体', q: sox, mkt: '美股' }
    ];
    var upCount = all.filter(function(x) { return x.q.pct > 0; }).length;
    var downCount = all.filter(function(x) { return x.q.pct < 0; }).length;

    var ready = globalReady();
    var tradeDate = fmtTradeDate(lastTradeDate(9, 15));

    var html = '';

    /* ---- 横幅 ---- */
    var riskOn = upCount >= 6;
    var riskOff = downCount >= 6;
    var riskTxt = riskOn ? '全球风险偏好回升' : (riskOff ? '全球风险偏好收缩' : '全球市场涨跌互现、情绪中性');
    var techAvg = (sox.pct + n225.pct + ks11.pct) / 3;
    html += '<div class="recap-banner">'
      + '<div>'
      + '<div class="recap-headline">' + tradeDate + '全球复盘：' + riskTxt + '</div>'
      + '<div class="recap-desc">'
      + '亚太先行：日经225 ' + fmtPct(n225.pct) + '、KOSPI ' + fmtPct(ks11.pct) + '；美股接力：道指 ' + fmtPct(dj.pct) + '、纳指 ' + fmtPct(ndx.pct) + '、费半 ' + fmtPct(sox.pct) + '。A股当日上证 ' + fmtPct(sh.pct) + '、创业板 ' + fmtPct(cyb.pct) + '。'
      + (ready ? '全球主要市场均已收盘，以下为完整复盘。' : '<strong style="color:var(--accent);">美股尚未收盘，当前为部分复盘，美股收盘后（北京时间约04:00/05:00）数据自动完整。</strong>')
      + '</div>'
      + '</div>'
      + '<div class="recap-stats">'
      + '<div class="recap-stat-row"><span class="recap-stat-label">全球上涨/下跌</span><span class="recap-stat-value"><span style="color:var(--up)">' + upCount + '涨</span> / <span style="color:var(--down)">' + downCount + '跌</span></span></div>'
      + '<div class="recap-stat-row"><span class="recap-stat-label">科技链均值</span><span class="recap-stat-value" style="color:' + upColor(techAvg) + '">' + fmtPct(techAvg) + '</span></div>'
      + '<div class="recap-stat-row"><span class="recap-stat-label">费半（科技风向标）</span><span class="recap-stat-value" style="color:' + upColor(sox.pct) + '">' + fmtPct(sox.pct) + '</span></div>'
      + '<div class="recap-stat-row"><span class="recap-stat-label">数据状态</span><span class="recap-stat-value">' + (ready ? '全部收盘 · 完整' : '美股交易中 · 部分') + '</span></div>'
      + '</div>'
      + '</div>';

    /* ---- 全球表现总览表 ---- */
    html += '<div class="card" style="margin-bottom:24px;">'
      + '<div class="card-title">全球市场表现总览<span class="badge">' + tradeDate + ' · 9大指数</span></div>'
      + '<div class="table-wrap"><table>'
      + '<thead><tr><th>市场</th><th>指数</th><th>收盘</th><th>涨跌幅</th><th>振幅</th><th>收盘位置</th></tr></thead><tbody>';
    all.forEach(function(x) {
      var a = analyzeBar(x.q);
      html += '<tr>'
        + '<td><span style="font-size:11px;color:var(--muted);border:1px solid var(--rule);padding:1px 8px;border-radius:999px;">' + x.mkt + '</span></td>'
        + '<td><span class="stock-name">' + x.n + '</span></td>'
        + '<td style="font-weight:600">' + fmtInt(x.q.price) + '</td>'
        + '<td class="' + chgCls(x.q.pct) + '" style="font-weight:600">' + fmtPct(x.q.pct) + '</td>'
        + '<td>' + (a ? a.amp.toFixed(2) + '%' : '—') + '</td>'
        + '<td style="min-width:110px;">' + (a ? clvBar(a.clv) : '—') + '</td>'
        + '</tr>';
    });
    html += '</tbody></table></div>'
      + '<div style="margin-top:12px;font-size:12px;color:var(--muted);line-height:1.8;">按交易时序排列：A股（15:00收盘）→ 日韩（15:00/14:30北京时间收盘）→ 美股（次日凌晨收盘）。振幅与收盘位置反映各市场当日的波动结构与尾盘强弱。</div>'
      + '</div>';

    /* ---- 科技链传导分析 ---- */
    var samsung = quoteOf(KR_STOCKS[0], asiaData);
    var hynix = quoteOf(KR_STOCKS[1], asiaData);
    var tel = quoteOf(JP_STOCKS[0], asiaData);
    var adv = quoteOf(JP_STOCKS[1], asiaData);
    var mu = quoteOf(US_STOCKS.find(function(s) { return s.code === 'MU'; }), usData);
    var nvda = quoteOf(US_STOCKS.find(function(s) { return s.code === 'NVDA'; }), usData);
    var optAvg = usGroupAvg('光模块/光器件');
    var storageAvg = (mu.pct + samsung.pct + hynix.pct) / 3;
    var equipAvg = (tel.pct + adv.pct) / 2;

    function chainRow(name, nodes, note) {
      var nodeHtml = nodes.map(function(nd) {
        return '<span style="display:inline-block;margin:2px 4px;padding:2px 10px;border-radius:8px;background:var(--bg3);font-size:12px;">' + nd[0] + ' <span class="' + chgCls(nd[1]) + '" style="font-weight:700;">' + fmtPct(nd[1]) + '</span></span>';
      }).join('');
      var avg = nodes.reduce(function(s, nd) { return s + nd[1]; }, 0) / nodes.length;
      return '<div style="padding:14px 16px;background:var(--bg3);border-radius:10px;margin-bottom:12px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">'
        + '<span style="font-size:13px;font-weight:700;">' + name + '</span>'
        + '<span class="' + chgCls(avg) + '" style="font-weight:700;">链均值 ' + fmtPct(avg) + '</span>'
        + '</div>'
        + '<div style="margin-bottom:8px;">' + nodeHtml + '</div>'
        + '<div style="font-size:12px;color:var(--muted);line-height:1.7;">' + note(avg) + '</div>'
        + '</div>';
    }

    html += '<div class="card" style="margin-bottom:24px;">'
      + '<div class="card-title">全球科技链传导分析<span class="badge">跨市场共振</span></div>'
      + chainRow('存储链', [['美光', mu.pct], ['三星电子', samsung.pct], ['SK海力士', hynix.pct]], function(avg) {
        return avg > 1 ? '全球存储三强共振大涨，DRAM/NAND涨价逻辑强化——次日A股存储自选股（兆易创新/江波龙/佰维存储/长鑫科技）高开概率大，注意兑现节奏'
          : (avg < -1 ? '全球存储链同步走弱，涨价逻辑短线受质疑，A股存储股谨慎追高'
          : '存储链方向中性，按个股关键位操作');
      })
      + chainRow('半导体设备链', [['东京电子', tel.pct], ['爱德万测试', adv.pct]], function(avg) {
        return avg > 0.5 ? '日本设备商走强映射晶圆厂扩产持续，利好A股设备/材料链（北方华创/中微公司/雅克科技），也间接支撑旭光电子所属的国产替代逻辑'
          : '设备链表现平淡，扩产预期暂无增量信号';
      })
      + chainRow('AI算力/光模块链', [['英伟达', nvda.pct], ['费半', sox.pct], ['光模块组', optAvg !== null ? optAvg : 0]], function(avg) {
        return avg > 0.5 ? 'AI算力链全球共振偏多，光模块（中际旭创/新易盛/天孚通信）与PCB（兴森科技/沪电股份）次日有望联动，持仓的兴森科技关注反弹力度'
          : (avg < -0.5 ? 'AI算力链隔夜走弱，A股光模块/PCB链开盘承压，兴森科技若低开不破防守位可持有观察，破位按纪律执行'
          : 'AI算力链方向中性，对A股科技链指引有限');
      })
      + '<div style="font-size:12px;color:var(--muted);line-height:1.8;">传导逻辑：美股费半与AI龙头定价全球半导体景气 → 日韩存储/设备股验证产业链景气（三星财报与稼动率、东京电子订单）→ A股半导体/PCB/光模块次日开盘定价。三个市场同向共振时，方向信号可靠性最高。</div>'
      + '</div>';

    /* ---- 持仓全球视角 ---- */
    var aiAvg = usGroupAvg('AI芯片');
    function holdRow(name, mapping, signal, advice) {
      return '<tr>'
        + '<td><span class="stock-name">' + name + '</span></td>'
        + '<td style="font-size:12px;color:var(--muted);">' + mapping + '</td>'
        + '<td class="' + chgCls(signal) + '" style="font-weight:600;">' + fmtPct(signal) + '</td>'
        + '<td style="font-size:12px;color:var(--ink);">' + advice + '</td>'
        + '</tr>';
    }
    html += '<div class="card" style="margin-bottom:24px;">'
      + '<div class="card-title">我的持仓 · 全球视角映射<span class="badge">4只持仓</span></div>'
      + '<div class="table-wrap"><table>'
      + '<thead><tr><th>持仓</th><th>全球映射标的</th><th>隔夜信号</th><th>操作含义</th></tr></thead><tbody>'
      + holdRow('旭光电子', '国内半导体设备/材料链 ← 东京电子/爱德万/信越化学', equipAvg,
        equipAvg > 0.5 ? '设备链景气向上，国产替代情绪有支撑，按盘前研判的40-42减仓区执行' : '外围设备链指引中性，按37.17防守位与关键位操作')
      + holdRow('兴森科技', 'PCB/AI硬件 ← AI芯片组（英伟达/博通/AMD）+ 费半', aiAvg !== null ? aiAvg : 0,
        aiAvg !== null && aiAvg > 0.5 ? 'AI硬件链偏暖，反弹看35元压力，接近可减仓降套牢仓位' : 'AI链指引中性偏弱，33-34支撑区纪律持有，破位止损')
      + holdRow('芯片ETF', '费半 + 三星电子 + SK海力士', (sox.pct + samsung.pct + hynix.pct) / 3,
        sox.pct + samsung.pct + hynix.pct > 0.5 ? '全球半导体共振偏多，ETF反弹可期，但-12.4%深套仓位以时间换空间' : '全球半导体方向不明，ETF继续持有等待行业右侧信号')
      + holdRow('5GETF', '光模块链（AAOI/LITE/康宁）+ 纳指', optAvg !== null ? (optAvg + ndx.pct) / 2 : ndx.pct,
        optAvg !== null && (optAvg + ndx.pct) / 2 > 0.5 ? '通信/光模块链偏暖，ETF有望跟随反弹' : '外围通信链指引中性，持有为主不加仓')
      + '</tbody></table></div>'
      + '<div style="margin-top:12px;font-size:12px;color:var(--muted);line-height:1.8;">映射规则：每只持仓按其产业链对应的全球标的计算隔夜信号；信号为正代表外围环境偏暖。仓位决策仍以「盘前研判」页的个股关键位与止损纪律为准，外围信号只影响开盘预期与做T节奏。</div>'
      + '</div>';

    /* ---- 明日关注 ---- */
    var usScore = predictScore(dj) * 0.2 + predictScore(ndx) * 0.25 + predictScore(ndx100) * 0.25 + predictScore(sox) * 0.3;
    var techChain = (sox.pct + storageAvg + equipAvg) / 3;
    var focus = [];
    focus.push('<strong>1. 隔夜外围环境：</strong>美股综合信号 <span class="' + biasLabel(usScore).cls + '" style="font-weight:700;">' + usScore.toFixed(2) + '（' + biasLabel(usScore).text + '）</span>，全球科技链均值 <span class="' + chgCls(techChain) + '" style="font-weight:700;">' + fmtPct(techChain) + '</span>——'
      + (usScore > 0.5 && techChain > 0 ? '外围偏暖且科技链共振，A股科技持仓高开概率大，重点执行「冲高减仓/做T」既定计划，不因高开追买'
        : (usScore < -0.5 || techChain < -1 ? '外围偏弱，A股科技链低开概率大：触发止损线的持仓坚决执行；低开不破关键支撑（上证3888）可观察承接'
        : '外围指引中性，A股大概率按自身节奏运行，按区间震荡预案做T为主')));
    focus.push('<strong>2. 上证关键位：</strong>压力3912→3940→3968-3985，支撑3888→3864→3815-3822；创业板站稳3563则科技持仓整体转强');
    focus.push('<strong>3. 半导体链观察：</strong>费半' + fmtPct(sox.pct) + '与存储链' + fmtPct(storageAvg) + (Math.abs(sox.pct - storageAvg) < 1 ? '方向一致，共振信号可靠' : '出现背离，注意板块内部轮动而非全面行情'));
    focus.push('<strong>4. 账户纪律：</strong>当前仓位91.1%偏高、可用资金仅1,506元——任何外围利好首先用于「降仓位」而非加仓；减仓 > 做T > 新买入。');

    html += '<div class="card">'
      + '<div class="card-title">下一交易日关注要点<span class="badge">' + tradeDate + '收盘后生成</span></div>'
      + '<div style="font-size:13px;color:var(--ink);line-height:2;">'
      + focus.map(function(f) { return '<p style="margin-bottom:6px;">' + f + '</p>'; }).join('')
      + '</div>'
      + '<div style="margin-top:12px;font-size:12px;color:var(--muted);line-height:1.8;">全球复盘在美股收盘后（北京时间约04:00/05:00）数据完整；次日开盘前请结合「盘前研判」页的实时关键位监控执行。本页分析为规则化生成，不构成投资建议。</div>'
      + '</div>';

    box.innerHTML = html;
  }

  /* ================= 调度 ================= */

  function stale(which) {
    var t = lastUpdate[which];
    return !t || Date.now() - t.getTime() > REFRESH_MS;
  }

  function activeSection() {
    var s = document.querySelector('.section.active');
    return s ? s.id : '';
  }

  function maybeRefresh(kind) {
    if (kind === 'us') {
      if (stale('us')) refreshUS();
    } else if (kind === 'asia') {
      if (stale('asia')) refreshAsia();
    } else if (kind === 'global') {
      var need = false;
      if (stale('us')) { refreshUS(); need = true; }
      if (stale('asia')) { refreshAsia(); need = true; }
      if (stale('a')) { refreshA(); need = true; }
      if (!need) renderGlobal();
      else setTimeout(renderGlobal, 3000);
    }
  }

  function onShow(tab) {
    if (tab === 'usmarket') maybeRefresh('us');
    else if (tab === 'asianmarket') maybeRefresh('asia');
    else if (tab === 'globalrecap') maybeRefresh('global');
  }

  var timer = null;
  function scheduleNext() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function() {
      if (!document.hidden) {
        var id = activeSection();
        if (id === 'section-usmarket') maybeRefresh('us');
        else if (id === 'section-asianmarket') maybeRefresh('asia');
        else if (id === 'section-globalrecap') maybeRefresh('global');
      }
      scheduleNext();
    }, 60 * 1000);
  }

  function init() {
    renderUS();
    renderAsia();
    refreshUS();
    refreshAsia();
    refreshA();
    scheduleNext();
  }

  window.GlobalMarket = {
    onShow: onShow,
    refresh: function(kind) { maybeRefresh(kind); },
    renderGlobal: renderGlobal
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
