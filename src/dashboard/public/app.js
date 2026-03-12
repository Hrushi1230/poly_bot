// ═══════════════════════════════════════════════════════════
// PolyAlpha v5.1 — Dashboard Frontend
// Triple Mode + Exit Monitor
// ═══════════════════════════════════════════════════════════

let currentMode = 'all';
let scanResults = [];
let scanning = false;

// ─── Mode Tabs ───
function setMode(mode) {
  currentMode = mode;

  // Reset all tabs
  document.querySelectorAll('.tab').forEach(t => {
    t.className = 'tab';
  });

  // Set active tab
  const tabMap = { all: 'tabAll', sprint: 'tabSprint', swing: 'tabSwing', marathon: 'tabMarathon' };
  const activeClass = mode === 'sprint' ? 'active-sprint'
    : mode === 'swing' ? 'active-swing'
    : mode === 'marathon' ? 'active-marathon'
    : 'active-sprint';
  document.getElementById(tabMap[mode]).classList.add(activeClass);

  renderResults();
}

// ─── Scan Markets ───
async function scanMarkets() {
  if (scanning) return;
  scanning = true;

  const btn = document.querySelector('.btn-scan');
  btn.textContent = '⏳ Scanning...';
  btn.disabled = true;

  const balance = document.getElementById('balanceSelect').value;

  try {
    const res = await fetch(`/api/scan?mode=${currentMode}&top=50&balance=${balance}`);
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    scanResults = data.results || [];

    // Update stats
    document.getElementById('statAnalyzed').textContent = data.total || 0;
    document.getElementById('statActionable').textContent = data.executed || 0;
    document.getElementById('statKilled').textContent = data.killed || 0;
    document.getElementById('statKillRate').textContent = data.kill_rate || '0%';

    const edges = scanResults.filter(r => r.edge).map(r => Math.abs(r.edge));
    const avgEdge = edges.length > 0
      ? `${(edges.reduce((a, b) => a + b, 0) / edges.length * 100).toFixed(1)}%`
      : '—';
    document.getElementById('statAvgEdge').textContent = avgEdge;

    renderResults();
    loadRisk();
    loadExits();
  } catch (err) {
    document.getElementById('marketGrid').innerHTML =
      `<div class="empty-state"><h3>Scan failed</h3><p>${err.message}</p></div>`;
  }

  btn.textContent = '🔍 Scan Markets';
  btn.disabled = false;
  scanning = false;
}

// ─── Load Risk State ───
async function loadRisk() {
  try {
    const res = await fetch('/api/risk');
    const data = await res.json();
    const s = data.state || {};
    document.getElementById('tradeBreaker').textContent = s.halted ? '⛔ HALTED' : 'OK';
    document.getElementById('dailyPnl').textContent = `$${(s.dailyPnl || 0).toFixed(2)}`;
    document.getElementById('totalPnl').textContent = `$${(s.totalPnl || 0).toFixed(2)}`;
    document.getElementById('tradesToday').textContent = s.tradesToday || 0;
    document.getElementById('openTrades').textContent = s.openTrades || 0;
  } catch {}
}

// ─── Load Exits ───
async function loadExits() {
  try {
    const res = await fetch('/api/exits');
    const data = await res.json();

    const section = document.getElementById('exitSection');
    const open = data.open || [];
    const closed = data.closed || [];
    const stats = data.stats || {};

    if (open.length === 0 && closed.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    // Render stats
    const statsHtml = `
      <div class="exit-stat-card"><span class="value">${stats.totalExits || 0}</span><span class="label">TOTAL EXITS</span></div>
      <div class="exit-stat-card"><span class="value profit">${stats.wins || 0}</span><span class="label">WINS</span></div>
      <div class="exit-stat-card"><span class="value loss">${stats.losses || 0}</span><span class="label">LOSSES</span></div>
      <div class="exit-stat-card"><span class="value ${stats.totalPnL >= 0 ? 'profit' : 'loss'}">${stats.winRate || '0%'}</span><span class="label">WIN RATE</span></div>
      <div class="exit-stat-card"><span class="value ${stats.totalPnL >= 0 ? 'profit' : 'loss'}">$${(stats.totalPnL || 0).toFixed(2)}</span><span class="label">NET P&L</span></div>
      <div class="exit-stat-card"><span class="value">${open.length}</span><span class="label">OPEN NOW</span></div>
    `;
    document.getElementById('exitStats').innerHTML = statsHtml;

    // Render exit cards
    let cardsHtml = '';

    // Open positions first
    for (const p of open) {
      cardsHtml += `
        <div class="exit-card" style="border-left: 3px solid var(--orange);">
          <h4>⏳ ${(p.market_name || '').slice(0, 60)}</h4>
          <div class="exit-details">
            <span>Entry: ${(p.entryPrice * 100).toFixed(0)}¢</span>
            <span>Mode: ${p.mode}</span>
            <span>Side: ${p.side}</span>
            <span>Held: ${(p.hoursHeld || 0).toFixed(1)}h</span>
          </div>
          <div class="exit-pnl" style="color: var(--orange);">MONITORING...</div>
        </div>
      `;
    }

    // Closed positions
    for (const p of closed.slice(0, 12)) {
      const isProfitable = p.netPnL > 0;
      const emoji = p.exitReason === 'TAKE_PROFIT' ? '💰'
        : p.exitReason === 'TRAILING_STOP' ? '📈'
        : p.exitReason === 'STOP_LOSS' ? '🛑'
        : '⏰';
      cardsHtml += `
        <div class="exit-card ${isProfitable ? 'profit' : 'loss'}">
          <h4>${emoji} ${(p.market_name || '').slice(0, 60)}</h4>
          <div class="exit-details">
            <span>Entry: ${(p.entryPrice * 100).toFixed(0)}¢</span>
            <span>Exit: ${(p.exitPrice * 100).toFixed(0)}¢</span>
            <span>Mode: ${p.mode}</span>
            <span>Held: ${p.hoursHeld}h</span>
          </div>
          <div class="exit-pnl ${isProfitable ? 'profit' : 'loss'}">
            ${isProfitable ? '+' : ''}${(p.pnlPerShare * 100).toFixed(1)}¢/share
            <span class="exit-reason-tag reason-${p.exitReason}">${p.exitReason.replace('_', ' ')}</span>
          </div>
        </div>
      `;
    }

    document.getElementById('exitGrid').innerHTML = cardsHtml;
  } catch {}
}

// ─── Render Results ───
function renderResults() {
  const grid = document.getElementById('marketGrid');

  let filtered = scanResults;
  if (currentMode === 'sprint') filtered = scanResults.filter(r => r.mode === 'SPRINT');
  if (currentMode === 'swing') filtered = scanResults.filter(r => r.mode === 'SWING');
  if (currentMode === 'marathon') filtered = scanResults.filter(r => r.mode === 'MARATHON');

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state"><h3>No results</h3><p>Click scan or switch tabs</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(r => renderCard(r)).join('');
}

// ─── Render Single Card ───
function renderCard(r) {
  if (r.error) {
    return `<div class="market-card"><div class="card-header"><h3>${r.market_name || 'Unknown'}</h3></div><p style="color:var(--red);font-size:11px;">${r.error}</p></div>`;
  }

  const modeClass = r.mode === 'SPRINT' ? 'sprint' : r.mode === 'SWING' ? 'swing' : 'marathon';
  const modeLabel = r.mode === 'SPRINT' ? '⚡ Sprint' : r.mode === 'SWING' ? '🔥 Swing' : '🏔️ Marathon';
  const exec = r.execution || {};
  const action = exec.action || 'HOLD';

  let actionClass = 'action-hold';
  let actionLabel = 'HOLD';
  if (action === 'BUY_YES') { actionClass = 'action-buy-yes'; actionLabel = '✅ BUY YES'; }
  else if (action === 'BUY_NO') { actionClass = 'action-buy-no'; actionLabel = '❌ BUY NO'; }
  else if (action === 'KILLED') { actionClass = 'action-killed'; actionLabel = '💀 KILLED'; }

  const edge = r.edge ? `${(Math.abs(r.edge) * 100).toFixed(1)}%` : '—';
  const confidence = r.confidence ? `${(r.confidence * 100).toFixed(0)}%` : '—';
  const price = r.current_price ? `${Math.round(r.current_price * 100)}¢` : '—';

  const reason = exec.killedAt
    ? exec.gates?.find(g => !g.pass)?.reason || ''
    : r.reasoning || '';

  // Profit target for this mode
  const targetCents = r.mode === 'SPRINT' ? '10¢' : r.mode === 'SWING' ? '15¢' : '20¢';

  return `
    <div class="market-card">
      <div class="card-header">
        <h3>${(r.market_name || '').slice(0, 70)}</h3>
        <span class="mode-badge badge-${modeClass}">${modeLabel}</span>
      </div>
      <div class="card-metrics">
        <div class="metric">
          <div class="metric-value" style="color:${parseFloat(edge) > 10 ? 'var(--green)' : 'var(--text)'}">${edge}</div>
          <div class="metric-label">EDGE</div>
        </div>
        <div class="metric">
          <div class="metric-value">${confidence}</div>
          <div class="metric-label">CONFIDENCE</div>
        </div>
        <div class="metric">
          <div class="metric-value">${price}</div>
          <div class="metric-label">PRICE</div>
        </div>
      </div>
      <div class="card-action">
        <span class="action-tag ${actionClass}">${actionLabel}</span>
        <span class="card-reason" style="font-size:9px;color:var(--text-dim);">Target: +${targetCents}</span>
      </div>
      <div class="card-reason">${reason ? `"${reason.slice(0, 80)}"` : ''}</div>
    </div>
  `;
}

// ─── Init ───
setMode('all');
loadRisk();
loadExits();
