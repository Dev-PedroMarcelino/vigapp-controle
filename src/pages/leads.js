// ============================================================
// VigApp — Leads Capture Page (Google Maps Integration)
// ============================================================
import { icon, ICONS } from '../icons.js';
import { showToast } from '../components/toast.js';
import { openModal } from '../components/modal.js';
import { createDocument, getDocuments } from '../utils/firestore.js';

let leads = [];
let mapInstance = null;
let markers = [];
let searchResults = [];

export async function renderLeadsPage(container) {
  container.innerHTML = `
    <div class="page-content animate-fade-in">
      <div class="page-header">
        <div class="page-header-info">
          <h1>Captura de Leads</h1>
          <p>Busque empresas no Google Maps e capture leads potenciais</p>
        </div>
      </div>

      <div class="leads-search-section">
        <div class="search-bar" style="flex: 1; min-width: 300px;">
          ${icon(ICONS.search, { size: 16, class: 'icon search-icon' })}
          <input type="text" id="leads-search-input" placeholder="Buscar por nicho: restaurantes, clinicas, academias..." />
        </div>
        <input type="text" class="form-input" id="leads-location" placeholder="Cidade ou regiao" style="width: 200px;" value="Brasil" />
        <button class="btn btn-primary" id="btn-search-leads">
          ${icon(ICONS.search, { size: 16 })} Buscar
        </button>
      </div>

      <div class="leads-map-container" id="leads-map">
        <div class="empty-state" style="height: 100%; display: flex;">
          ${icon(ICONS.mapPin, { size: 40, class: 'icon' })}
          <h3>Mapa</h3>
          <p>Configure sua API key do Google Maps no arquivo .env para ativar o mapa</p>
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

      <div class="leads-grid" id="leads-results">
        <div class="empty-state">
          ${icon(ICONS.leads, { size: 40, class: 'icon' })}
          <h3>Busque por um nicho</h3>
          <p>Digite um segmento e uma localizacao para encontrar empresas</p>
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

  // Events
  document.getElementById('btn-search-leads')?.addEventListener('click', searchLeads);
  document.getElementById('leads-search-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchLeads();
  });
  document.getElementById('filter-leads')?.addEventListener('input', renderResults);
  document.getElementById('filter-no-website')?.addEventListener('change', renderResults);
  document.getElementById('filter-potential-only')?.addEventListener('change', renderResults);

  // Load saved leads
  await loadSavedLeads();

  // Initialize map if API key available
  initMap();
}

function initMap() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') return;

  // Check if Google Maps script is already loaded
  if (window.google?.maps) {
    createMap();
    return;
  }

  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMap`;
  script.async = true;
  script.defer = true;

  window.initGoogleMap = createMap;
  document.head.appendChild(script);
}

function createMap() {
  const mapContainer = document.getElementById('leads-map');
  if (!mapContainer || !window.google?.maps) return;

  mapContainer.innerHTML = '';

  mapInstance = new google.maps.Map(mapContainer, {
    center: { lat: -14.235, lng: -51.9253 },
    zoom: 4,
    styles: getMapStyles(),
    disableDefaultUI: true,
    zoomControl: true,
  });
}

async function searchLeads() {
  const query = document.getElementById('leads-search-input')?.value.trim();
  const location = document.getElementById('leads-location')?.value.trim();

  if (!query) {
    showToast('Digite um nicho para buscar', 'warning');
    return;
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
    // Demo mode — show sample data
    showToast('Google Maps API nao configurada. Mostrando dados de exemplo.', 'info');
    searchResults = generateDemoResults(query, location);
    renderResults();
    return;
  }

  // Real Google Maps search
  if (!mapInstance) {
    showToast('Mapa nao inicializado', 'error');
    return;
  }

  const service = new google.maps.places.PlacesService(mapInstance);

  try {
    const results = await new Promise((resolve, reject) => {
      service.textSearch(
        { query: `${query} em ${location}` },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            resolve(results);
          } else {
            reject(new Error(`Places API error: ${status}`));
          }
        }
      );
    });

    // Clear old markers
    markers.forEach(m => m.setMap(null));
    markers = [];

    // Get details for each place to check for website
    searchResults = await Promise.all(
      results.map(place => getPlaceDetails(service, place))
    );

    // Score and sort
    searchResults = scoreAndSort(searchResults, query);

    renderResults();

    // Add markers to map
    searchResults.forEach(result => {
      if (result.lat && result.lng) {
        const marker = new google.maps.Marker({
          position: { lat: result.lat, lng: result.lng },
          map: mapInstance,
          title: result.name,
        });
        markers.push(marker);
      }
    });

    // Fit bounds
    if (results.length > 0 && results[0].geometry?.location) {
      mapInstance.setCenter(results[0].geometry.location);
      mapInstance.setZoom(12);
    }

    showToast(`${searchResults.length} resultado(s) encontrado(s)`, 'success');
  } catch (err) {
    console.error('Search error:', err);
    showToast('Erro ao buscar. Verifique a API key.', 'error');
  }
}

function getPlaceDetails(service, place) {
  return new Promise(resolve => {
    service.getDetails(
      { placeId: place.place_id, fields: ['website', 'formatted_phone_number', 'rating', 'user_ratings_total', 'types'] },
      (details, status) => {
        resolve({
          placeId: place.place_id,
          name: place.name,
          address: place.formatted_address,
          lat: place.geometry?.location?.lat(),
          lng: place.geometry?.location?.lng(),
          rating: details?.rating || place.rating || 0,
          totalRatings: details?.user_ratings_total || place.user_ratings_total || 0,
          phone: details?.formatted_phone_number || '',
          website: details?.website || '',
          types: details?.types || place.types || [],
          hasWebsite: !!details?.website,
          isPotential: false,
        });
      }
    );
  });
}

function scoreAndSort(results, query) {
  return results.map(r => {
    // Score: higher rating + more reviews + no website = higher potential
    let score = 0;
    if (!r.hasWebsite) score += 50;
    score += (r.rating || 0) * 10;
    score += Math.min((r.totalRatings || 0) / 10, 20);

    r.potentialScore = score;
    r.isPotential = !r.hasWebsite && r.rating >= 4.0 && r.totalRatings >= 10;

    return r;
  }).sort((a, b) => {
    // Potentials first, then by score
    if (a.isPotential && !b.isPotential) return -1;
    if (!a.isPotential && b.isPotential) return 1;
    return b.potentialScore - a.potentialScore;
  });
}

function renderResults() {
  const filterText = (document.getElementById('filter-leads')?.value || '').toLowerCase();
  const noWebsiteOnly = document.getElementById('filter-no-website')?.checked;
  const potentialOnly = document.getElementById('filter-potential-only')?.checked;

  let filtered = searchResults;

  if (filterText) {
    filtered = filtered.filter(r => r.name.toLowerCase().includes(filterText) || r.address?.toLowerCase().includes(filterText));
  }
  if (noWebsiteOnly) {
    filtered = filtered.filter(r => !r.hasWebsite);
  }
  if (potentialOnly) {
    filtered = filtered.filter(r => r.isPotential);
  }

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
    return;
  }

  container.innerHTML = filtered.map(r => `
    <div class="lead-card ${r.isPotential ? 'potential' : ''}">
      <div class="lead-info">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="lead-name">${r.name}</div>
          ${r.isPotential ? `<span class="badge badge-potential">${icon(ICONS.zap, { size: 12 })} Potencial</span>` : ''}
        </div>
        <div class="lead-address">${r.address || '--'}</div>
        <div class="lead-meta">
          <div class="lead-meta-item">
            ${renderStars(r.rating)}
            <span>${r.rating?.toFixed(1) || '0'} (${r.totalRatings || 0})</span>
          </div>
          ${r.phone ? `<div class="lead-meta-item">${icon(ICONS.phone, { size: 14 })} ${r.phone}</div>` : ''}
          <div class="lead-meta-item">
            ${r.hasWebsite
              ? `${icon(ICONS.globe, { size: 14 })} <a href="${r.website}" target="_blank" style="font-size: 0.8125rem;">Tem website</a>`
              : `${icon(ICONS.globe, { size: 14 })} <span style="color: var(--danger);">Sem website</span>`
            }
          </div>
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

  // Attach event handlers
  container.querySelectorAll('[data-action="save-lead"]').forEach(btn => {
    btn.addEventListener('click', () => saveLead(parseInt(btn.dataset.index)));
  });

  container.querySelectorAll('[data-action="convert-company"]').forEach(btn => {
    btn.addEventListener('click', () => convertToCompany(parseInt(btn.dataset.index)));
  });
}

function renderStars(rating) {
  const full = Math.floor(rating || 0);
  let stars = '';
  for (let i = 0; i < 5; i++) {
    stars += `<span class="${i < full ? 'star-filled' : 'star-empty'}">${icon(ICONS.star, { size: 12 })}</span>`;
  }
  return `<div class="lead-rating">${stars}</div>`;
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
    await createDocument('companies', {
      name: result.name,
      phone: result.phone,
      website: result.website,
      address: result.address,
      segment: result.types?.[0] || '',
      isPotential: result.isPotential,
      source: 'lead',
      rating: result.rating,
      notes: `Importado do Google Maps. Nota: ${result.rating} (${result.totalRatings} avaliacoes)`,
    });
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
              <th>Nota</th>
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
                <td>${renderStars(l.rating)} <span class="text-xs">${l.rating?.toFixed(1) || '0'}</span></td>
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

// Demo data when Google Maps API is not configured
function generateDemoResults(query, location) {
  const demoBusinesses = [
    { name: `${query} Premium`, rating: 4.8, totalRatings: 342, hasWebsite: false, isPotential: true },
    { name: `${query} Central`, rating: 4.5, totalRatings: 156, hasWebsite: false, isPotential: true },
    { name: `${query} Elite`, rating: 4.7, totalRatings: 89, hasWebsite: true, isPotential: false },
    { name: `${query} Master`, rating: 4.2, totalRatings: 67, hasWebsite: false, isPotential: false },
    { name: `${query} Express`, rating: 3.9, totalRatings: 201, hasWebsite: false, isPotential: false },
    { name: `${query} Top`, rating: 4.9, totalRatings: 523, hasWebsite: false, isPotential: true },
    { name: `${query} Novo`, rating: 4.0, totalRatings: 12, hasWebsite: true, isPotential: false },
    { name: `${query} Classico`, rating: 4.6, totalRatings: 198, hasWebsite: false, isPotential: true },
  ];

  return scoreAndSort(
    demoBusinesses.map((b, i) => ({
      placeId: `demo-${i}`,
      name: b.name,
      address: `Rua Exemplo ${100 + i}, ${location || 'Brasil'}`,
      phone: `(11) 9${String(Math.random()).slice(2, 6)}-${String(Math.random()).slice(2, 6)}`,
      rating: b.rating,
      totalRatings: b.totalRatings,
      website: b.hasWebsite ? 'https://example.com' : '',
      hasWebsite: b.hasWebsite,
      types: [query.toLowerCase()],
      potentialScore: 0,
      isPotential: false,
    })),
    query
  );
}

function getMapStyles() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (!isDark) return [];

  return [
    { elementType: 'geometry', stylers: [{ color: '#212121' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  ];
}
