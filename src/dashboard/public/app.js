// ═══════════════════════════════════════════════════════════
// PolyAlpha v5 — Dashboard Frontend Logic
// ═══════════════════════════════════════════════════════════

let currentMode = 'all';
let scanResults = [];
let isScanning = false;

// ─── Set Active Mode Tab ───
function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.tab').forEach(t => {
    t.className = 'tab';
  });

  const tabId = mode === 'all' ? 'tabAll' : mode === 'sprint' ? 'tabSprint' : 'tabMarathon';
  const activeClass = mode === 'marathon' ? 'active-marathon' : 'active-sprint';
  document.getElementById(tabId).classList.add(activeClass);

  renderMarkets();
}

// ─── Run Market Scan ───
async function runScan() {
  if (isScanning) return;
  isScanning = true;

  const btn = document.getElementById('scanBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;margin:0"></span> Scanning...';

  const grid = document.getElementById('marketGrid');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Analyzing markets through 6-layer engine...</p><p style="font-size:0.8rem;margin-top:8px;color:#555570">Running: Alpha → Bayesian → Edge → Kill Chain</p></div>';

  const balance = document.getElementById('balanceSelect').value;

  try {
    const res = await fetch(`/api/scan?mode=${currentMode}&top=12&balance=${balance}`);
    const data = await res.json();

    scanResults = data.results || [];
    updateStats(data);
    renderMarkets();
    updateRiskPanel();
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><h2>❌ Scan Failed</h2><p>${err.message}</p></div>`;
  }

  btn.disabled = false;
  btn.innerHTML = '🔍 Scan Markets';
  isScanning = false;
}

// ─── Update Stats Bar ───
function updateStats(data) {
  document.getElementById('statTotal').textContent = data.total || 0;
  document.getElementById('statExecuted').textContent = data.executed || 0;
  document.getElementById('statKilled').textContent = data.killed || 0;
  document.getElementById('statKillRate').textContent = data.kill_rate || '0%';

  const results = data.results || [];
  const edges = results.filter(r => r.market_edge).map(r => Math.abs(r.market_edge));
  const avgEdge = edges.length > 0
    ? (edges.reduce((s, e) => s + e, 0) / edges.length * 100).toFixed(1) + '%'
    : '—';
  document.getElementById('statAvgEdge').textContent = avgEdge;
}

// ─── Update Risk Panel ───
async function updateRiskPanel() {
  try {
    const res = await fetch('/api/risk');
    const data = await res.json();
    const state = data.state || {};

    document.getElementById('dailyPnl').textContent =
      `$${(state.dailyPnL || 0).toFixed(2)}`;
    document.getElementById('totalPnl').textContent =
      `$${(state.totalPnL || 0).toFixed(2)}`;
    document.getElementById('tradesToday').textContent =
      `${state.tradesToday || 0}/5`;
    document.getElementById('openTrades').textContent =
      `${state.openTrades || 0}/6`;

    // Breaker dots
    setBreakerDot('dailyBreakerDot',
      (state.dailyPnLPct || 0) > -0.03 ? 'green' :
        (state.dailyPnLPct || 0) > -0.05 ? 'yellow' : 'red');

    setBreakerDot('totalBreakerDot',
      (state.totalPnLPct || 0) > -0.05 ? 'green' :
        (state.totalPnLPct || 0) > -0.1 ? 'yellow' : 'red');

  } catch { /* ignore */ }
}

function setBreakerDot(id, color) {
  const dot = document.getElementById(id);
  dot.className = `risk-dot ${color}`;
}

// ─── Render Market Cards ───
function renderMarkets() {
  const grid = document.getElementById('marketGrid');

  let filtered = scanResults;
  if (currentMode === 'sprint') filtered = scanResults.filter(r => r.mode === 'SPRINT');
  if (currentMode === 'marathon') filtered = scanResults.filter(r => r.mode === 'MARATHON');

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state"><h2>No results</h2><p>Click scan or switch tabs</p></div>';
    return;
  }

  // Sort: executed first, then by |edge| descending
  filtered.sort((a, b) => {
    const aExec = a.execution?.action !== 'HOLD' && a.execution?.action !== 'KILLED' ? 1 : 0;
    const bExec = b.execution?.action !== 'HOLD' && b.execution?.action !== 'KILLED' ? 1 : 0;
    if (aExec !== bExec) return bExec - aExec;
    return Math.abs(b.market_edge || 0) - Math.abs(a.market_edge || 0);
  });

  grid.innerHTML = filtered.map(r => renderCard(r)).join('');
}

function renderCard(r) {
  if (r.error) {
    return `<div class="market-card hold"><div class="card-header"><div class="card-title">${esc(r.market_name || 'Error')}</div></div><div class="card-signal">❌ ${esc(r.error)}</div></div>`;
  }

  const action = r.execution?.action || r.recommended_action || 'HOLD';
  const actionClass = action === 'BUY_YES' ? 'buy-yes' : action === 'BUY_NO' ? 'buy-no' : action === 'KILLED' ? 'killed' : 'hold';
  const modeClass = r.mode === 'SPRINT' ? 'sprint' : 'marathon';
  const modeLabel = r.mode === 'SPRINT' ? '⚡ Sprint' : '🏔️ Marathon';

  const edge = r.market_edge || 0;
  const edgeColor = edge > 0.05 ? 'green' : edge < -0.05 ? 'red' : '';
  const conf = r.confidence_score || 0;
  const confColor = conf > 0.8 ? 'green' : conf > 0.6 ? 'amber' : 'red';

  // Gate dots
  const gates = r.execution?.gates || [];
  const gateDots = gates.map(g =>
    `<div class="gate-dot ${g.pass ? 'pass' : 'fail'}" title="${esc(g.gate)}: ${esc(g.reason)}"></div>`
  ).join('');

  return `
    <div class="market-card ${actionClass}">
      <div class="card-header">
        <div class="card-title">${esc(r.market_name || 'Unknown')}</div>
        <div class="card-mode ${modeClass}">${modeLabel}</div>
      </div>
      <div class="card-metrics">
        <div class="metric">
          <div class="metric-value ${edgeColor}">${(edge * 100).toFixed(1)}%</div>
          <div class="metric-label">Edge</div>
        </div>
        <div class="metric">
          <div class="metric-value ${confColor}">${(conf * 100).toFixed(0)}%</div>
          <div class="metric-label">Confidence</div>
        </div>
        <div class="metric">
          <div class="metric-value">${((r.market_price || 0) * 100).toFixed(0)}¢</div>
          <div class="metric-label">Price</div>
        </div>
      </div>
      <div class="card-action">
        <span class="action-badge ${actionClass}">${action.replace('_', ' ')}</span>
        <span class="bet-size">${r.execution?.betSize > 0 ? '$' + r.execution.betSize.toFixed(2) : action === 'KILLED' ? '🛑 ' + (r.execution?.killedAt || '') : '—'}</span>
      </div>
      ${r.key_signal ? `<div class="card-signal">"${esc(r.key_signal.slice(0, 100))}"</div>` : ''}
      ${gateDots ? `<div class="card-gates" title="5-Gate Kill Chain">${gateDots}</div>` : ''}
    </div>
  `;
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ─── Auto-Update Risk ───
setInterval(updateRiskPanel, 30000);
