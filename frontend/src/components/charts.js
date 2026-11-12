import Chart from 'chart.js/auto';

const registry = [];
export const destroyCharts = () => registry.splice(0).forEach((c) => c.destroy());

const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const PALETTE = ['#6d5dfc', '#2f9bff', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#ec4899'];

function defaults() {
  Chart.defaults.color = cssVar('--muted') || '#a4a7c9';
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.borderColor = 'rgba(124,92,255,.12)';
}

function track(chart) { registry.push(chart); return chart; }

/** datasets: [{ label, data, color, axis: 'y' | 'y1' }] */
export function lineChart(canvas, labels, datasets, { fill = true } = {}) {
  defaults();
  const ctx = canvas.getContext('2d');
  const dual = datasets.some((d) => d.axis === 'y1');
  return track(new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map((d, i) => {
        const color = d.color || PALETTE[i];
        const g = ctx.createLinearGradient(0, 0, 0, 280);
        g.addColorStop(0, color + '66');
        g.addColorStop(1, color + '00');
        return { label: d.label, data: d.data, borderColor: color, backgroundColor: fill ? g : color, fill, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2.5, yAxisID: d.axis || 'y' };
      }),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: datasets.length > 1, position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8 } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
        y: { beginAtZero: true, ticks: { maxTicksLimit: 5 } },
        ...(dual ? { y1: { position: 'right', grid: { display: false }, ticks: { maxTicksLimit: 5 } } } : {}),
      },
    },
  }));
}

export function barChart(canvas, labels, datasets) {
  defaults();
  return track(new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: datasets.map((d, i) => ({ label: d.label, data: d.data, backgroundColor: d.color || PALETTE[i], borderRadius: 8, maxBarThickness: 36 })) },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: datasets.length > 1, labels: { usePointStyle: true, boxWidth: 8 } } },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { maxTicksLimit: 5 } } },
    },
  }));
}

export function doughnutChart(canvas, labels, data) {
  defaults();
  return track(new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: 0, hoverOffset: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, padding: 12 } } } },
  }));
}
