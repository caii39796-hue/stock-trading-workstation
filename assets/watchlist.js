/* ==================================================================
   自选股实时行情 + 持仓实时估值
   数据源：腾讯公开行情接口 qt.gtimg.cn（免费、约1秒延迟）
   刷新策略：打开页面即拉取最新快照；交易日 9:30-11:30 / 13:00-15:00
            自选股/持仓页每1秒自动刷新（其他页签15秒）；非交易时段显示最后快照
   ================================================================== */
(function() {
  'use strict';

  var FAST_MS = 1000;
  var SLOW_MS = 15000;
  var SNAPSHOT_DATE = '8/21';
  var INIT_CAPITAL = 20540.70;
  var CASH = 4909.14;

  var GROUPS = [
    { id: 'all', name: '全部' },
    { id: 'optical', name: '光模块/CPO' },
    { id: 'storage', name: '存储芯片' },
    { id: 'wafer', name: '晶圆/芯片' },
    { id: 'pcb', name: 'PCB产业链' },
    { id: 'ai', name: 'AI应用' },
    { id: 'metal', name: '钨钼小金属' },
    { id: 'software', name: '工业软件' }
  ];

  var STOCKS = [
    { tc: 'sz300308', name: '中际旭创', code: '300308', group: 'optical', snapP: 943.00, snapC: 4.29 },
    { tc: 'sz300502', name: '新易盛', code: '300502', group: 'optical', snapP: 442.00, snapC: 6.76 },
    { tc: 'sz300394', name: '天孚通信', code: '300394', group: 'optical', snapP: 273.08, snapC: -1.15 },
    { tc: 'sz300570', name: '太辰光', code: '300570', group: 'optical', snapP: 214.46, snapC: 0.50 },
    { tc: 'sh688498', name: '源杰科技', code: '688498', group: 'optical', snapP: 1587.00, snapC: 2.72 },
    { tc: 'sz002281', name: '光迅科技', code: '002281', group: 'optical', snapP: 178.58, snapC: 3.14 },
    { tc: 'sh600522', name: '中天科技', code: '600522', group: 'optical', snapP: 33.43, snapC: 1.80 },
    { tc: 'sh600498', name: '烽火通信', code: '600498', group: 'optical', snapP: 40.70, snapC: 5.71 },
    { tc: 'sh601869', name: '长飞光纤', code: '601869', group: 'optical', snapP: 363.60, snapC: 1.65 },
    { tc: 'sh601138', name: '工业富联', code: '601138', group: 'optical', snapP: 62.84, snapC: 1.14 },

    { tc: 'sh688225', name: '长鑫科技', code: '688225', group: 'storage', snapP: 58.00, snapC: 0.75 },
    { tc: 'sh603986', name: '兆易创新', code: '603986', group: 'storage', snapP: 409.06, snapC: 1.38 },
    { tc: 'sh688008', name: '澜起科技', code: '688008', group: 'storage', snapP: 200.55, snapC: 0.72 },
    { tc: 'sh688525', name: '佰维存储', code: '688525', group: 'storage', snapP: 238.96, snapC: 1.83 },
    { tc: 'sz301308', name: '江波龙', code: '301308', group: 'storage', snapP: 380.66, snapC: 0.44 },
    { tc: 'sz000021', name: '深科技', code: '000021', group: 'storage', snapP: 37.90, snapC: 0.99 },
    { tc: 'sz002409', name: '雅克科技', code: '002409', group: 'storage', snapP: 138.50, snapC: 0.09 },
    { tc: 'sh600667', name: '太极实业', code: '600667', group: 'storage', snapP: 21.44, snapC: 1.08 },
    { tc: 'sz300975', name: '商洛电子', code: '300975', group: 'storage', snapP: 25.60, snapC: 0.59 },

    { tc: 'sh688981', name: '中芯国际', code: '688981', group: 'wafer', snapP: 124.80, snapC: -0.56 },
    { tc: 'sh688347', name: '华虹公司', code: '688347', group: 'wafer', snapP: 233.22, snapC: 0.23 },
    { tc: 'sh688249', name: '晶合集成', code: '688249', group: 'wafer', snapP: 39.12, snapC: -0.69 },
    { tc: 'sz002371', name: '北方华创', code: '002371', group: 'wafer', snapP: 714.43, snapC: 0.26 },
    { tc: 'sh600584', name: '长电科技', code: '600584', group: 'wafer', snapP: 78.57, snapC: -1.14 },
    { tc: 'sh600703', name: '三安光电', code: '600703', group: 'wafer', snapP: 13.79, snapC: 0.29 },
    { tc: 'sh688041', name: '海光信息', code: '688041', group: 'wafer', snapP: 246.21, snapC: -0.05 },
    { tc: 'sh688256', name: '寒武纪', code: '688256', group: 'wafer', snapP: 1035.00, snapC: 2.39 },

    { tc: 'sz002463', name: '沪电股份', code: '002463', group: 'pcb', snapP: 121.21, snapC: 6.03 },
    { tc: 'sz300476', name: '胜宏科技', code: '300476', group: 'pcb', snapP: 253.74, snapC: 0.11 },
    { tc: 'sz002384', name: '东山精密', code: '002384', group: 'pcb', snapP: 201.08, snapC: 1.73 },
    { tc: 'sh600183', name: '生益科技', code: '600183', group: 'pcb', snapP: 132.80, snapC: 5.16 },
    { tc: 'sh600176', name: '中国巨石', code: '600176', group: 'pcb', snapP: 42.04, snapC: 1.50 },

    { tc: 'sz002230', name: '科大讯飞', code: '002230', group: 'ai', snapP: 39.19, snapC: -1.80 },
    { tc: 'sh688111', name: '金山办公', code: '688111', group: 'ai', snapP: 240.50, snapC: -0.47 },
    { tc: 'sz300624', name: '万兴科技', code: '300624', group: 'ai', snapP: 51.24, snapC: -1.54 },
    { tc: 'sz300418', name: '昆仑万维', code: '300418', group: 'ai', snapP: 43.82, snapC: -2.73 },
    { tc: 'sz300364', name: '中文在线', code: '300364', group: 'ai', snapP: 23.09, snapC: -0.04 },
    { tc: 'sh603533', name: '掌阅科技', code: '603533', group: 'ai', snapP: 20.95, snapC: -1.78 },
    { tc: 'sz300634', name: '彩讯股份', code: '300634', group: 'ai', snapP: 19.48, snapC: -0.87 },
    { tc: 'sh688590', name: '新致软件', code: '688590', group: 'ai', snapP: 13.01, snapC: 3.42 },
    { tc: 'sz300170', name: '汉得信息', code: '300170', group: 'ai', snapP: 15.53, snapC: -0.45 },

    { tc: 'sz000657', name: '中钨高新', code: '000657', group: 'metal', snapP: 68.14, snapC: 5.73 },
    { tc: 'sh600397', name: '江钨装备', code: '600397', group: 'metal', snapP: 18.14, snapC: 10.01 },
    { tc: 'sh601958', name: '金钼股份', code: '601958', group: 'metal', snapP: 21.94, snapC: 0.64 },
    { tc: 'sz002842', name: '翔鹭钨业', code: '002842', group: 'metal', snapP: 39.47, snapC: 5.59 },

    { tc: 'sh688083', name: '中望软件', code: '688083', group: 'software', snapP: 53.73, snapC: 0.19 },
    { tc: 'sh688507', name: '索辰科技', code: '688507', group: 'software', snapP: 158.46, snapC: 1.89 },
    { tc: 'sz301313', name: '凡拓数创', code: '301313', group: 'software', snapP: 34.08, snapC: 0.77 },
    { tc: 'sh603859', name: '能科科技', code: '603859', group: 'software', snapP: 38.02, snapC: -0.16 }
  ];

  // 同花顺板块指数（暂无公开实时接口，静态快照）
  var SECTORS = [
    { name: 'CPO共封装光学', code: '885033', value: 5769.70, chg: 1.42 },
    { name: 'PCB概念', code: '885959', value: 2567.66, chg: 1.21 },
    { name: '通信设备', code: '881129', value: 9265.34, chg: 1.37 },
    { name: '光纤概念', code: '886084', value: 3651.97, chg: 0.67 },
    { name: '存储芯片', code: '886042', value: 2608.10, chg: 0.56 },
    { name: '半导体', code: '881121', value: 16547.98, chg: 0.37 },
    { name: '算力租赁', code: '886050', value: 1353.37, chg: 0.27 },
    { name: '华为海思概念', code: '885843', value: 3976.07, chg: 0.00 }
  ];

  // 市场核心指数（腾讯行情实时）snapAmt 为成交额(亿)
  var INDICES = [
    { tc: 'sh000001', name: '上证指数', code: '000001', snapP: 3905.20, snapC: 0.04, snapAmt: 8834 },
    { tc: 'sz399001', name: '深证成指', code: '399001', snapP: 14094.17, snapC: 0.87, snapAmt: 9958 },
    { tc: 'sz399006', name: '创业板指', code: '399006', snapP: 3545.58, snapC: 1.43, snapAmt: 4945 },
    { tc: 'sh000688', name: '科创50', code: '000688', snapP: 1653.56, snapC: 0.04, snapAmt: 776 },
    { tc: 'sh000300', name: '沪深300', code: '000300', snapP: 4618.90, snapC: 0.57, snapAmt: 5055 },
    { tc: 'sh000852', name: '中证1000', code: '000852', snapP: 7601.80, snapC: 0.16, snapAmt: 4159 }
  ];

  // 板块行情·行业ETF代理（腾讯行情实时）snapAmt 成交额(亿) snapTr 换手率(%)
  var SECTOR_ETFS = [
    { tc: 'sh515880', name: '通信ETF', code: '515880', theme: '光通信/CPO', snapP: 0.677, snapC: 1.96, snapAmt: 31.5, snapTr: 7.47 },
    { tc: 'sh515050', name: '5G ETF', code: '515050', theme: '光通信/CPO', held: true, snapP: 1.050, snapC: 2.64, snapAmt: 9.8, snapTr: 5.39 },
    { tc: 'sh512760', name: '芯片ETF', code: '512760', theme: '半导体/芯片', held: true, snapP: 1.104, snapC: 0.45, snapAmt: 3.0, snapTr: 2.82 },
    { tc: 'sh512480', name: '半导体ETF', code: '512480', theme: '半导体/芯片', snapP: 1.042, snapC: 0.29, snapAmt: 11.0, snapTr: 5.50 },
    { tc: 'sh515260', name: '电子ETF华宝', code: '515260', theme: 'PCB/电子', snapP: 0.844, snapC: 1.08, snapAmt: 0.5, snapTr: 7.09 },
    { tc: 'sz159819', name: '人工智能ETF', code: '159819', theme: 'AI算力/大模型', snapP: 1.749, snapC: 1.10, snapAmt: 4.4, snapTr: 2.10 },
    { tc: 'sh515070', name: '人工智能ETF华夏', code: '515070', theme: 'AI应用', snapP: 1.108, snapC: 1.28, snapAmt: 1.3, snapTr: 1.54 },
    { tc: 'sh515230', name: '软件ETF', code: '515230', theme: '软件/计算机', snapP: 0.687, snapC: -0.29, snapAmt: 1.3, snapTr: 2.48 },
    { tc: 'sh512720', name: '计算机ETF', code: '512720', theme: '软件/计算机', snapP: 1.161, snapC: -0.17, snapAmt: 0.2, snapTr: 4.50 },
    { tc: 'sh515000', name: '科技ETF', code: '515000', theme: '泛科技', snapP: 1.279, snapC: 1.11, snapAmt: 1.7, snapTr: 4.24 },
    { tc: 'sh512400', name: '有色金属ETF', code: '512400', theme: '有色/贵金属', snapP: 1.946, snapC: 3.29, snapAmt: 14.8, snapTr: 5.85 },
    { tc: 'sh518880', name: '黄金ETF', code: '518880', theme: '有色/贵金属', snapP: 9.388, snapC: 1.67, snapAmt: 76.8, snapTr: 7.26 }
  ];

  var HOLDINGS = [
    { tc: 'sh600353', code: '600353', name: '旭光电子', shares: 200, cost: 39.2085 },
    { tc: 'sz002436', code: '002436', name: '兴森科技', shares: 300, cost: 43.0273 },
    { tc: 'sh512760', code: '512760', name: '芯片ETF', shares: 400, cost: 1.3233 },
    { tc: 'sh515050', code: '515050', name: '5GETF', shares: 300, cost: 1.2413 }
  ];

  var quoteCache = {};
  var currentGroup = 'all';
  var lastUpdate = null;
  var lastOk = false;
  var loading = false;

  /* ---------- 工具 ---------- */
  function el(id) { return document.getElementById(id); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtMoney(n) {
    return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtSignedMoney(n) { return (n >= 0 ? '+' : '-') + fmtMoney(Math.abs(n)); }
  function fmtSigned(n) { return (n >= 0 ? '+' : '-') + Math.abs(n).toFixed(2); }
  function fmtPct(n) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
  function fmtPrice(p) { return p >= 10 ? p.toFixed(2) : p.toFixed(3); }
  function chgCls(n) { return n > 0 ? 'change-up' : (n < 0 ? 'change-down' : ''); }
  function upColor(n) { return n > 0 ? 'var(--up)' : (n < 0 ? 'var(--down)' : 'var(--muted)'); }

  /* ---------- 交易时段 ---------- */
  function marketStatus() {
    var now = new Date();
    var day = now.getDay();
    if (day === 0 || day === 6) return { key: 'weekend', label: '周末休市', trading: false };
    var m = now.getHours() * 60 + now.getMinutes();
    if (m < 555) return { key: 'pre', label: '待开盘', trading: false };
    if (m < 570) return { key: 'auction', label: '集合竞价', trading: false };
    if (m < 690) return { key: 'open', label: '早盘交易中', trading: true };
    if (m < 780) return { key: 'lunch', label: '午间休市', trading: false };
    if (m < 900) return { key: 'open', label: '午盘交易中', trading: true };
    if (m < 902) return { key: 'close', label: '收盘竞价', trading: false };
    return { key: 'closed', label: '已收盘', trading: false };
  }

  /* ---------- 行情拉取（script注入绕过跨域） ---------- */
  function fetchBatch(codes, cb) {
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

  function parseQuote(tc) {
    try {
      var raw = window['v_' + tc];
      if (!raw || typeof raw !== 'string') return null;
      var f = raw.split('~');
      if (f.length < 39) return null;
      var price = parseFloat(f[3]);
      var prev = parseFloat(f[4]);
      if (!isFinite(price) || price <= 0 || !isFinite(prev) || prev <= 0) return null;
      var high = parseFloat(f[33]);
      var low = parseFloat(f[34]);
      if (!isFinite(high) || high < price) high = 0;
      if (!isFinite(low) || low > price || low <= 0) low = 0;
      var open = parseFloat(f[5]);
      if (!isFinite(open) || open <= 0) open = 0;
      return {
        price: price,
        prev: prev,
        open: open,
        high: high,
        low: low,
        vol: parseFloat(f[6]) || 0,
        amt: parseFloat(f[37]) || 0,
        turnover: parseFloat(f[38]) || 0
      };
    } catch (e) { return null; }
  }

  function countCache() {
    var n = 0, k;
    for (k in quoteCache) if (quoteCache.hasOwnProperty(k)) n++;
    return n;
  }

  function refresh() {
    if (loading) return;
    loading = true;
    updateRefreshBtn();
    var codes = [];
    var seen = {};
    function push(tc) { if (!seen[tc]) { seen[tc] = 1; codes.push(tc); } }
    STOCKS.forEach(function(s) { push(s.tc); });
    HOLDINGS.forEach(function(h) { push(h.tc); });
    INDICES.forEach(function(i) { push(i.tc); });
    SECTOR_ETFS.forEach(function(e) { push(e.tc); });
    var batches = [];
    for (var i = 0; i < codes.length; i += 22) batches.push(codes.slice(i, i + 22));
    var finished = 0, okBatches = 0;
    batches.forEach(function(b) {
      fetchBatch(b, function(ok) {
        if (ok) okBatches++;
        b.forEach(function(tc) {
          var q = parseQuote(tc);
          if (q) quoteCache[tc] = q;
        });
        finished++;
        if (finished === batches.length) {
          loading = false;
          lastUpdate = new Date();
          lastOk = okBatches > 0 && countCache() > 0;
          renderAll();
          updateRefreshBtn();
        }
      });
    });
  }

  function onShow() {
    if (loading) return;
    if (!lastUpdate || Date.now() - lastUpdate.getTime() > 120000) refresh();
    else renderStatus();
  }

  /* ---------- 渲染 ---------- */
  function updateRefreshBtn() {
    var b = el('wl-refresh-btn');
    if (!b) return;
    b.disabled = loading;
    b.textContent = loading ? '刷新中…' : '立即刷新';
  }

  function renderStatus() {
    var st = marketStatus();
    var failed = lastUpdate !== null && !lastOk;
    var pill = el('wl-market-status');
    if (pill) {
      pill.innerHTML = '<span class="wl-status-dot"></span>' + (failed ? st.label + ' · 行情连接失败' : st.label);
      pill.className = 'wl-status-pill ' + (failed ? 'error' : (st.trading ? 'open' : 'closed'));
    }
    var t = el('wl-update-time');
    if (t) {
      t.textContent = lastUpdate
        ? '最后更新 ' + pad2(lastUpdate.getHours()) + ':' + pad2(lastUpdate.getMinutes()) + ':' + pad2(lastUpdate.getSeconds())
        : '等待首次刷新…';
    }
    var hint = el('wl-auto-hint');
    if (hint) {
      hint.innerHTML = st.trading
        ? '<span class="wl-live-dot"></span> 盘中每秒自动刷新'
        : '非交易时段 · 显示最后快照';
    }
    var badge = el('wl-source-badge');
    if (badge) badge.textContent = lastOk ? '腾讯行情 · 实时' : '快照 ' + SNAPSHOT_DATE;
  }

  function renderChips() {
    var wrap = el('wl-group-chips');
    if (!wrap) return;
    if (!wrap.getAttribute('data-built')) {
      var html = '';
      GROUPS.forEach(function(g) {
        var n = g.id === 'all' ? STOCKS.length : STOCKS.filter(function(s) { return s.group === g.id; }).length;
        html += '<button class="wl-chip' + (g.id === currentGroup ? ' active' : '') + '" data-g="' + g.id + '">' + g.name + ' ' + n + '</button>';
      });
      wrap.innerHTML = html;
      wrap.setAttribute('data-built', '1');
      wrap.addEventListener('click', function(e) {
        var t = e.target;
        while (t && t !== wrap && !(t.getAttribute && t.getAttribute('data-g'))) t = t.parentNode;
        if (t && t.getAttribute && t.getAttribute('data-g')) {
          currentGroup = t.getAttribute('data-g');
          renderChips();
          renderTable();
        }
      });
    } else {
      var chips = wrap.querySelectorAll('.wl-chip');
      for (var i = 0; i < chips.length; i++) {
        chips[i].classList.toggle('active', chips[i].getAttribute('data-g') === currentGroup);
      }
    }
  }

  function rowData(s) {
    var q = quoteCache[s.tc];
    if (q) {
      var chg = q.price - q.prev;
      return {
        price: q.price, chg: chg, pct: chg / q.prev * 100,
        high: q.high, low: q.low,
        volWan: q.vol > 0 ? q.vol / 10000 : 0,
        tr: q.turnover > 0 ? q.turnover : 0
      };
    }
    var prev = s.snapP / (1 + s.snapC / 100);
    return { price: s.snapP, chg: s.snapP - prev, pct: s.snapC, high: 0, low: 0, volWan: 0, tr: 0 };
  }

  function renderTable() {
    var tbody = el('wl-tbody');
    if (!tbody) return;
    var list = STOCKS.filter(function(s) { return currentGroup === 'all' || s.group === currentGroup; });
    list.sort(function(a, b) { return rowData(b).pct - rowData(a).pct; });
    var html = '';
    list.forEach(function(s) {
      var d = rowData(s);
      var cls = chgCls(d.pct);
      html += '<tr>'
        + '<td><span class="stock-name">' + s.name + '</span></td>'
        + '<td><span class="stock-code">' + s.code + '</span></td>'
        + '<td style="font-weight:600">' + fmtPrice(d.price) + '</td>'
        + '<td class="' + cls + '">' + fmtSigned(d.chg) + '</td>'
        + '<td class="' + cls + '" style="font-weight:600">' + fmtPct(d.pct) + '</td>'
        + '<td>' + (d.high ? fmtPrice(d.high) : '—') + '</td>'
        + '<td>' + (d.low ? fmtPrice(d.low) : '—') + '</td>'
        + '<td>' + (d.volWan ? d.volWan.toFixed(1) : '—') + '</td>'
        + '<td>' + (d.tr ? d.tr.toFixed(2) + '%' : '—') + '</td>'
        + '</tr>';
    });
    tbody.innerHTML = html;
    var cnt = el('wl-count');
    if (cnt) cnt.textContent = list.length;
  }

  function renderSectors() {
    var tbody = el('wl-sector-tbody');
    if (!tbody || tbody.getAttribute('data-built')) return;
    var html = '';
    SECTORS.forEach(function(x) {
      var cls = chgCls(x.chg);
      html += '<tr>'
        + '<td><span class="stock-name">' + x.name + '</span></td>'
        + '<td><span class="stock-code">' + x.code + '</span></td>'
        + '<td style="font-weight:600">' + x.value.toFixed(2) + '</td>'
        + '<td class="' + cls + '">' + fmtPct(x.chg) + '</td>'
        + '</tr>';
    });
    tbody.innerHTML = html;
    tbody.setAttribute('data-built', '1');
  }

  function renderIndices() {
    var wrap = el('wl-index-cards');
    if (!wrap) return;
    var html = '';
    INDICES.forEach(function(ix) {
      var q = quoteCache[ix.tc];
      var p, pct, amt;
      if (q) {
        p = q.price;
        pct = (q.price - q.prev) / q.prev * 100;
        amt = q.amt > 0 ? q.amt / 10000 : 0;
      } else {
        p = ix.snapP;
        pct = ix.snapC;
        amt = ix.snapAmt;
      }
      var dir = pct > 0 ? 'up' : (pct < 0 ? 'down' : '');
      var amtTxt = amt ? ' · ' + (amt >= 100 ? amt.toFixed(0) : amt.toFixed(1)) + '亿' : '';
      html += '<div class="index-card ' + dir + '">'
        + '<div class="index-name">' + ix.name + ' · ' + ix.code + '</div>'
        + '<div class="index-value" style="font-size:22px;">' + p.toFixed(2) + '</div>'
        + '<div class="index-change ' + dir + '">' + fmtPct(pct) + amtTxt + '</div>'
        + '</div>';
    });
    wrap.innerHTML = html;
  }

  function renderEtf() {
    var tbody = el('wl-etf-tbody');
    if (!tbody) return;
    var html = '';
    SECTOR_ETFS.forEach(function(s) {
      var q = quoteCache[s.tc];
      var price, pct, amt, tr;
      if (q) {
        price = q.price;
        pct = (q.price - q.prev) / q.prev * 100;
        amt = q.amt > 0 ? q.amt / 10000 : 0;
        tr = q.turnover;
      } else {
        price = s.snapP;
        pct = s.snapC;
        amt = s.snapAmt;
        tr = s.snapTr;
      }
      var cls = chgCls(pct);
      html += '<tr>'
        + '<td><span style="font-size:11px;color:var(--muted);border:1px solid var(--rule);padding:1px 8px;border-radius:999px;white-space:nowrap;">' + s.theme + '</span></td>'
        + '<td><span class="stock-name">' + s.name + (s.held ? ' <span style="color:var(--accent);font-size:11px;font-weight:700;">持仓</span>' : '') + '</span></td>'
        + '<td><span class="stock-code">' + s.code + '</span></td>'
        + '<td style="font-weight:600">' + fmtPrice(price) + '</td>'
        + '<td class="' + cls + '" style="font-weight:600">' + fmtPct(pct) + '</td>'
        + '<td>' + (amt ? amt.toFixed(1) : '—') + '</td>'
        + '<td>' + (tr ? tr.toFixed(2) + '%' : '—') + '</td>'
        + '</tr>';
    });
    tbody.innerHTML = html;
  }

  function setText(id, txt) { var e = el(id); if (e) e.textContent = txt; }

  function setCell(id, txt, val) {
    var e = el(id);
    if (!e) return;
    e.textContent = txt;
    e.className = chgCls(val);
  }

  function setSignedMoney(id, val, subId, subPct) {
    var e = el(id);
    if (e) {
      e.textContent = fmtSignedMoney(val);
      var c = upColor(val);
      e.style.color = c;
      if (e.parentElement) e.parentElement.style.color = c;
    }
    if (subId) {
      var s = el(subId);
      if (s) {
        s.textContent = fmtPct(subPct);
        s.style.color = upColor(subPct);
      }
    }
  }

  function renderHoldings() {
    var allLive = HOLDINGS.every(function(h) { return !!quoteCache[h.tc]; });
    var totalMV = 0, totalPnl = 0, dayPnl = 0;

    HOLDINGS.forEach(function(h) {
      var q = quoteCache[h.tc];
      if (!q) return;
      var mv = q.price * h.shares;
      var pnl = (q.price - h.cost) * h.shares;
      var day = (q.price - q.prev) * h.shares;
      totalMV += mv; totalPnl += pnl; dayPnl += day;
      var pctDay = (q.price - q.prev) / q.prev * 100;
      var pctPnl = (q.price - h.cost) / h.cost * 100;
      setText('h-price-' + h.code, fmtPrice(q.price));
      setCell('h-chg-' + h.code, fmtPct(pctDay), pctDay);
      setText('h-mv-' + h.code, fmtMoney(mv));
      setCell('h-pnl-' + h.code, fmtSignedMoney(pnl), pnl);
      setCell('h-pnlp-' + h.code, fmtPct(pctPnl), pctPnl);
    });

    if (!allLive) return;

    // 仓位占比（基于实时市值）
    HOLDINGS.forEach(function(h) {
      var q = quoteCache[h.tc];
      if (!q) return;
      setText('h-pos-' + h.code, (q.price * h.shares / totalMV * 100).toFixed(1) + '%');
    });

    var total = totalMV + CASH;
    setText('s-total-v', fmtMoney(total));
    setText('s-mv-v', fmtMoney(totalMV));
    setText('s-mv-s', '仓位 ' + (totalMV / total * 100).toFixed(1) + '%');
    setText('s-cash-s', '可用仓位 ' + (CASH / total * 100).toFixed(1) + '%');
    setSignedMoney('s-pnl-v', totalPnl, 's-pnl-s', totalPnl / INIT_CAPITAL * 100);
    setSignedMoney('s-day-v', dayPnl, 's-day-p', dayPnl / (total - dayPnl) * 100);
  }

  function renderAll() {
    renderStatus();
    renderChips();
    renderTable();
    renderIndices();
    renderEtf();
    renderSectors();
    renderHoldings();
  }

  /* ---------- 初始化 ---------- */
  function liveTabActive() {
    var s = document.querySelector('.section.active');
    return !!s && (s.id === 'section-watchlist' || s.id === 'section-portfolio' || s.id === 'section-premarket');
  }

  var liveTimer = null;
  function scheduleNext() {
    if (liveTimer) clearTimeout(liveTimer);
    var ms = (marketStatus().trading && liveTabActive()) ? FAST_MS : SLOW_MS;
    liveTimer = setTimeout(function() {
      if (!document.hidden) {
        if (marketStatus().trading) refresh();
        else renderStatus();
      }
      scheduleNext();
    }, ms);
  }

  function init() {
    renderChips();
    renderTable();
    renderIndices();
    renderEtf();
    renderSectors();
    renderStatus();
    refresh();
    scheduleNext();

    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        if (marketStatus().trading && (!lastUpdate || Date.now() - lastUpdate.getTime() > FAST_MS)) refresh();
        else renderStatus();
      }
    });
  }

  window.Watchlist = {
    refresh: refresh,
    onShow: onShow,
    getQuote: function(tc) { return quoteCache[tc] || null; },
    getStocks: function() { return STOCKS; },
    getHoldings: function() { return HOLDINGS; },
    marketStatus: marketStatus
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
