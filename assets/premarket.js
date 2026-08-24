/* ==================================================================
   盘前研判 · 实时触发监控
   关键位基于 8/21（周五）收盘K线测算：
   - 上证指数：60日日线（高点/低点/MA5/MA10/MA20/整数关口）
   - 持仓股与机会标的：40日日线（前高前低/平台/缺口）
   实时价读取 Watchlist 行情缓存（腾讯接口），盘中1秒联动；
   触发买点/卖点/止损时状态列高亮提示。
   ================================================================== */
(function() {
  'use strict';

  /* ---------- 数据：上证指数关键位 ---------- */
  var IDX = {
    tc: 'sh000001', name: '上证指数', snap: 3905.20, snapPct: 0.04,
    resist: [
      { p: 3912, tag: 'P1 · 轻压', txt: '3912', basis: '8/21盘中高点 3912.13', meaning: '第一道试探性压力' },
      { p: 3937, tag: 'P2 · 均线压力', txt: '3935-3940', basis: 'MA5≈3935 / MA10≈3938', meaning: '放量站上则短线转强' },
      { p: 3976, tag: 'P3 · 主压力区', txt: '3968-3985', basis: '8/13高3968 / 8/17高3983', meaning: '冲高减仓区' },
      { p: 3997, tag: 'P4 · 强压', txt: '3994-4000', basis: '8/18高3994 + 4000整数关口', meaning: '放量突破打开上行空间' }
    ],
    support: [
      { p: 3888, tag: 'S1 · 首要支撑', txt: '3880-3893', basis: '近3日低点3880-3888 + MA20≈3893', meaning: '低开不破可低吸' },
      { p: 3864, tag: 'S2 · 次级支撑', txt: '3864', basis: '8/6低点 3864.27', meaning: '跌破S1后的第一缓冲' },
      { p: 3818, tag: 'S3 · 强支撑', txt: '3815-3822', basis: '8/5低3815 / 8/4收3822 平台', meaning: '跌破转防守，仓位压降' },
      { p: 3799, tag: 'S4 · 整数支撑', txt: '3799-3800', basis: '8/4低点3799 + 3800整数', meaning: '趋势分界，失守转空' }
    ]
  };

  var CYB = { tc: 'sz399006', snap: 3545.58, snapPct: 1.43 };

  /* ---------- 数据：持仓股买卖点 ---------- */
  var HOLDS = [
    {
      tc: 'sh600353', name: '旭光电子', code: '600353', shares: 200, cost: 39.2085,
      snap: 38.28, snapPct: 10.00,
      sellTxt: '40.0-42.0 减仓100股', sellPx: 40.0,
      buyTxt: '35.8-36.5 回踩企稳接回', buyPx: 36.5,
      stopTxt: '33.50', stopPx: 33.5,
      plan: '涨停次日纪律：高开2%-5%量能温和→持有；冲40-42滞涨→减100股；高开>7%炸板→直接兑现；低开破37.17→先减半防守'
    },
    {
      tc: 'sz002436', name: '兴森科技', code: '002436', shares: 300, cost: 43.0273,
      snap: 35.35, snapPct: 4.55,
      sellTxt: '36.0轻压 / 37.6-38.3 做T高抛100股', sellPx: 37.6,
      buyTxt: '33.8-34.0 做T低吸100股', buyPx: 34.0,
      stopTxt: '32.70', stopPx: 32.7,
      plan: '加仓至300股：38附近高抛100股做T、33-34接回；收盘站上36可持有；补仓已完成，后续以做T降成本为主'
    },
    {
      tc: 'sh512760', name: '芯片ETF', code: '512760', shares: 400, cost: 1.3233,
      snap: 1.104, snapPct: 0.45,
      sellTxt: '1.172（8/19高）反弹减100份', sellPx: 1.172,
      buyTxt: '1.088（8/20低）企稳接回', buyPx: 1.088,
      stopTxt: '1.057', stopPx: 1.057,
      plan: '深套不止损、反弹分批减：到1.17-1.22减100份摊低成本；半导体主力资金仍净流出，反弹高度有限宜降低预期'
    },
    {
      tc: 'sh515050', name: '5GETF', code: '515050', shares: 300, cost: 1.2413,
      snap: 1.050, snapPct: 2.64,
      sellTxt: '1.073（8/19高）做T卖出50-100份', sellPx: 1.073,
      buyTxt: '1.008（8/20低）企稳接回', buyPx: 1.008,
      stopTxt: '0.988', stopPx: 0.988,
      plan: '持有等反弹：反弹至1.07以上做T卖出50-100份；1.00-1.01缩量企稳可接回；回本需+18.2%，以时间换空间'
    }
  ];

  /* ---------- 数据：潜在机会 ---------- */
  var OPPS = [
    {
      rank: 1, tc: 'sh515070', name: '人工智能ETF华夏', code: '515070', theme: 'AI应用',
      snap: 1.108, snapPct: 1.28,
      buyTxt: '1.05-1.08 回踩低吸', buyPx: 1.08,
      sellTxt: '1.15-1.18', sellPx: 1.15,
      stopTxt: '1.04（收盘跌破）', stopPx: 1.04,
      capital: '约110元/100份 · 现有资金即可',
      logic: '新纳入AI应用板块旗舰；8/17以来沿5日线爬升，缩量回踩8/11-8/14平台1.05-1.08是低吸位；小仓位试错'
    },
    {
      rank: 2, tc: 'sh600703', name: '三安光电', code: '600703', theme: '化合物半导体',
      snap: 13.79, snapPct: 0.29,
      buyTxt: '13.40-13.60 双底下沿', buyPx: 13.60,
      sellTxt: '13.95 / 14.07-14.18，突破看14.9', sellPx: 13.95,
      stopTxt: '13.25（8/14低点）', stopPx: 13.25,
      capital: '约1,379元/100股 · 现有资金可买',
      logic: '13.40双底（8/19、8/21两日低点重合）；温和放量收复13.7；突破13.95打开至14.9空间；低价股现有资金即可参与'
    },
    {
      rank: 3, tc: 'sz002463', name: '沪电股份', code: '002463', theme: 'PCB主线龙头',
      snap: 121.21, snapPct: 6.03,
      buyTxt: '回踩114-116 企稳（8/19低112.5上方）', buyPx: 116.0,
      sellTxt: '127.7-129.0（8/7、8/13高点区）', sellPx: 127.7,
      stopTxt: '110（跌破8/19低点区）', stopPx: 110.0,
      capital: '约12,121元/100股 · 需先减仓回笼',
      logic: 'PCB主线龙头8/21放量+6%创阶段新高；不追高，等回踩114-116缩量企稳再介入；与兴森同属PCB链，注意行业集中度'
    },
    {
      rank: 4, tc: 'sh600498', name: '烽火通信', code: '600498', theme: '光模块/CPO',
      snap: 40.70, snapPct: 5.71,
      buyTxt: '37.2-38.5 回踩（8/20低+8/21跳空区）', buyPx: 38.5,
      sellTxt: '42.0-42.4（8/21、8/18高），突破看45', sellPx: 42.0,
      stopTxt: '37.00（8/20低点下方）', stopPx: 37.0,
      capital: '约4,070元/100股 · 需减仓后资金',
      logic: '8/21放量+5.7%，通信板块主力资金持续净流入（99亿）；回踩37-38缺口不补可低吸；与5GETF同板块，避免重复暴露'
    },
    {
      rank: 5, tc: 'sh518880', name: '黄金ETF', code: '518880', theme: '防守对冲',
      snap: 9.388, snapPct: 1.67,
      buyTxt: '9.05-9.20 回调分2-3批', buyPx: 9.20,
      sellTxt: '配置型不设目标，占仓位8%-12%', sellPx: 0,
      stopTxt: '不设价格止损（配置仓）', stopPx: 0,
      capital: '约939元/100份 · 按计划约2,000元分批',
      logic: '金价4530美元+避险升温，8/21再创新高9.388；按既定防守计划回调分批建仓，对冲科技持仓波动'
    }
  ];

  /* ---------- 工具 ---------- */
  function el(id) { return document.getElementById(id); }
  function chgCls(n) { return n > 0 ? 'change-up' : (n < 0 ? 'change-down' : ''); }
  function upColor(n) { return n > 0 ? 'var(--up)' : (n < 0 ? 'var(--down)' : 'var(--muted)'); }
  function fmtPct(n) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
  function fmtPrice(p) { return p >= 10 ? p.toFixed(2) : p.toFixed(3); }
  function pctTo(from, to) { return (to - from) / from * 100; }

  function quoteOf(tc, snap, snapPct) {
    var q = window.Watchlist && window.Watchlist.getQuote ? window.Watchlist.getQuote(tc) : null;
    if (q && isFinite(q.price) && q.price > 0) {
      return { price: q.price, pct: (q.price - q.prev) / q.prev * 100 };
    }
    return { price: snap, pct: snapPct };
  }

  function statusPill(text, kind) {
    var styles = {
      sell: 'color:var(--up);background:rgba(239,68,68,0.12);',
      buy: 'color:var(--down);background:rgba(34,197,94,0.12);',
      stop: 'color:#0a0e1a;background:var(--accent);font-weight:700;',
      neutral: 'color:var(--muted);background:var(--bg3);'
    };
    return '<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;white-space:nowrap;' + (styles[kind] || styles.neutral) + '">' + text + '</span>';
  }

  function sectionActive() {
    var s = el('section-premarket');
    return !!s && s.classList.contains('active');
  }

  /* ---------- 渲染：指数关键位表 ---------- */
  function renderIdxTable() {
    var tbody = el('pm-idx-tbody');
    if (!tbody || tbody.getAttribute('data-built')) return;
    var html = '';
    IDX.resist.slice().reverse().forEach(function(lv, i) {
      var idx = IDX.resist.length - 1 - i;
      html += '<tr>'
        + '<td class="change-up" style="font-weight:600;">压力</td>'
        + '<td>' + lv.tag + '</td>'
        + '<td style="font-weight:700;color:var(--up);">' + lv.txt + '</td>'
        + '<td style="color:var(--muted);font-size:12px;">' + lv.basis + '</td>'
        + '<td style="color:var(--muted);font-size:12px;">' + lv.meaning + '</td>'
        + '<td id="pm-idx-st-r' + idx + '"></td>'
        + '</tr>';
    });
    IDX.support.forEach(function(lv, idx) {
      html += '<tr>'
        + '<td class="change-down" style="font-weight:600;">支撑</td>'
        + '<td>' + lv.tag + '</td>'
        + '<td style="font-weight:700;color:var(--down);">' + lv.txt + '</td>'
        + '<td style="color:var(--muted);font-size:12px;">' + lv.basis + '</td>'
        + '<td style="color:var(--muted);font-size:12px;">' + lv.meaning + '</td>'
        + '<td id="pm-idx-st-s' + idx + '"></td>'
        + '</tr>';
    });
    tbody.innerHTML = html;
    tbody.setAttribute('data-built', '1');
  }

  /* ---------- 渲染：持仓买卖点表 ---------- */
  function renderHolds() {
    var tbody = el('pm-hold-tbody');
    if (!tbody || tbody.getAttribute('data-built')) return;
    var html = '';
    HOLDS.forEach(function(h, i) {
      html += '<tr>'
        + '<td><span class="stock-name">' + h.name + '</span><br><span class="stock-code">' + h.code + ' · ' + h.shares + '股 · 成本' + h.cost.toFixed(3) + '</span></td>'
        + '<td id="pm-h-price-' + i + '" style="font-weight:700;"></td>'
        + '<td id="pm-h-pct-' + i + '" style="font-weight:600;"></td>'
        + '<td style="color:var(--up);font-size:12px;">' + h.sellTxt + '</td>'
        + '<td style="color:var(--down);font-size:12px;">' + h.buyTxt + '</td>'
        + '<td style="color:var(--accent);font-size:12px;">' + h.stopTxt + '</td>'
        + '<td style="color:var(--muted);font-size:12px;max-width:280px;white-space:normal;line-height:1.7;">' + h.plan + '</td>'
        + '<td id="pm-h-st-' + i + '"></td>'
        + '</tr>';
    });
    tbody.innerHTML = html;
    tbody.setAttribute('data-built', '1');
  }

  /* ---------- 渲染：机会表 ---------- */
  function renderOpps() {
    var tbody = el('pm-opp-tbody');
    if (!tbody || tbody.getAttribute('data-built')) return;
    var html = '';
    OPPS.forEach(function(o, i) {
      html += '<tr>'
        + '<td style="font-weight:700;color:var(--accent);">' + o.rank + '</td>'
        + '<td><span class="stock-name">' + o.name + '</span><br><span class="stock-code">' + o.code + ' · ' + o.theme + '</span></td>'
        + '<td id="pm-o-price-' + i + '" style="font-weight:700;"></td>'
        + '<td style="color:var(--down);font-size:12px;">' + o.buyTxt + '</td>'
        + '<td style="color:var(--up);font-size:12px;">' + o.sellTxt + '</td>'
        + '<td style="color:var(--accent);font-size:12px;">' + o.stopTxt + '</td>'
        + '<td style="color:var(--muted);font-size:12px;">' + o.capital + '</td>'
        + '<td style="color:var(--muted);font-size:12px;max-width:300px;white-space:normal;line-height:1.7;">' + o.logic + '</td>'
        + '<td id="pm-o-st-' + i + '"></td>'
        + '</tr>';
    });
    tbody.innerHTML = html;
    tbody.setAttribute('data-built', '1');
  }

  /* ---------- 实时刷新 ---------- */
  function tick() {
    if (document.hidden || !sectionActive()) return;

    // 上证指数实时价与所处区间
    var iq = quoteOf(IDX.tc, IDX.snap, IDX.snapPct);
    var ip = el('pm-idx-price'), ic = el('pm-idx-chg'), iz = el('pm-idx-zone');
    if (ip) { ip.textContent = iq.price.toFixed(2); ip.style.color = upColor(iq.pct); }
    if (ic) { ic.textContent = fmtPct(iq.pct); ic.style.color = upColor(iq.pct); }
    if (iz) {
      var nextR = null, prevR = null;
      for (var r = 0; r < IDX.resist.length; r++) {
        if (iq.price < IDX.resist[r].p) { nextR = IDX.resist[r]; prevR = r > 0 ? IDX.resist[r - 1] : null; break; }
      }
      if (!nextR) { nextR = null; prevR = IDX.resist[IDX.resist.length - 1]; }
      var nextS = null;
      for (var s = 0; s < IDX.support.length; s++) {
        if (iq.price > IDX.support[s].p) { nextS = IDX.support[s]; break; }
      }
      var zoneTxt;
      if (!nextR && prevR) {
        zoneTxt = '已突破全部压力位（>' + prevR.txt + '）· 强势特征，持股为主';
      } else if (!nextS) {
        zoneTxt = '已跌破全部支撑位 · 防守模式，控制仓位';
      } else {
        zoneTxt = '位于 ' + nextS.tag.split(' ')[0] + '支撑(' + nextS.txt + ') 与 ' + nextR.tag.split(' ')[0] + '压力(' + nextR.txt + ') 之间'
          + ' · 距压力' + (pctTo(iq.price, nextR.p) >= 0 ? '+' : '') + pctTo(iq.price, nextR.p).toFixed(2) + '%'
          + ' / 距支撑' + (pctTo(iq.price, nextS.p) <= 0 ? '' : '+') + pctTo(iq.price, nextS.p).toFixed(2) + '%';
      }
      iz.innerHTML = zoneTxt;
    }

    // 各档位状态
    IDX.resist.forEach(function(lv, i) {
      var cell = el('pm-idx-st-r' + i);
      if (!cell) return;
      if (iq.price > lv.p) {
        cell.innerHTML = statusPill('已突破', 'neutral');
      } else {
        cell.innerHTML = statusPill('距离 +' + pctTo(iq.price, lv.p).toFixed(2) + '%', 'neutral');
      }
    });
    IDX.support.forEach(function(lv, i) {
      var cell = el('pm-idx-st-s' + i);
      if (!cell) return;
      if (iq.price < lv.p) {
        cell.innerHTML = statusPill('已跌破', 'stop');
      } else {
        cell.innerHTML = statusPill('距离 ' + pctTo(iq.price, lv.p).toFixed(2) + '%', 'neutral');
      }
    });

    // 创业板指
    var cq = quoteOf(CYB.tc, CYB.snap, CYB.snapPct);
    var cp = el('pm-cyb-price'), cc = el('pm-cyb-chg');
    if (cp) { cp.textContent = cq.price.toFixed(2); cp.style.color = upColor(cq.pct); }
    if (cc) { cc.textContent = fmtPct(cq.pct); cc.style.color = upColor(cq.pct); }

    // 持仓股
    HOLDS.forEach(function(h, i) {
      var q = quoteOf(h.tc, h.snap, h.snapPct);
      var priceCell = el('pm-h-price-' + i), pctCell = el('pm-h-pct-' + i), stCell = el('pm-h-st-' + i);
      if (priceCell) { priceCell.textContent = fmtPrice(q.price); priceCell.style.color = upColor(q.pct); }
      if (pctCell) { pctCell.textContent = fmtPct(q.pct); pctCell.className = chgCls(q.pct); }
      if (!stCell) return;
      if (q.price <= h.stopPx) {
        stCell.innerHTML = statusPill('触发止损', 'stop');
      } else if (q.price >= h.sellPx) {
        stCell.innerHTML = statusPill('已到卖点区', 'sell');
      } else if (q.price <= h.buyPx) {
        stCell.innerHTML = statusPill('已到买点区', 'buy');
      } else {
        stCell.innerHTML = statusPill('距买点' + pctTo(q.price, h.buyPx).toFixed(1) + '% · 距卖点+' + pctTo(q.price, h.sellPx).toFixed(1) + '%', 'neutral');
      }
    });

    // 机会标的
    OPPS.forEach(function(o, i) {
      var q = quoteOf(o.tc, o.snap, o.snapPct);
      var priceCell = el('pm-o-price-' + i), stCell = el('pm-o-st-' + i);
      if (priceCell) { priceCell.textContent = fmtPrice(q.price); priceCell.style.color = upColor(q.pct); }
      if (!stCell) return;
      if (o.stopPx > 0 && q.price <= o.stopPx) {
        stCell.innerHTML = statusPill('破止损 · 放弃', 'stop');
      } else if (q.price <= o.buyPx) {
        stCell.innerHTML = statusPill('已到买点区', 'buy');
      } else if (o.sellPx > 0 && q.price >= o.sellPx) {
        stCell.innerHTML = statusPill('已到目标区', 'sell');
      } else {
        stCell.innerHTML = statusPill('距买点' + pctTo(q.price, o.buyPx).toFixed(1) + '%', 'neutral');
      }
    });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    renderIdxTable();
    renderHolds();
    renderOpps();
    tick();
    setInterval(tick, 1000);
  }

  window.Premarket = { tick: tick };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
