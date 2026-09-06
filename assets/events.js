/* ==================================================================
   近期关注事件 · 每周自动更新
   事件数据存储在此文件中，根据当前日期自动筛选未来2周内的事件
   每周一自动刷新显示内容
   ================================================================== */
(function() {
  'use strict';

  var EVENTS = [
    { date: '2026-09-07', title: '中国8月进出口数据', desc: '海关总署公布8月外贸数据，关注出口增速变化' },
    { date: '2026-09-10', title: '中国8月CPI/PPI', desc: '国家统计局公布8月物价数据，关注通缩改善幅度' },
    { date: '2026-09-11', title: '8月金融数据', desc: '央行公布社融、M2及新增贷款数据' },
    { date: '2026-09-15', title: 'MLF操作', desc: '央行9月MLF续做规模及利率，关注流动性投放' },
    { date: '2026-09-17', title: '美联储FOMC利率决议', desc: '9月议息会议，市场预期降息25bp，鲍威尔新闻发布会' },
    { date: '2026-09-18', title: '日本央行利率决议', desc: '日银9月政策会议，关注是否进一步加息' },
    { date: '2026-09-20', title: 'LPR报价', desc: '9月LPR公布，关注1年期和5年期是否下调' },
    { date: '2026-09-30', title: '制造业PMI', desc: '9月官方制造业PMI，关注景气度是否回升至50以上' },
    { date: '2026-10-01', title: '国庆假期休市', desc: '10月1日-7日休市，10月8日恢复交易' },
    { date: '2026-10-13', title: '9月进出口数据', desc: '海关总署公布9月外贸数据' },
    { date: '2026-10-15', title: '9月CPI/PPI + Q3 GDP', desc: '三季度GDP及9月物价数据同步公布' },
    { date: '2026-10-20', title: 'LPR报价', desc: '10月LPR公布' },
    { date: '2026-10-31', title: '10月制造业PMI', desc: '10月官方制造业PMI数据' },
    { date: '2026-11-05', title: '美联储11月FOMC', desc: '11月议息会议利率决议' },
    { date: '2026-11-07', title: '中国10月进出口数据', desc: '10月外贸数据公布' },
    { date: '2026-11-10', title: '10月CPI/PPI', desc: '10月物价数据公布' },
    { date: '2026-11-30', title: '11月制造业PMI', desc: '11月官方制造业PMI' },
    { date: '2026-12-15', title: '中央经济工作会议', desc: '部署2027年经济工作方向，关注政策基调' }
  ];

  function el(id) { return document.getElementById(id); }

  function parseDate(s) {
    var parts = s.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }

  function formatDate(d) {
    var months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    return { day: String(d.getDate()), month: months[d.getMonth()] };
  }

  function getWeekLabel(date) {
    var monday = new Date(date);
    var day = monday.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);
    var sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    var m1 = monday.getMonth() + 1;
    var d1 = monday.getDate();
    var m2 = sunday.getMonth() + 1;
    var d2 = sunday.getDate();
    return m1 + '/' + d1 + ' - ' + m2 + '/' + d2;
  }

  function render() {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var twoWeeksLater = new Date(today);
    twoWeeksLater.setDate(today.getDate() + 14);

    var upcoming = EVENTS.filter(function(e) {
      var d = parseDate(e.date);
      return d >= today && d <= twoWeeksLater;
    });

    if (upcoming.length === 0) {
      var nearFuture = EVENTS.filter(function(e) {
        return parseDate(e.date) >= today;
      }).slice(0, 6);
      upcoming = nearFuture;
    }

    upcoming.sort(function(a, b) {
      return parseDate(a.date) - parseDate(b.date);
    });

    var list = upcoming.slice(0, 6);

    var col1 = list.slice(0, 2);
    var col2 = list.slice(2, 4);
    var col3 = list.slice(4, 6);
    var cols = [col1, col2, col3];

    var html = '';
    cols.forEach(function(col) {
      html += '<div class="event-list">';
      col.forEach(function(e) {
        var d = parseDate(e.date);
        var fmt = formatDate(d);
        html += '<div class="event-item" style="border-left-color:var(--accent);">' +
          '<div class="event-date"><div class="event-day">' + fmt.day + '</div>' +
          '<div class="event-month">' + fmt.month + '</div></div>' +
          '<div class="event-text"><strong>' + e.title + '</strong>' +
          '<span>' + e.desc + '</span></div></div>';
      });
      html += '</div>';
    });

    var container = el('events-container');
    if (container) {
      container.innerHTML = html;
    }

    var badge = el('events-badge');
    if (badge) {
      badge.textContent = '本周 ' + getWeekLabel(now);
    }

    var lastUpdate = el('events-last-update');
    if (lastUpdate) {
      var y = now.getFullYear();
      var m = String(now.getMonth() + 1).padStart(2, '0');
      var dd = String(now.getDate()).padStart(2, '0');
      lastUpdate.textContent = '数据更新: ' + y + '-' + m + '-' + dd;
    }
  }

  window.EventsCalendar = { render: render };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
