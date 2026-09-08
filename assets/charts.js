(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var bg3 = style.getPropertyValue('--bg3').trim();
  var up = style.getPropertyValue('--up').trim();
  var down = style.getPropertyValue('--down').trim();
  var flat = style.getPropertyValue('--flat').trim();

  // ===== CHART 1: PMI 走势 =====
  var pmiChart = echarts.init(document.getElementById('chart-pmi'), null, { renderer: 'svg' });
  pmiChart.setOption({
    animation: false,
    tooltip: { trigger: 'axis', appendToBody: true },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: {
      type: 'category',
      data: ['1月','2月','3月','4月','5月','6月','7月'],
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: muted, fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      min: 48,
      max: 51,
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: muted, fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } }
    },
    series: [{
      name: '制造业PMI',
      type: 'line',
      data: [49.3, 49.0, 50.4, 50.3, 50.0, 50.3, 49.2],
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      itemStyle: { color: accent },
      lineStyle: { width: 2.5, color: accent },
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: 'rgba(245,158,11,0.25)' },
          { offset: 1, color: 'rgba(245,158,11,0.02)' }
        ]}
      },
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: flat, type: 'dashed', width: 1 },
        data: [{ yAxis: 50, label: { formatter: '荣枯线', color: muted, fontSize: 10 } }]
      }
    }]
  });
  window.addEventListener('resize', function() { pmiChart.resize(); });

  // ===== SECTOR HEATMAP =====
  var sectors = [
    { name: '贵金属', change: 5.99, flow: '大幅净流入' },
    { name: '有色金属', change: 3.20, flow: '净流入33亿' },
    { name: 'MLCC概念', change: 2.80, flow: '活跃' },
    { name: '工业金属', change: 2.50, flow: '活跃' },
    { name: '消费电子', change: 2.00, flow: '活跃' },
    { name: '小金属', change: 1.80, flow: '活跃' },
    { name: 'CPO概念', change: 1.50, flow: '净流入60亿+' },
    { name: '锂矿', change: 1.30, flow: '融捷涨停' },
    { name: '通信', change: 1.20, flow: '净流入99亿' },
    { name: '地产', change: 1.00, flow: '沪八条催化' },
    { name: '医药生物', change: 0.80, flow: '净流入208亿' },
    { name: '煤炭', change: 0.50, flow: '7日连续净流入' },
    { name: '银行', change: 0.30, flow: '净流入20亿' },
    { name: '新能源车', change: 0.50, flow: '平稳' },
    { name: '光伏', change: -0.30, flow: '平淡' },
    { name: '电子', change: -0.40, flow: '净流出44亿' },
    { name: '军工', change: -0.50, flow: '净流出10亿+' },
    { name: '半导体', change: -0.60, flow: '净流出70亿' },
    { name: '食品饮料', change: -0.70, flow: '回调' },
    { name: '白酒', change: -0.90, flow: '回调' },
    { name: '养殖业', change: -1.20, flow: '回调' },
    { name: '生物疫苗', change: -1.50, flow: '获利了结' },
    { name: '创新药', change: -1.80, flow: '回调' },
    { name: '粮食概念', change: -2.20, flow: '下跌' },
    { name: '种植业', change: -2.50, flow: '下跌' }
  ];

  var heatmapContainer = document.getElementById('sector-heatmap');
  if (heatmapContainer) {
    sectors.forEach(function(s) {
      var tile = document.createElement('div');
      tile.className = 'sector-tile';
      var intensity = Math.min(Math.abs(s.change) / 6, 0.7);
      var bgColor = s.change > 0
        ? 'rgba(239,68,68,' + (0.12 + intensity * 0.5) + ')'
        : 'rgba(34,197,94,' + (0.12 + intensity * 0.5) + ')';
      var textColor = s.change > 0 ? up : down;
      tile.style.background = bgColor;
      tile.innerHTML =
        '<div class="sector-tile-name" style="color:' + ink + '">' + s.name + '</div>' +
        '<div class="sector-tile-change" style="color:' + textColor + '">' +
        (s.change > 0 ? '+' : '') + s.change.toFixed(2) + '%' +
        '</div>' +
        '<div style="font-size:10px;color:' + muted + ';margin-top:2px">' + s.flow + '</div>';
      heatmapContainer.appendChild(tile);
    });
  }

  // ===== CHART 2: 上证指数 K线+成交量 =====
  var shDates = ['07-13','07-14','07-15','07-16','07-17','07-20','07-21','07-22','07-23','07-24','07-27','07-28','07-29','07-30','07-31','08-03','08-04','08-05','08-06','08-07','08-10','08-11','08-12','08-13','08-14','08-17','08-18','08-19','08-20','08-21'];
  var shOHLC = [
    [3966.02,3983.05,3900.67,3913.79],
    [3909.27,3967.13,3869.30,3967.13],
    [3963.73,3981.67,3943.70,3955.58],
    [3912.38,3940.45,3867.60,3882.41],
    [3865.32,3869.21,3745.17,3764.15],
    [3791.66,3831.66,3741.11,3796.28],
    [3812.16,3864.60,3743.36,3864.37],
    [3839.67,3884.44,3839.67,3867.03],
    [3868.09,3878.83,3851.71,3876.78],
    [3853.63,3861.04,3808.64,3814.20],
    [3808.90,3858.31,3793.45,3858.25],
    [3823.13,3844.01,3797.37,3813.31],
    [3823.29,3845.77,3782.48,3828.47],
    [3812.11,3839.34,3767.50,3804.69],
    [3833.54,3847.09,3822.37,3832.26],
    [3812.61,3827.64,3797.64,3809.66],
    [3816.37,3831.94,3799.52,3822.28],
    [3815.12,3884.40,3815.12,3878.43],
    [3864.27,3902.05,3864.27,3900.35],
    [3896.49,3940.93,3885.62,3940.04],
    [3943.82,3967.59,3938.63,3966.59],
    [3950.71,3966.39,3930.64,3934.09],
    [3933.55,3950.62,3927.55,3946.68],
    [3957.16,3968.48,3924.64,3926.96],
    [3930.02,3932.64,3903.70,3927.18],
    [3930.10,3983.51,3924.47,3982.65],
    [3979.49,3994.18,3955.60,3990.30],
    [3952.12,3961.14,3879.58,3894.42],
    [3907.21,3925.06,3888.10,3903.72],
    [3891.18,3912.13,3883.79,3905.20]
  ];
  var shVol = [1.33,1.27,1.23,1.12,1.25,1.29,1.40,1.26,1.03,0.92,1.03,0.95,1.09,1.11,1.19,0.95,1.01,1.21,1.17,1.21,1.17,1.07,0.99,1.16,0.99,1.11,1.14,1.22,1.02,0.88];

  var shChart = echarts.init(document.getElementById('chart-sh-index'), null, { renderer: 'svg' });
  shChart.setOption({
    animation: false,
    tooltip: { trigger: 'axis', appendToBody: true, axisPointer: { type: 'cross' } },
    legend: { data: ['K线','成交额'], textStyle: { color: muted, fontSize: 11 }, top: 0 },
    grid: [
      { left: 50, right: 50, top: 30, height: '55%' },
      { left: 50, right: 50, top: '72%', height: '22%' }
    ],
    xAxis: [
      { type: 'category', data: shDates, scale: true, boundaryGap: false, axisLine: { lineStyle: { color: rule } }, axisLabel: { color: muted, fontSize: 10 }, splitLine: { show: false }, gridIndex: 0 },
      { type: 'category', gridIndex: 1, data: shDates, axisLabel: { show: false }, axisLine: { lineStyle: { color: rule } } }
    ],
    yAxis: [
      { scale: true, gridIndex: 0, axisLine: { lineStyle: { color: rule } }, axisLabel: { color: muted, fontSize: 10 }, splitLine: { lineStyle: { color: rule, type: 'dashed' } } },
      { gridIndex: 1, axisLabel: { color: muted, fontSize: 10, formatter: '{value}万亿' }, splitLine: { show: false } }
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: shOHLC,
        xAxisIndex: 0,
        yAxisIndex: 0,
        itemStyle: { color: up, color0: down, borderColor: up, borderColor0: down }
      },
      {
        name: '成交额',
        type: 'bar',
        data: shVol,
        xAxisIndex: 1,
        yAxisIndex: 1,
        itemStyle: { color: function(p) { return shOHLC[p.dataIndex][3] >= shOHLC[p.dataIndex][0] ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)'; } }
      }
    ]
  });
  window.addEventListener('resize', function() { shChart.resize(); });

  // ===== CHART 3: 创业板指 走势 =====
  var cybClose = [3723.52,3851.14,3804.70,3692.46,3428.63,3443.10,3685.97,3566.73,3575.52,3480.87,3590.79,3327.03,3378.70,3244.62,3343.96,3302.55,3488.97,3535.14,3515.56,3563.12,3537.21,3549.16,3602.08,3586.04,3626.30,3740.16,3705.56,3473.49,3495.59,3545.58];

  var cybChart = echarts.init(document.getElementById('chart-cyb-index'), null, { renderer: 'svg' });
  cybChart.setOption({
    animation: false,
    tooltip: { trigger: 'axis', appendToBody: true },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: shDates,
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: muted, fontSize: 10, interval: 4 }
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: muted, fontSize: 10 },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } }
    },
    series: [{
      type: 'line',
      data: cybClose,
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2, color: accent2 },
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: 'rgba(59,130,246,0.25)' },
          { offset: 1, color: 'rgba(59,130,246,0.02)' }
        ]}
      }
    }]
  });
  window.addEventListener('resize', function() { cybChart.resize(); });


  // ===== PORTFOLIO CHARTS =====
  window.initPortfolioCharts = function() {
    // 持仓占比饼图
    var pieEl = document.getElementById('chart-position-pie');
    if (pieEl && !pieEl.getAttribute('data-init')) {
      pieEl.setAttribute('data-init', '1');
      var pieChart = echarts.init(pieEl, null, { renderer: 'svg' });
      pieChart.setOption({
        animation: false,
        tooltip: { trigger: 'item', appendToBody: true, formatter: '{b}: {c}元 ({d}%)' },
        legend: { bottom: 0, textStyle: { color: muted, fontSize: 12 } },
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
          data: [
            { value: 8048, name: '烽火通信', itemStyle: { color: up } },
            { value: 6346, name: '旭光电子', itemStyle: { color: accent } },
            { value: 442.4, name: '芯片ETF', itemStyle: { color: '#a855f7' } },
            { value: 312.6, name: '5GETF', itemStyle: { color: accent2 } },
            { value: 8171.33, name: '现金', itemStyle: { color: flat } }
          ],
          label: { color: ink, fontSize: 12 },
          labelLine: { lineStyle: { color: rule } }
        }]
      });
      window.addEventListener('resize', function() { pieChart.resize(); });
    }

    // 持仓盈亏柱状图
    var barEl = document.getElementById('chart-pnl-bar');
    if (barEl && !barEl.getAttribute('data-init')) {
      barEl.setAttribute('data-init', '1');
      var barChart = echarts.init(barEl, null, { renderer: 'svg' });
      barChart.setOption({
        animation: false,
        tooltip: { trigger: 'axis', appendToBody: true, formatter: '{b}<br/>盈亏: {c}元' },
        grid: { left: 60, right: 20, top: 20, bottom: 40 },
        xAxis: {
          type: 'category',
          data: ['烽火通信', '旭光电子', '芯片ETF', '5GETF'],
          axisLine: { lineStyle: { color: rule } },
          axisLabel: { color: muted, fontSize: 11 }
        },
        yAxis: {
          type: 'value',
          axisLine: { lineStyle: { color: rule } },
          axisLabel: { color: muted, fontSize: 10, formatter: '{value}元' },
          splitLine: { lineStyle: { color: rule, type: 'dashed' } }
        },
        series: [{
          type: 'bar',
          data: [
            { value: 42.92, itemStyle: { color: up } },
            { value: -131.06, itemStyle: { color: down } },
            { value: -86.80, itemStyle: { color: down } },
            { value: -59.80, itemStyle: { color: down } }
          ],
          barWidth: '40%',
          label: { show: true, position: 'top', color: ink, fontSize: 11, formatter: '{c}元' }
        }]
      });
      window.addEventListener('resize', function() { barChart.resize(); });
    }

    // 全年收益曲线对比图
    var annualEl = document.getElementById('chart-annual-performance');
    if (annualEl && !annualEl.getAttribute('data-init')) {
      annualEl.setAttribute('data-init', '1');
      var annualChart = echarts.init(annualEl, null, { renderer: 'svg' });
      var annualDates = ['06-01','06-05','06-10','06-15','06-20','06-25','06-30','07-05','07-10','07-15','07-20','07-25','07-30','08-05','08-10','08-15','08-21'];
      var myReturn = [0, -1, -2, -3, -2.5, -3, -2, -1.5, -2, -1.5, -1, -0.5, -0.8, -1.2, -1.5, -1.2, -1.00];
      var shReturn = [0, -1, -2, -3, -2, -4, -5, -6, -7, -8, -7, -6, -5, -6, -7, -6.5, -6.34];
      annualChart.setOption({
        animation: false,
        tooltip: { trigger: 'axis', appendToBody: true, formatter: function(params) {
          var s = params[0].axisValue + '<br/>';
          params.forEach(function(p) { s += p.marker + p.seriesName + ': ' + p.value + '%<br/>'; });
          return s;
        }},
        legend: { data: ['我的收益', '上证指数'], textStyle: { color: muted, fontSize: 11 }, top: 0 },
        grid: { left: 50, right: 20, top: 35, bottom: 30 },
        xAxis: {
          type: 'category',
          data: annualDates,
          axisLine: { lineStyle: { color: rule } },
          axisLabel: { color: muted, fontSize: 10, interval: 3 }
        },
        yAxis: {
          type: 'value',
          axisLine: { lineStyle: { color: rule } },
          axisLabel: { color: muted, fontSize: 10, formatter: '{value}%' },
          splitLine: { lineStyle: { color: rule, type: 'dashed' } }
        },
        series: [
          {
            name: '我的收益',
            type: 'line',
            data: myReturn,
            smooth: true,
            symbol: 'none',
            lineStyle: { width: 2, color: up },
            itemStyle: { color: up },
            areaStyle: {
              color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
                { offset: 0, color: 'rgba(239,68,68,0.15)' },
                { offset: 1, color: 'rgba(239,68,68,0.01)' }
              ]}
            }
          },
          {
            name: '上证指数',
            type: 'line',
            data: shReturn,
            smooth: true,
            symbol: 'none',
            lineStyle: { width: 2, color: accent2 },
            itemStyle: { color: accent2 }
          }
        ]
      });
      window.addEventListener('resize', function() { annualChart.resize(); });
    }
  };

  // ===== RECAP CHARTS =====
  window.initRecapCharts = function() {
  };

})();
