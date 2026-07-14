// ============================================================
// VigApp — Leads Capture Page (OpenStreetMap: Leaflet + Nominatim + Overpass)
// ============================================================
// Free, key-less, no-credit-card stack that replaces Google Maps/Places:
//   - Leaflet + OpenStreetMap tiles  -> the map
//   - Nominatim (nominatim.openstreetmap.org) -> geocode "city" to an area
//   - Overpass API (overpass-api.de)  -> find businesses of a niche in that area
// OSM has no ratings/reviews (those are Google-proprietary), so "potential
// lead" is driven by the absence of a website — the app's core signal.
import { icon, ICONS } from '../icons.js';
import { showToast } from '../components/toast.js';
import { createDocument, getDocuments } from '../utils/firestore.js';

let leads = [];
let mapInstance = null;
let markerLayer = null;
let searchResults = [];
let leafletPromise = null;
// placeIds of search results the user has ticked for bulk "save as company".
let selectedIds = new Set();

const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

// pt-BR niche keywords -> OSM tag filter (Overpass syntax).
const NICHE_TAGS = [
  { kw: ['restaurante', 'restaurantes'], f: '["amenity"="restaurant"]' },
  { kw: ['lanchonete', 'lanchonetes', 'fast food', 'hamburgueria'], f: '["amenity"="fast_food"]' },
  { kw: ['bar', 'bares', 'pub'], f: '["amenity"="bar"]' },
  { kw: ['cafe', 'café', 'cafeteria'], f: '["amenity"="cafe"]' },
  { kw: ['padaria', 'padarias'], f: '["shop"="bakery"]' },
  { kw: ['academia', 'academias', 'fitness'], f: '["leisure"="fitness_centre"]' },
  { kw: ['clinica', 'clínica', 'clinicas'], f: '["amenity"="clinic"]' },
  { kw: ['dentista', 'dentistas', 'odonto', 'odontologia'], f: '["amenity"="dentist"]' },
  { kw: ['farmacia', 'farmácia', 'drogaria'], f: '["amenity"="pharmacy"]' },
  { kw: ['hotel', 'hoteis', 'hotéis', 'pousada'], f: '["tourism"="hotel"]' },
  { kw: ['salao', 'salão', 'cabeleireiro', 'beleza'], f: '["shop"="hairdresser"]' },
  { kw: ['barbearia', 'barbearias', 'barbeiro'], f: '["shop"="hairdresser"]' },
  { kw: ['petshop', 'pet shop', 'pet'], f: '["shop"="pet"]' },
  { kw: ['mercado', 'supermercado', 'mercearia'], f: '["shop"="supermarket"]' },
  { kw: ['roupa', 'roupas', 'moda', 'boutique'], f: '["shop"="clothes"]' },
  { kw: ['oficina', 'mecanica', 'mecânica'], f: '["shop"="car_repair"]' },
  { kw: ['escola', 'escolas', 'colegio', 'colégio'], f: '["amenity"="school"]' },
  { kw: ['advogado', 'advocacia', 'juridico', 'jurídico'], f: '["office"="lawyer"]' },
  { kw: ['imobiliaria', 'imobiliária', 'imoveis', 'imóveis'], f: '["office"="estate_agent"]' },
  { kw: ['hospital', 'hospitais'], f: '["amenity"="hospital"]' },
  { kw: ['loja', 'lojas', 'comercio', 'comércio'], f: '["shop"]' },
];

export async function renderLeadsPage(container) {
  container.innerHTML = `
    <div class="page-content animate-fade-in">
      <div class="page-header">
        <div class="page-header-info">
          <h1>Captura de Leads</h1>
          <p>Busque empresas no OpenStreetMap e capture leads potenciais (sem site)</p>
        </div>
      </div>

      <div class="leads-search-section">
        <div class="search-bar" style="flex: 1; min-width: 300px;">
          ${icon(ICONS.search, { size: 16, class: 'icon search-icon' })}
          <input type="text" id="leads-search-input" placeholder="Nicho: restaurantes, clinicas, academias..." />
        </div>
        <input type="text" class="form-input" id="leads-location" placeholder="Cidade (ex: Sao Paulo)" style="width: 220px;" />
        <button class="btn btn-primary" id="btn-search-leads">
          ${icon(ICONS.search, { size: 16 })} Buscar
        </button>
      </div>

      <div class="leads-map-container" id="leads-map">
        <div class="empty-state" style="height: 100%; display: flex;">
          ${icon(ICONS.mapPin, { size: 40, class: 'icon' })}
          <h3>Mapa</h3>
          <p>Faca uma busca para ver as empresas no mapa</p>
        </div>
      </div>

      <div class="filters-bar">
        <div class="search-bar" style="max-width: 300px;">
          ${icon(ICONS.search, { size: 16, class: 'icon search-icon' })}
          <input type="text" id="filter-leads" placeholder="Filtrar resultados..." />
        </div>
        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.875rem; cursor: pointer;">
          <input type="checkbox" id="filter-no-website" checked style="width: 16px; height: 16px; accent-color: var(--accent);" />
          Apenas sem website
        </label>
        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.875rem; cursor: pointer;">
          <input type="checkbox" id="filter-potential-only" style="width: 16px; height: 16px; accent-color: var(--accent);" />
          Apenas potenciais
        </label>
        <span class="text-sm text-secondary" id="results-count"></span>
      </div>

      <div class="leads-bulk-bar" id="leads-bulk-bar" style="display: none;">
        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.875rem; cursor: pointer;">
          <input type="checkbox" id="bulk-select-all" style="width: 16px; height: 16px; accent-color: var(--accent);" />
          Selecionar todas
        </label>
        <span class="text-sm text-secondary" id="bulk-count">0 selecionada(s)</span>
        <button class="btn btn-sm btn-primary" id="btn-bulk-save-companies">
          ${icon(ICONS.companies, { size: 14 })} Salvar selecionadas como empresas
        </button>
      </div>

      <div class="leads-grid" id="leads-results">
        <div class="empty-state">
          ${icon(ICONS.leads, { size: 40, class: 'icon' })}
          <h3>Busque por um nicho</h3>
          <p>Digite um segmento e uma cidade para encontrar empresas</p>
        </div>
      </div>

      <div style="margin-top: 28px;">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Leads Salvos</span>
            <span class="badge badge-default" id="saved-leads-count">0</span>
          </div>
          <div id="saved-leads-list">
            <div class="empty-state" style="padding: 20px;"><p>Nenhum lead salvo ainda</p></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-search-leads')?.addEventListener('click', searchLeads);
  document.getElementById('leads-search-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchLeads();
  });
  document.getElementById('leads-location')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchLeads();
  });
  document.getElementById('filter-leads')?.addEventListener('input', renderResults);
  document.getElementById('filter-no-website')?.addEventListener('change', renderResults);
  document.getElementById('filter-potential-only')?.addEventListener('change', renderResults);

  document.getElementById('bulk-select-all')?.addEventListener('change', (e) => {
    const filtered = getFilteredResults();
    if (e.target.checked) filtered.forEach(r => selectedIds.add(r.placeId));
    else filtered.forEach(r => selectedIds.delete(r.placeId));
    renderResults();
  });
  document.getElementById('btn-bulk-save-companies')?.addEventListener('click', bulkSaveAsCompanies);

  await loadSavedLeads();
  initMap();
}

// ---------- Map (Leaflet + OpenStreetMap tiles) ----------
function ensureLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar o Leaflet'));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

async function initMap() {
  try {
    await ensureLeaflet();
    createMap();
  } catch (err) {
    console.warn('Map init failed:', err);
  }
}

function createMap() {
  const el = document.getElementById('leads-map');
  if (!el || !window.L || mapInstance) return;

  el.innerHTML = '';
  mapInstance = L.map(el, { zoomControl: true, attributionControl: true })
    .setView([-14.235, -51.9253], 4); // Brazil

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(mapInstance);

  markerLayer = L.layerGroup().addTo(mapInstance);
  // The container starts at a fixed CSS height; make sure Leaflet measures it.
  setTimeout(() => mapInstance.invalidateSize(), 100);
}

// ---------- Search (Nominatim geocode -> Overpass POI query) ----------
function normalize(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .split("")
    .filter(ch => { const c = ch.charCodeAt(0); return c < 0x0300 || c > 0x036f; })
    .join("")
    .trim();
}

function nicheFilter(query) {
  const q = normalize(query);
  for (const entry of NICHE_TAGS) {
    if (entry.kw.some(k => q.includes(normalize(k)))) return entry.f;
  }
  return null; // fall back to a name-based search
}

function buildOverpassQuery(filter, bbox, query) {
  // Nominatim boundingbox = [south, north, west, east]; Overpass wants (s,w,n,e).
  const [s, n, w, e] = bbox.map(Number);
  const box = `${s},${w},${n},${e}`;

  if (filter) {
    return `[out:json][timeout:25];(nwr${filter}(${box}););out center 80;`;
  }
  // Name-based fallback, restricted to business-like elements to stay fast.
  const q = query.replace(/["\\]/g, '');
  const cats = ['shop', 'amenity', 'office', 'craft', 'leisure', 'tourism'];
  const parts = cats.map(c => `nwr["name"~"${q}",i]["${c}"](${box});`).join('');
  return `[out:json][timeout:25];(${parts});out center 80;`;
}

async function searchLeads() {
  const query = document.getElementById('leads-search-input')?.value.trim();
  const location = document.getElementById('leads-location')?.value.trim();

  if (!query) { showToast('Digite um nicho para buscar', 'warning'); return; }
  if (!location) { showToast('Digite uma cidade para buscar', 'warning'); return; }

  const btn = document.getElementById('btn-search-leads');
  const originalBtn = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Buscando...`; }

  try {
    // 1) Geocode the city/region with Nominatim.
    const geoRes = await fetch(`${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(location)}`, {
      headers: { 'Accept': 'application/json' },
    });
    const geo = await geoRes.json();
    if (!geo.length) {
      showToast('Localizacao nao encontrada. Tente outra cidade.', 'warning');
      return;
    }
    const { boundingbox, lat, lon } = geo[0];

    // Guard against country-sized areas that would make Overpass time out.
    const [s, n, w, e] = boundingbox.map(Number);
    if ((n - s) * (e - w) > 2) {
      showToast('Area muito grande. Especifique uma cidade.', 'warning');
      return;
    }

    // 2) Query businesses with Overpass.
    const overpassQuery = buildOverpassQuery(nicheFilter(query), boundingbox, query);
    const res = await fetch(OVERPASS, {
      method: 'POST',
      body: 'data=' + encodeURIComponent(overpassQuery),
    });
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const data = await res.json();

    searchResults = (data.elements || [])
      .map(toResult)
      .filter(r => r && r.name && r.name !== '(sem nome)');
    searchResults = scoreAndSort(searchResults, query);
    selectedIds.clear();

    renderResults();
    drawMarkers(Number(lat), Number(lon));

    if (searchResults.length === 0) {
      showToast('Nenhuma empresa encontrada nesse nicho/cidade.', 'info');
    } else {
      showToast(`${searchResults.length} empresa(s) encontrada(s)`, 'success');
    }
  } catch (err) {
    console.error('Search error:', err);
    showToast('Erro na busca. Mostrando dados de exemplo.', 'warning');
    searchResults = generateDemoResults(query, location);
    selectedIds.clear();
    renderResults();
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = originalBtn; }
  }
}

function toResult(el) {
  const t = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  const website = t.website || t['contact:website'] || '';
  const phone = t.phone || t['contact:phone'] || t['contact:mobile'] || '';

  const addressParts = [
    [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', '),
    t['addr:suburb'] || t['addr:neighbourhood'],
    t['addr:city'],
    t['addr:state'],
  ].filter(Boolean);

  const category = t.shop || t.amenity || t.office || t.leisure || t.tourism || t.craft || '';

  return {
    placeId: `${el.type}/${el.id}`,
    name: t.name || '(sem nome)',
    address: addressParts.join(' - ') || '',
    lat, lng,
    rating: null,         // OSM has no ratings
    totalRatings: 0,
    phone,
    website,
    types: category ? [category] : [],
    hasWebsite: !!website,
    isPotential: false,
  };
}

function scoreAndSort(results, query) {
  return results.map(r => {
    // Without ratings, potential is driven by the absence of a website.
    let score = 0;
    if (!r.hasWebsite) score += 50;
    if (r.phone) score += 15;       // reachable
    if (r.address) score += 5;      // more complete record
    r.potentialScore = score;
    r.isPotential = !r.hasWebsite && !!r.name;
    return r;
  }).sort((a, b) => {
    if (a.isPotential && !b.isPotential) return -1;
    if (!a.isPotential && b.isPotential) return 1;
    return b.potentialScore - a.potentialScore;
  });
}

function drawMarkers(centerLat, centerLng) {
  if (!mapInstance || !markerLayer) return;
  markerLayer.clearLayers();

  const pts = [];
  searchResults.forEach(r => {
    if (r.lat && r.lng) {
      const marker = L.circleMarker([r.lat, r.lng], {
        radius: 7,
        color: r.isPotential ? '#C68A00' : '#0A0A0A',
        weight: 2,
        fillColor: r.isPotential ? '#C68A00' : '#3A3A3A',
        fillOpacity: 0.7,
      }).bindPopup(`<strong>${r.name}</strong><br>${r.hasWebsite ? 'Tem site' : 'Sem site'}`);
      markerLayer.addLayer(marker);
      pts.push([r.lat, r.lng]);
    }
  });

  if (pts.length > 0) {
    mapInstance.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
  } else if (centerLat && centerLng) {
    mapInstance.setView([centerLat, centerLng], 12);
  }
}

function getFilteredResults() {
  const filterText = (document.getElementById('filter-leads')?.value || '').toLowerCase();
  const noWebsiteOnly = document.getElementById('filter-no-website')?.checked;
  const potentialOnly = document.getElementById('filter-potential-only')?.checked;

  let filtered = searchResults;
  if (filterText) {
    filtered = filtered.filter(r => r.name.toLowerCase().includes(filterText) || r.address?.toLowerCase().includes(filterText));
  }
  if (noWebsiteOnly) filtered = filtered.filter(r => !r.hasWebsite);
  if (potentialOnly) filtered = filtered.filter(r => r.isPotential);
  return filtered;
}

function renderResults() {
  const filtered = getFilteredResults();

  const container = document.getElementById('leads-results');
  const countEl = document.getElementById('results-count');
  if (!container) return;

  if (countEl) countEl.textContent = `${filtered.length} resultado(s)`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        ${icon(ICONS.search, { size: 40, class: 'icon' })}
        <h3>Nenhum resultado encontrado</h3>
        <p>Tente ajustar os filtros ou buscar outro nicho</p>
      </div>
    `;
    updateBulkBar(filtered);
    return;
  }

  container.innerHTML = filtered.map(r => `
    <div class="lead-card ${r.isPotential ? 'potential' : ''} ${selectedIds.has(r.placeId) ? 'selected' : ''}">
      <label class="lead-select" title="Selecionar">
        <input type="checkbox" data-select="${r.placeId}" ${selectedIds.has(r.placeId) ? 'checked' : ''} />
      </label>
      <div class="lead-info">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="lead-name">${r.name}</div>
          ${r.isPotential ? `<span class="badge badge-potential">${icon(ICONS.zap, { size: 12 })} Potencial</span>` : ''}
        </div>
        <div class="lead-address">${r.address || (r.types[0] ? capitalize(r.types[0]) : '--')}</div>
        <div class="lead-meta">
          ${r.phone ? `<div class="lead-meta-item">${icon(ICONS.phone, { size: 14 })} ${r.phone}</div>` : ''}
          <div class="lead-meta-item">
            ${r.hasWebsite
              ? `${icon(ICONS.globe, { size: 14 })} <a href="${r.website}" target="_blank" style="font-size: 0.8125rem;">Tem website</a>`
              : `${icon(ICONS.globe, { size: 14 })} <span style="color: var(--danger);">Sem website</span>`
            }
          </div>
          ${r.types[0] ? `<div class="lead-meta-item">${icon(ICONS.tag, { size: 14 })} ${capitalize(r.types[0])}</div>` : ''}
        </div>
      </div>
      <div class="lead-actions">
        <button class="btn btn-sm btn-primary" data-action="save-lead" data-index="${searchResults.indexOf(r)}">
          ${icon(ICONS.bookmark, { size: 14 })} Salvar
        </button>
        <button class="btn btn-sm btn-secondary" data-action="convert-company" data-index="${searchResults.indexOf(r)}">
          ${icon(ICONS.companies, { size: 14 })} Empresa
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-select]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) selectedIds.add(cb.dataset.select);
      else selectedIds.delete(cb.dataset.select);
      cb.closest('.lead-card')?.classList.toggle('selected', cb.checked);
      updateBulkBar(getFilteredResults());
    });
  });
  container.querySelectorAll('[data-action="save-lead"]').forEach(btn => {
    btn.addEventListener('click', () => saveLead(parseInt(btn.dataset.index)));
  });
  container.querySelectorAll('[data-action="convert-company"]').forEach(btn => {
    btn.addEventListener('click', () => convertToCompany(parseInt(btn.dataset.index)));
  });

  updateBulkBar(filtered);
}

function updateBulkBar(filtered) {
  const bar = document.getElementById('leads-bulk-bar');
  const countEl = document.getElementById('bulk-count');
  const selectAll = document.getElementById('bulk-select-all');
  if (!bar) return;

  const hasResults = (filtered || getFilteredResults()).length > 0;
  bar.style.display = hasResults ? 'flex' : 'none';

  if (countEl) countEl.textContent = `${selectedIds.size} selecionada(s)`;
  if (selectAll) {
    const list = filtered || getFilteredResults();
    selectAll.checked = list.length > 0 && list.every(r => selectedIds.has(r.placeId));
  }
}

async function bulkSaveAsCompanies() {
  const chosen = searchResults.filter(r => selectedIds.has(r.placeId));
  if (chosen.length === 0) {
    showToast('Selecione ao menos uma empresa', 'warning');
    return;
  }

  const btn = document.getElementById('btn-bulk-save-companies');
  const original = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Salvando...`; }

  let ok = 0;
  for (const result of chosen) {
    try {
      await saveResultAsCompany(result);
      ok++;
    } catch (err) {
      console.warn('Failed to save company:', result.name, err);
    }
  }

  if (btn) { btn.disabled = false; btn.innerHTML = original; }

  selectedIds.clear();
  renderResults();

  if (ok === chosen.length) {
    showToast(`${ok} empresa(s) salva(s)`, 'success');
  } else {
    showToast(`${ok} de ${chosen.length} empresa(s) salva(s)`, ok ? 'warning' : 'error');
  }
}

function saveResultAsCompany(result) {
  return createDocument('companies', {
    name: result.name,
    phone: result.phone,
    website: result.website,
    address: result.address,
    segment: result.types?.[0] || '',
    isPotential: result.isPotential,
    source: 'lead',
    notes: `Importado do OpenStreetMap${result.types?.[0] ? ` (${result.types[0]})` : ''}.`,
  });
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '';
}

async function saveLead(index) {
  const result = searchResults[index];
  if (!result) return;

  try {
    await createDocument('leads', {
      placeId: result.placeId,
      name: result.name,
      address: result.address,
      phone: result.phone,
      rating: result.rating,
      totalRatings: result.totalRatings,
      website: result.website,
      hasWebsite: result.hasWebsite,
      types: result.types,
      isPotential: result.isPotential,
      potentialScore: result.potentialScore,
    });
    showToast(`Lead "${result.name}" salvo`, 'success');
    await loadSavedLeads();
  } catch (err) {
    showToast('Erro ao salvar lead', 'error');
  }
}

async function convertToCompany(index) {
  const result = searchResults[index];
  if (!result) return;

  try {
    await saveResultAsCompany(result);
    showToast(`"${result.name}" convertida em empresa`, 'success');
  } catch (err) {
    showToast('Erro ao converter em empresa', 'error');
  }
}

async function loadSavedLeads() {
  try {
    leads = await getDocuments('leads');
    const listEl = document.getElementById('saved-leads-list');
    const countEl = document.getElementById('saved-leads-count');

    if (countEl) countEl.textContent = leads.length;
    if (!listEl) return;

    if (leads.length === 0) {
      listEl.innerHTML = `<div class="empty-state" style="padding: 20px;"><p>Nenhum lead salvo ainda</p></div>`;
      return;
    }

    listEl.innerHTML = `
      <div class="table-container" style="border: none;">
        <table class="table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Telefone</th>
              <th>Website</th>
              <th>Status</th>
              <th>Capturado por</th>
            </tr>
          </thead>
          <tbody>
            ${leads.map(l => `
              <tr>
                <td>
                  <div style="font-weight: 500;">${l.name}</div>
                  <div class="text-xs text-secondary">${l.address || ''}</div>
                </td>
                <td class="text-sm">${l.phone || '--'}</td>
                <td>${l.hasWebsite ? `<span class="badge badge-info">Tem site</span>` : `<span class="badge badge-warning">Sem site</span>`}</td>
                <td>${l.isPotential ? `<span class="badge badge-potential">${icon(ICONS.zap, { size: 12 })} Potencial</span>` : `<span class="badge badge-default">Normal</span>`}</td>
                <td class="text-sm text-secondary">${l.createdBy?.name || '--'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.warn('Error loading saved leads:', err);
  }
}

// Demo data shown only if the free APIs are unreachable.
function generateDemoResults(query, location) {
  const demoBusinesses = [
    { name: `${query} Premium`, hasWebsite: false },
    { name: `${query} Central`, hasWebsite: false },
    { name: `${query} Elite`, hasWebsite: true },
    { name: `${query} Master`, hasWebsite: false },
    { name: `${query} Express`, hasWebsite: false },
    { name: `${query} Top`, hasWebsite: false },
  ];

  return scoreAndSort(
    demoBusinesses.map((b, i) => ({
      placeId: `demo-${i}`,
      name: b.name,
      address: `Rua Exemplo ${100 + i}, ${location || ''}`,
      phone: `(11) 9${String(1000 + i)}-${String(4000 + i)}`,
      rating: null,
      totalRatings: 0,
      website: b.hasWebsite ? 'https://example.com' : '',
      hasWebsite: b.hasWebsite,
      types: [query.toLowerCase()],
      potentialScore: 0,
      isPotential: false,
    })),
    query
  );
}
