// ============================================================
// VigApp — Dashboard / Statistics Page
// ============================================================
import { icon, ICONS } from '../icons.js';
import { getDocuments } from '../utils/firestore.js';
import { formatCurrency, formatNumber, formatPercent, timeAgo } from '../utils/format.js';

export async function renderDashboardPage(container) {
  container.innerHTML = `
    <div class="page-content animate-fade-in">
      <div class="page-header">
        <div class="page-header-info">
          <h1>Dashboard</h1>
          <p>Visao geral do seu negocio</p>
        </div>
      </div>

      <div class="grid-stats stagger-children" id="stats-grid">
        <div class="card stat-card">
          <div class="card-header">
            <span class="card-title">Receita Total</span>
            <div class="stat-icon">${icon(ICONS.dollarSign, { size: 20 })}</div>
          </div>
          <div class="card-value" id="stat-revenue">R$ 0,00</div>
          <div class="card-footer">
            <span class="stat-change positive" id="stat-revenue-change">${icon(ICONS.arrowUp, { size: 14 })} 0%</span>
            <span>vs mes anterior</span>
          </div>
        </div>

        <div class="card stat-card">
          <div class="card-header">
            <span class="card-title">Negocios Fechados</span>
            <div class="stat-icon">${icon(ICONS.target, { size: 20 })}</div>
          </div>
          <div class="card-value" id="stat-deals">0</div>
          <div class="card-footer">
            <span>total de negocios ganhos</span>
          </div>
        </div>

        <div class="card stat-card">
          <div class="card-header">
            <span class="card-title">Taxa de Conversao</span>
            <div class="stat-icon">${icon(ICONS.barChart, { size: 20 })}</div>
          </div>
          <div class="card-value" id="stat-conversion">0%</div>
          <div class="card-footer">
            <span>de leads para clientes</span>
          </div>
        </div>

        <div class="card stat-card">
          <div class="card-header">
            <span class="card-title">Leads Capturados</span>
            <div class="stat-icon">${icon(ICONS.leads, { size: 20 })}</div>
          </div>
          <div class="card-value" id="stat-leads">0</div>
          <div class="card-footer">
            <span>total de leads</span>
          </div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Pipeline por Estagio</span>
          </div>
          <div id="pipeline-chart" class="dashboard-chart-container">
            <canvas id="pipeline-canvas" class="chart-canvas"></canvas>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">Ranking de Servicos</span>
          </div>
          <div class="ranking-list" id="services-ranking">
            <div class="empty-state" style="padding: 20px;">
              <p>Sem dados ainda</p>
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top: 20px;">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Atividade Recente</span>
          </div>
          <div class="activity-list" id="activity-list">
            <div class="empty-state" style="padding: 20px;">
              <p>Nenhuma atividade recente</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Load data
  await loadDashboardData();
}

async function loadDashboardData() {
  try {
    // Fetch all deals, leads, and payments in parallel for better performance
    const [deals, leads, payments] = await Promise.all([
      getDocuments('deals'),
      getDocuments('leads'),
      getDocuments('payments')
    ]);

    // Calculate stats
    const closedWon = deals.filter(d => d.stage === 'closed-won');
    const closedLost = deals.filter(d => d.stage === 'closed-lost');
    const totalDeals = closedWon.length + closedLost.length;
    const conversionRate = totalDeals > 0 ? (closedWon.length / totalDeals) * 100 : 0;
    const totalRevenue = closedWon.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);

    // Update stat cards
    document.getElementById('stat-revenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('stat-deals').textContent = formatNumber(closedWon.length);
    document.getElementById('stat-conversion').textContent = formatPercent(conversionRate);
    document.getElementById('stat-leads').textContent = formatNumber(leads.length);

    // Service ranking
    const serviceCount = {};
    closedWon.forEach(d => {
      if (d.serviceName) {
        serviceCount[d.serviceName] = (serviceCount[d.serviceName] || 0) + 1;
      }
    });

    const ranked = Object.entries(serviceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (ranked.length > 0) {
      const rankingEl = document.getElementById('services-ranking');
      rankingEl.innerHTML = ranked.map(([name, count], i) => `
        <div class="ranking-item">
          <div class="ranking-position">${i + 1}</div>
          <div class="ranking-info">
            <div class="ranking-name">${name}</div>
            <div class="ranking-count">${count} negocio${count > 1 ? 's' : ''} fechado${count > 1 ? 's' : ''}</div>
          </div>
        </div>
      `).join('');
    }

    // Pipeline chart (simple bar chart using canvas)
    drawPipelineChart(deals);

    // Recent activity
    const allItems = [
      ...deals.map(d => ({ type: 'deal', text: `Negocio "${d.companyName || 'Sem nome'}" movido para ${stageLabel(d.stage)}`, date: d.updatedAt, user: d.updatedBy?.name })),
      ...leads.slice(0, 5).map(l => ({ type: 'lead', text: `Lead "${l.name}" capturado`, date: l.capturedAt, user: l.capturedBy?.name })),
    ].filter(a => a.date).sort((a, b) => {
      const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return db2 - da;
    }).slice(0, 8);

    if (allItems.length > 0) {
      const activityEl = document.getElementById('activity-list');
      activityEl.innerHTML = allItems.map(a => `
        <div class="activity-item">
          <div class="activity-dot"></div>
          <div>
            <div class="activity-text">${a.text}</div>
            <div class="activity-time">${timeAgo(a.date)}${a.user ? ` — ${a.user}` : ''}</div>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.warn('Dashboard data load error (Firebase may not be configured):', err);
  }
}

function stageLabel(stage) {
  const labels = {
    'lead': 'Lead',
    'contact': 'Contato',
    'proposal': 'Proposta',
    'negotiation': 'Negociacao',
    'closed-won': 'Fechado (Ganho)',
    'closed-lost': 'Fechado (Perdido)',
  };
  return labels[stage] || stage;
}

function drawPipelineChart(deals) {
  const canvas = document.getElementById('pipeline-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  const stages = ['lead', 'contact', 'proposal', 'negotiation', 'closed-won', 'closed-lost'];
  const labels = ['Lead', 'Contato', 'Proposta', 'Negociacao', 'Ganho', 'Perdido'];
  const counts = stages.map(s => deals.filter(d => d.stage === s).length);
  const maxCount = Math.max(...counts, 1);

  const w = rect.width;
  const h = rect.height;
  const padding = { top: 20, right: 20, bottom: 50, left: 20 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const barWidth = (chartW / stages.length) * 0.6;
  const gap = (chartW / stages.length) * 0.4;

  // Get computed color
  const computedStyle = getComputedStyle(document.documentElement);
  const textColor = computedStyle.getPropertyValue('--text-tertiary').trim();
  const accentColor = computedStyle.getPropertyValue('--accent').trim();
  const dangerColor = computedStyle.getPropertyValue('--danger').trim();
  const borderColor = computedStyle.getPropertyValue('--border-primary').trim();

  // Grid lines
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
  }

  // Bars
  stages.forEach((stage, i) => {
    const x = padding.left + i * (barWidth + gap) + gap / 2;
    const barH = (counts[i] / maxCount) * chartH;
    const y = padding.top + chartH - barH;

    // Bar
    ctx.fillStyle = stage === 'closed-lost' ? dangerColor : accentColor;
    ctx.beginPath();
    const radius = 4;
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + barWidth - radius, y);
    ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
    ctx.lineTo(x + barWidth, y + barH);
    ctx.lineTo(x, y + barH);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.fill();

    // Count label
    ctx.fillStyle = textColor;
    ctx.font = '600 12px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(counts[i], x + barWidth / 2, y - 6);

    // Stage label
    ctx.fillStyle = textColor;
    ctx.font = '400 11px Inter';
    ctx.fillText(labels[i], x + barWidth / 2, h - padding.bottom + 20);
  });
}
