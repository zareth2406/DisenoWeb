// colores y nombres de tipos, rangos de generaciones, nombres de stats, traducciones, etc.
const TYPE_COLORS = {
  fire: '#FF6B35', water: '#4FC3F7', grass: '#66BB6A', electric: '#FFD54F',
  psychic: '#F48FB1', ice: '#80DEEA', dragon: '#7986CB', dark: '#546E7A',
  fairy: '#F8BBD9', fighting: '#EF9A9A', flying: '#90CAF9', poison: '#CE93D8',
  ground: '#FFCC80', rock: '#BCAAA4', bug: '#C5E1A5', ghost: '#9575CD',
  steel: '#B0BEC5', normal: '#eceff193', unknown: '#B0BEC5', shadow: '#37474F'
};

const STAT_NAMES = {
  hp: 'HP', attack: 'Ataque', defense: 'Defensa',
  'special-attack': 'Sp. Ataque', 'special-defense': 'Sp. Defensa', speed: 'Velocidad'
};

const TYPE_NAMES_ES = {
  fire: 'Fuego', water: 'Agua', grass: 'Planta', electric: 'Eléctrico',
  psychic: 'Psíquico', ice: 'Hielo', dragon: 'Dragón', dark: 'Siniestro',
  fairy: 'Hada', fighting: 'Lucha', flying: 'Volador', poison: 'Veneno',
  ground: 'Tierra', rock: 'Roca', bug: 'Bicho', ghost: 'Fantasma',
  steel: 'Acero', normal: 'Normal', unknown: 'Desconocido', shadow: 'Sombra'
};

const GENERATION_RANGES = {
  1: [1, 151], 2: [152, 251], 3: [252, 386], 4: [387, 493],
  5: [494, 649], 6: [650, 721], 7: [722, 809], 8: [810, 905], 9: [906, 1025]
};

// variables globales
let allPokemonsData = [];
let currentPage = 1;
const PAGE_SIZE = 20;
let totalPages = 0;
let totalPokemonsCount = 0;
let isLoadingPage = false;
let currentFilterType = '';
let currentFilterGen = '';
let currentSearchTerm = '';
let currentMoveData = null;
let loggedUser = null;
let userTeam = [];

// variables para movimientos
let currentMovesPage = 1;
const MOVES_PAGE_SIZE = 20;
let totalMovesPages = 0;
let totalMovesCount = 0;
let isLoadingMovesPage = false;
let currentMovesFilterType = '';
let currentMovesSearchTerm = '';

// funciones de traducción y utilidades
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function getSpanishTypeName(type) { return TYPE_NAMES_ES[type] || capitalize(type); }

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error ' + res.status);
  return res.json();
}

function localizeEntry(entries, lang = 'es') {
  return entries?.find(e => e.language?.name === lang)?.name ||
         entries?.find(e => e.language?.name === 'en')?.name || '';
}

function getSpanishPokemonName(species, fallback) {
  return localizeEntry(species.names, 'es') || fallback;
}

// ========== CATÁLOGO Y PAGINACIÓN ==========
async function getTotalPokemonCount() {
  try {
    const response = await fetch('https://pokeapi.co/api/v2/pokemon-species?limit=0');
    const data = await response.json();
    totalPokemonsCount = data.count;
    totalPages = Math.ceil(totalPokemonsCount / PAGE_SIZE);
    return totalPokemonsCount;
  } catch {
    totalPokemonsCount = 1025;
    totalPages = Math.ceil(1025 / PAGE_SIZE);
    return totalPokemonsCount;
  }
}

async function fetchPokemonBasicData(id) {
  try {
    const [pokemon, species] = await Promise.all([
      fetchJSON(`https://pokeapi.co/api/v2/pokemon/${id}`),
      fetchJSON(`https://pokeapi.co/api/v2/pokemon-species/${id}`)
    ]);
    const spanishName = getSpanishPokemonName(species, capitalize(pokemon.name));
    const sprite = pokemon.sprites.other?.['official-artwork']?.front_default ||
                   pokemon.sprites.front_default ||
                   `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
    return {
      id: pokemon.id, name: spanishName, apiName: pokemon.name,
      types: pokemon.types.map(t => t.type.name), sprite: sprite,
      formattedId: '#' + String(pokemon.id).padStart(3, '0'),
      generation: getGenerationByPokemonId(pokemon.id)
    };
  } catch { return null; }
}

function getGenerationByPokemonId(id) {
  for (let [gen, [min, max]] of Object.entries(GENERATION_RANGES)) {
    if (id >= min && id <= max) return parseInt(gen);
  }
  return 9;
}

async function loadPage(page) {
  if (isLoadingPage) return;
  isLoadingPage = true;
  const gridElement = document.getElementById('pokemonGrid');
  if (!gridElement) return;
  gridElement.innerHTML = '<div class="loading-spinner">Cargando Pokédex...</div>';

  try {
    let pagePokemons = [];
    let startId = (page - 1) * PAGE_SIZE + 1;
    let currentId = startId;
    const hasFilters = currentFilterGen || currentFilterType || currentSearchTerm;

    if (hasFilters) {
      while (pagePokemons.length < PAGE_SIZE && currentId <= totalPokemonsCount) {
        const endId = Math.min(currentId + PAGE_SIZE * 2, totalPokemonsCount);
        const promises = [];
        for (let i = currentId; i <= endId; i++) promises.push(fetchPokemonBasicData(i));
        const results = await Promise.all(promises);
        const pokemons = results.filter(p => p !== null);
        const filtered = applyFilters(pokemons);
        pagePokemons.push(...filtered);
        currentId = endId + 1;
      }
      pagePokemons = pagePokemons.slice(0, PAGE_SIZE);
    } else {
      const endId = Math.min(page * PAGE_SIZE, totalPokemonsCount);
      const promises = [];
      for (let i = startId; i <= endId; i++) promises.push(fetchPokemonBasicData(i));
      const results = await Promise.all(promises);
      pagePokemons = results.filter(p => p !== null);
    }
    
    for (const p of pagePokemons) {
      const idx = allPokemonsData.findIndex(ex => ex.id === p.id);
      if (idx === -1) allPokemonsData.push(p);
      else allPokemonsData[idx] = p;
    }
    allPokemonsData.sort((a,b) => a.id - b.id);
    
    renderPokemonGrid(pagePokemons);
    updatePaginationUI();
  } catch (error) {
    console.error(error);
    gridElement.innerHTML = '<div class="loading-spinner">Error al cargar. Intenta de nuevo.</div>';
  } finally {
    isLoadingPage = false;
  }
}

function applyFilters(pokemons) {
  let filtered = [...pokemons];
  if (currentSearchTerm) {
    const term = currentSearchTerm.toLowerCase();
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.apiName.toLowerCase().includes(term) || 
      p.id.toString() === term ||
      p.formattedId === term
    );
  }
  if (currentFilterType) {
    filtered = filtered.filter(p => p.types.includes(currentFilterType));
  }
  if (currentFilterGen) {
    filtered = filtered.filter(p => p.generation === parseInt(currentFilterGen));
  }
  return filtered;
}

function renderPokemonGrid(pokemons) {
  const grid = document.getElementById('pokemonGrid');
  if (!pokemons.length) {
    grid.innerHTML = '<div class="loading-spinner">No se encontraron Pokémon.</div>';
    document.getElementById('gridCount').textContent = `0 / ${totalPokemonsCount}`;
    return;
  }
  
  const cardsHTML = pokemons.map(p => `
    <div class="grid-pokemon-card"
      data-pokemon-name="${p.apiName}"
      data-pokemon-id="${p.id}"
      data-types="${p.types.join(',')}"
      data-generation="${p.generation}">
      <img class="grid-pokemon-img" src="${p.sprite}" alt="${p.name}" loading="lazy">
      <div class="grid-pokemon-id">${p.formattedId}</div>
      <div class="grid-pokemon-name">${p.name}</div>
      ${loggedUser ? `<button class="add-to-team-btn" data-pokemon-id="${p.id}" data-pokemon-name="${p.apiName}">+ Equipo</button>` : ''}
    </div>
  `).join('');
  
  grid.innerHTML = cardsHTML;
  const start = (currentPage-1)*PAGE_SIZE+1;
  const end = Math.min(currentPage*PAGE_SIZE, totalPokemonsCount);
  document.getElementById('gridCount').textContent = `${start}-${end} de ${totalPokemonsCount}`;
  
  document.querySelectorAll('.grid-pokemon-card').forEach(card => {
    const name = card.dataset.pokemonName;
    const id   = parseInt(card.dataset.pokemonId);
    const types = card.dataset.types.split(',');
    const gen   = parseInt(card.dataset.generation);

    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('add-to-team-btn')) return;
      hidePreview();
      card.classList.add('card-clicked');
      setTimeout(() => showPokemonDetail(name), 320);
    });
    card.addEventListener('mouseenter', () => showPreview(card, id, types, gen));
    card.addEventListener('mouseleave', hidePreview);

    const btn = card.querySelector('.add-to-team-btn');
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); addToTeam(parseInt(btn.dataset.pokemonId), btn.dataset.pokemonName); });
  });
}

function updatePaginationUI() {
  document.querySelectorAll('#currentPageDisplay').forEach(s => s.textContent = currentPage);
  document.querySelectorAll('#totalPagesDisplay').forEach(s => s.textContent = totalPages);
  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;
  document.getElementById('prevPageBtn').disabled = prevDisabled;
  document.getElementById('firstPageBtn').disabled = prevDisabled;
  document.getElementById('nextPageBtn').disabled = nextDisabled;
  document.getElementById('lastPageBtn').disabled = nextDisabled;
}

function goToFirstPage() { if (currentPage !== 1) { currentPage = 1; loadPage(currentPage); } }
function goToPrevPage() { if (currentPage > 1) { currentPage--; loadPage(currentPage); } }
function goToNextPage() { if (currentPage < totalPages) { currentPage++; loadPage(currentPage); } }
function goToLastPage() { if (currentPage !== totalPages) { currentPage = totalPages; loadPage(currentPage); } }

// ========== FUNCIONES PARA MOVIMIENTOS ==========
async function getTotalMovesCount() {
  try {
    const response = await fetch('https://pokeapi.co/api/v2/move?limit=0');
    const data = await response.json();
    totalMovesCount = data.count;
    totalMovesPages = Math.ceil(totalMovesCount / MOVES_PAGE_SIZE);
    return totalMovesCount;
  } catch {
    totalMovesCount = 900;
    totalMovesPages = Math.ceil(900 / MOVES_PAGE_SIZE);
    return totalMovesCount;
  }
}

async function fetchMoveBasicData(id) {
  try {
    const moveData = await fetchJSON(`https://pokeapi.co/api/v2/move/${id}`);
    const spanishName = localizeEntry(moveData.names, 'es') || capitalize(moveData.name);
    return {
      id: moveData.id,
      name: spanishName,
      apiName: moveData.name,
      type: moveData.type.name,
      power: moveData.power ?? '—',
      accuracy: moveData.accuracy ?? '—',
      pp: moveData.pp ?? '—'
    };
  } catch {
    return null;
  }
}

async function loadMovesPage(page) {
  if (isLoadingMovesPage) return;
  isLoadingMovesPage = true;
  const gridElement = document.getElementById('movesGrid');
  if (!gridElement) return;
  gridElement.innerHTML = '<div class="loading-spinner">Cargando movimientos...</div>';

  try {
    const startId = (page - 1) * MOVES_PAGE_SIZE + 1;
    const endId = Math.min(page * MOVES_PAGE_SIZE, totalMovesCount);
    const movesData = [];
    for (let id = startId; id <= endId; id++) {
      const data = await fetchMoveBasicData(id);
      if (data) movesData.push(data);
    }

    let filteredMoves = movesData;
    if (currentMovesFilterType) {
      filteredMoves = filteredMoves.filter(m => m.type === currentMovesFilterType);
    }
    if (currentMovesSearchTerm) {
      const term = currentMovesSearchTerm.toLowerCase();
      filteredMoves = filteredMoves.filter(m => m.name.toLowerCase().includes(term) || m.apiName.toLowerCase().includes(term));
    }

    const gridHTML = filteredMoves.map(move => `
      <div class="move-card" data-move-name="${move.apiName}">
        <div class="move-name">${move.name}</div>
        <div class="move-type" style="background-color: ${TYPE_COLORS[move.type]}">${getSpanishTypeName(move.type)}</div>
        <div class="move-power">Poder: ${move.power}</div>
      </div>
    `).join('');
    gridElement.innerHTML = gridHTML;

    document.querySelectorAll('.move-card').forEach(card => {
      card.addEventListener('click', () => showMoveDetail(card.dataset.moveName));
    });

    updateMovesPaginationButtons(page);
    document.getElementById('movesGridCount').textContent = `${filteredMoves.length} movimientos`;
    document.getElementById('movesCurrentPageDisplay').textContent = page;
    document.getElementById('movesTotalPagesDisplay').textContent = totalMovesPages;
  } catch (err) {
    gridElement.innerHTML = '<div class="loading-spinner">Error al cargar movimientos.</div>';
    console.error(err);
  } finally {
    isLoadingMovesPage = false;
  }
}

function updateMovesPaginationButtons(page) {
  const firstBtn = document.getElementById('movesFirstPageBtn');
  const prevBtn = document.getElementById('movesPrevPageBtn');
  const nextBtn = document.getElementById('movesNextPageBtn');
  const lastBtn = document.getElementById('movesLastPageBtn');
  if (!firstBtn || !prevBtn || !nextBtn || !lastBtn) return;

  firstBtn.disabled = page === 1;
  prevBtn.disabled = page === 1;
  nextBtn.disabled = page === totalMovesPages;
  lastBtn.disabled = page === totalMovesPages;
}

function goToMovesFirstPage() { if (currentMovesPage !== 1) { currentMovesPage = 1; loadMovesPage(currentMovesPage); } }
function goToMovesPrevPage() { if (currentMovesPage > 1) { currentMovesPage--; loadMovesPage(currentMovesPage); } }
function goToMovesNextPage() { if (currentMovesPage < totalMovesPages) { currentMovesPage++; loadMovesPage(currentMovesPage); } }
function goToMovesLastPage() { if (currentMovesPage !== totalMovesPages) { currentMovesPage = totalMovesPages; loadMovesPage(currentMovesPage); } }

async function showMoveDetail(moveName) {
  showLoader(true);
  try {
    const moveData = await fetchJSON(`https://pokeapi.co/api/v2/move/${moveName}`);
    currentMoveData = moveData;
    const spanishName = localizeEntry(moveData.names, 'es') || capitalize(moveData.name);
    const type = getSpanishTypeName(moveData.type.name);
    const power = moveData.power || '—';
    const accuracy = moveData.accuracy || '—';
    const pp = moveData.pp || '—';
    // Buscar descripción en español, inglés, o la primera disponible (excluyendo francés)
    let effect = 'Sin descripción';
    if (moveData.effect_entries && moveData.effect_entries.length > 0) {
      const spanish = moveData.effect_entries.find(e => e.language?.name === 'es');
      const english = moveData.effect_entries.find(e => e.language?.name === 'en');
      const nonFrench = moveData.effect_entries.find(e => e.language?.name !== 'fr');
      effect = spanish?.effect || english?.effect || nonFrench?.effect || 'Sin descripción';
    }
    
    // Mostrar modal o sección de detalle (usaremos un div flotante simple)
    const detailHTML = `
      <div class="move-detail-modal" id="moveDetailModal">
        <div class="move-detail-content">
          <button class="close-modal" onclick="closeMoveDetail()">✖</button>
          <h3>${spanishName}</h3>
          <div class="move-detail-grid">
            <div class="move-detail-item"><span class="move-detail-label">Tipo</span><span class="move-detail-value">${type}</span></div>
            <div class="move-detail-item"><span class="move-detail-label">Poder</span><span class="move-detail-value">${power}</span></div>
            <div class="move-detail-item"><span class="move-detail-label">Precisión</span><span class="move-detail-value">${accuracy}</span></div>
            <div class="move-detail-item"><span class="move-detail-label">PP</span><span class="move-detail-value">${pp}</span></div>
          </div>
          <p><strong>Efecto:</strong> ${effect}</p>
          <div class="move-pokemon-list">
            <h4>Pokémon que aprenden este movimiento</h4>
            <div class="pokemon-grid small-grid" id="movePokemonGrid"></div>
          </div>
        </div>
      </div>
    `;
    
    // Eliminar modal anterior si existe
    const oldModal = document.getElementById('moveDetailModal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', detailHTML);
    
    // Obtener Pokémon que aprenden este movimiento
    const pokemonWithMove = moveData.learned_by_pokemon.slice(0, 50);
    const pokemonData = await Promise.all(pokemonWithMove.map(async p => {
      try {
        const poke = await fetchJSON(p.url);
        const species = await fetchJSON(`https://pokeapi.co/api/v2/pokemon-species/${poke.id}`);
        return {
          id: poke.id,
          name: getSpanishPokemonName(species, capitalize(poke.name)),
          apiName: poke.name,
          sprite: poke.sprites.other?.['official-artwork']?.front_default || poke.sprites.front_default,
          formattedId: '#' + String(poke.id).padStart(3,'0')
        };
      } catch { return null; }
    }));
    const valid = pokemonData.filter(p => p);
    const grid = document.getElementById('movePokemonGrid');
    grid.innerHTML = valid.map(p => `
      <div class="grid-pokemon-card" data-pokemon-name="${p.apiName}">
        <img class="grid-pokemon-img" src="${p.sprite}" loading="lazy">
        <div class="grid-pokemon-id">${p.formattedId}</div>
        <div class="grid-pokemon-name">${p.name}</div>
      </div>
    `).join('');
    document.querySelectorAll('#movePokemonGrid .grid-pokemon-card').forEach(card => {
      card.addEventListener('click', () => {
        closeMoveDetail();
        showPokemonDetail(card.dataset.pokemonName);
      });
    });
  } catch (err) {
    alert('Error al cargar el movimiento');
    console.error(err);
  } finally {
    showLoader(false);
  }
}

function closeMoveDetail() {
  const modal = document.getElementById('moveDetailModal');
  if (modal) modal.remove();
}

// ========== FILTROS Y BÚSQUEDA EN CATÁLOGO ==========
function setupFilters() {
  const searchInput = document.getElementById('catalogoSearch');
  const tipoSelect = document.getElementById('tipoFilter');
  const genSelect = document.getElementById('generacionFilter');
  
  for (let type in TYPE_NAMES_ES) {
    let option = document.createElement('option');
    option.value = type;
    option.textContent = TYPE_NAMES_ES[type];
    tipoSelect.appendChild(option);
  }
  for (let i = 1; i <= 9; i++) {
    let option = document.createElement('option');
    option.value = i;
    option.textContent = `Generación ${i}`;
    genSelect.appendChild(option);
  }
  
  const updateFilters = () => {
    currentSearchTerm = searchInput.value;
    currentFilterType = tipoSelect.value;
    currentFilterGen = genSelect.value;
    currentPage = 1;
    loadPage(1);
  };
  
  searchInput.addEventListener('input', updateFilters);
  tipoSelect.addEventListener('change', updateFilters);
  genSelect.addEventListener('change', updateFilters);
}

function setupMovesFilters() {
  const searchInput = document.getElementById('movesSearch');
  const tipoSelect = document.getElementById('moveTypeFilter');
  if (!searchInput || !tipoSelect) return;
  
  for (let type in TYPE_NAMES_ES) {
    let option = document.createElement('option');
    option.value = type;
    option.textContent = TYPE_NAMES_ES[type];
    tipoSelect.appendChild(option);
  }
  
  const updateMovesFilters = () => {
    currentMovesSearchTerm = searchInput.value;
    currentMovesFilterType = tipoSelect.value;
    currentMovesPage = 1;
    loadMovesPage(1);
  };
  
  searchInput.addEventListener('input', updateMovesFilters);
  tipoSelect.addEventListener('change', updateMovesFilters);
}

function setupMovesPaginationEvents() {
  const firstBtn = document.getElementById('movesFirstPageBtn');
  const prevBtn = document.getElementById('movesPrevPageBtn');
  const nextBtn = document.getElementById('movesNextPageBtn');
  const lastBtn = document.getElementById('movesLastPageBtn');
  if (!firstBtn || !prevBtn || !nextBtn || !lastBtn) return;

  firstBtn.addEventListener('click', goToMovesFirstPage);
  prevBtn.addEventListener('click', goToMovesPrevPage);
  nextBtn.addEventListener('click', goToMovesNextPage);
  lastBtn.addEventListener('click', goToMovesLastPage);
}

// ========== DETALLE DE POKÉMON ==========
let currentPokemonData = null;
let currentSpeciesData = null;

async function showPokemonDetail(identifier) {
  showLoader(true);
  try {
    const [pokeData, speciesData] = await Promise.all([
      fetchJSON(`https://pokeapi.co/api/v2/pokemon/${identifier}`),
      fetchJSON(`https://pokeapi.co/api/v2/pokemon-species/${identifier}`)
    ]);
    currentPokemonData = pokeData;
    currentSpeciesData = speciesData;
    const evoData = await fetchJSON(speciesData.evolution_chain.url);
    await renderDetailView(pokeData, speciesData, evoData);
    navigateTo('detalle');
  } catch (err) {
    console.error(err);
    alert('Pokémon no encontrado');
  } finally {
    showLoader(false);
  }
}

async function renderDetailView(data, species, evoData) {
  const container = document.getElementById('pokeCardDetail');
  const template = document.getElementById('pokemonDetailTemplate');
  const clone = template.content.cloneNode(true);

  // Poblar datos dinámicos
  const pokemonName = getSpanishPokemonName(species, capitalize(data.name));
  const types = data.types.map(t => t.type.name);
  const primaryColor = TYPE_COLORS[types[0]] || '#888';
  const gen = species.generation?.name?.replace('generation-', 'Gen ').toUpperCase() || '';
  const abilities = data.abilities.map(a => ({
    name: localizeEntry(a.ability?.names, 'es') || capitalize(a.ability.name),
    isHidden: a.is_hidden
  }));

  const levelMoves = data.moves
    .filter(m => m.version_group_details.some(v => v.move_learn_method.name === 'level-up'))
    .sort((a,b) => {
      const lvlA = a.version_group_details.find(v => v.move_learn_method.name === 'level-up')?.level_learned_at || 0;
      const lvlB = b.version_group_details.find(v => v.move_learn_method.name === 'level-up')?.level_learned_at || 0;
      return lvlA - lvlB;
    });

  const normalSprite = data.sprites.other?.['official-artwork']?.front_default || data.sprites.front_default;
  const shinySprite = data.sprites.other?.['official-artwork']?.front_shiny || data.sprites.front_shiny;

  const alreadyInTeam = userTeam.some(p => p.id === data.id);
  const teamFull = userTeam.length >= 6;

  // Asignar valores a los elementos
  clone.querySelector('.hero-bg-type').style.background = `linear-gradient(135deg, ${primaryColor}88 0%, transparent 100%)`;
  clone.querySelector('.sprite-container:nth-child(1) .sprite-img').src = normalSprite;
  clone.querySelector('.sprite-container:nth-child(1) .sprite-img').alt = `${pokemonName} normal`;
  clone.querySelector('.sprite-container:nth-child(2) .sprite-img').src = shinySprite;
  clone.querySelector('.sprite-container:nth-child(2) .sprite-img').alt = `${pokemonName} shiny`;
  clone.querySelector('.poke-id').textContent = `#${String(data.id).padStart(3,'0')}`;
  clone.querySelector('.poke-name').textContent = pokemonName;
  clone.querySelector('.type-badges').innerHTML = types.map(t => `<span class="type-badge" style="background:${TYPE_COLORS[t]}">${getSpanishTypeName(t)}</span>`).join('');
  clone.querySelector('.generation-badge').textContent = gen;
  clone.querySelector('.basic-stat:nth-child(1) .bstat-val').textContent = `${(data.weight/10)} kg`;
  clone.querySelector('.basic-stat:nth-child(2) .bstat-val').textContent = `${(data.height/10)} m`;
  clone.querySelector('.basic-stat:nth-child(3) .bstat-val').textContent = data.base_experience ?? '—';
  clone.querySelector('.abilities-list').innerHTML = abilities.map(a => `<span class="ability-chip ${a.isHidden ? 'hidden-ability' : ''}">${a.name}${a.isHidden ? ' (Oculta)' : ''}</span>`).join('');

  // Limpiar y asignar container
  container.innerHTML = '';
  container.appendChild(clone);

  // Resto del código (stats, evolutions, moves, etc.)
  let total = 0;
  const statsGrid = document.getElementById('statsGridDetail');
  statsGrid.innerHTML = '';
  data.stats.forEach(s => {
    total += s.base_stat;
    const pct = Math.min(100, (s.base_stat / 255) * 100);
    const color = s.base_stat >= 100 ? '#4ade80' : s.base_stat >= 60 ? '#facc15' : '#f87171';
    statsGrid.innerHTML += `<div class="stat-row"><span class="stat-name">${STAT_NAMES[s.stat.name]}</span><span class="stat-num" style="color:${color}">${s.base_stat}</span><div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${pct}%;background:${color}"></div></div></div>`;
  });
  document.getElementById('statTotalDetail').textContent = total;

  await renderEvolutionsDetail(evoData.chain);

  const movesGrid = document.getElementById('movesGridDetail');
  const moveItems = await Promise.all(levelMoves.slice(0, 30).map(async m => {
    const detail = m.version_group_details.find(v => v.move_learn_method.name === 'level-up');
    const lvl = detail?.level_learned_at || '?';
    let name = m.move.name.replace(/-/g, ' ');
    const apiName = m.move.name;
    try {
      const moveData = await fetchJSON(m.move.url);
      const spanish = localizeEntry(moveData.names, 'es');
      if (spanish) name = spanish;
    } catch(e) {}
    return { lvl, name: capitalize(name), apiName };
  }));
  movesGrid.innerHTML = moveItems.map(item => `<div class="move-chip" data-move-name="${item.apiName}" style="cursor: pointer;" onclick="navigateToMoveDetail('${item.apiName}')"><span class="move-lvl">Lv.${item.lvl}</span><span class="move-name">${item.name}</span></div>`).join('');

  // Configurar footer dinámico
  const footer = document.getElementById('teamFooter');
  if (loggedUser) {
    footer.innerHTML = `<button class="add-to-team-detail-btn" id="detailTeamBtn" onclick="addToTeam(${data.id}, '${data.name}')" ${alreadyInTeam || teamFull ? 'disabled' : ''}>${alreadyInTeam ? '✓ Ya está en tu equipo' : teamFull ? 'Equipo lleno (6/6)' : `＋ Agregar ${pokemonName} al equipo`}</button>`;
  } else {
    footer.innerHTML = `<a href="#" onclick="navigateTo('usuario');return false;" style="color:var(--yellow)">Inicia sesión</a> para agregar Pokémon a tu equipo.`;
  }

  setupDetailTabs();
}

async function renderEvolutionsDetail(chain) {
  const container = document.getElementById('evoChainDetail');
  container.innerHTML = '<p class="loading-text">Cargando evoluciones...</p>';
  const stages = collectEvoStages(chain);
  const stagesData = await Promise.all(stages.map(stage => Promise.all(stage.map(fetchPokemonSprite))));
  container.innerHTML = '';
  stagesData.forEach((stage, i) => {
    if (stage.length === 1) {
      container.innerHTML += makeStagePokemonCard(stage[0]);
      if (i < stagesData.length - 1) container.innerHTML += '<div class="evo-arrow">▶</div>';
    } else {
      container.innerHTML += `<div class="evo-branch-grid">${stage.map(makeStagePokemonCard).join('')}</div>`;
      if (i < stagesData.length - 1) container.innerHTML += '<div class="evo-arrow evo-arrow-branch">▼</div>';
    }
  });
}

function collectEvoStages(chain) {
  const stages = [];
  function walk(node, depth) {
    if (!stages[depth]) stages[depth] = [];
    stages[depth].push(node.species);
    node.evolves_to.forEach(child => walk(child, depth + 1));
  }
  walk(chain, 0);
  return stages;
}

async function fetchPokemonSprite(species) {
  try {
    const id = species.url.split('/').filter(Boolean).pop();
    const pokemon = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const speciesData = await fetchJSON(species.url);
    return {
      apiName: species.name,
      name: getSpanishPokemonName(speciesData, capitalize(species.name)),
      id: id,
      sprite: pokemon.sprites.other?.['official-artwork']?.front_default || pokemon.sprites.front_default,
      types: pokemon.types.map(t => t.type.name)
    };
  } catch { return { apiName: species.name, name: capitalize(species.name), id: '?', sprite: '', types: [] }; }
}

function makeStagePokemonCard(poke) {
  const color = TYPE_COLORS[poke.types[0]] || '#888';
  return `<div class="evo-stage" onclick="showPokemonDetail('${poke.apiName}')"><div class="evo-img-wrap" style="border-color:${color}"><img src="${poke.sprite}" alt="${poke.name}"></div><span class="evo-name">${poke.name}</span><span class="evo-id">#${String(poke.id).padStart(3,'0')}</span><div class="evo-types">${poke.types.map(t => `<span class="evo-type" style="background:${TYPE_COLORS[t]}">${getSpanishTypeName(t)}</span>`).join('')}</div></div>`;
}

function setupDetailTabs() {
  document.querySelectorAll('#pokeCardDetail .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('#pokeCardDetail .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      document.querySelectorAll('#pokeCardDetail .tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
    });
  });
}

// ========== MÓDULO USUARIO Y EQUIPO ==========
function loadStoredData() {
  const storedUser = localStorage.getItem('pokedex_user');
  if (storedUser) {
    loggedUser = JSON.parse(storedUser);
    document.getElementById('userNameDisplay').textContent = loggedUser.username;
    document.getElementById('loginPanel').classList.add('hidden');
    document.getElementById('userPanel').classList.remove('hidden');
  } else {
    loggedUser = null;
    document.getElementById('loginPanel').classList.remove('hidden');
    document.getElementById('userPanel').classList.add('hidden');
  }
  
  const storedTeam = localStorage.getItem('pokedex_team');
  if (storedTeam) {
    userTeam = JSON.parse(storedTeam);
    // Backward compatibility: ensure all team members have nickname field
    userTeam.forEach(pokemon => {
      if (!pokemon.nickname) {
        pokemon.nickname = pokemon.name;
      }
    });
  } else {
    userTeam = [];
  }
  updateTeamUI();
}

function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  if (!username) {
    alert('Ingresa un nombre de entrenador');
    return;
  }
  loggedUser = { username: username };
  localStorage.setItem('pokedex_user', JSON.stringify(loggedUser));
  document.getElementById('userNameDisplay').textContent = username;
  document.getElementById('loginPanel').classList.add('hidden');
  document.getElementById('userPanel').classList.remove('hidden');
  loadPage(currentPage);
}

function doLogout() {
  loggedUser = null;
  localStorage.removeItem('pokedex_user');
  // Borrar el equipo al cerrar sesión
  userTeam = [];
  localStorage.removeItem('pokedex_team');
  updateTeamUI();
  document.getElementById('loginPanel').classList.remove('hidden');
  document.getElementById('userPanel').classList.add('hidden');
  loadPage(currentPage);
}

function addToTeam(pokemonId, pokemonApiName) {
  if (!loggedUser) {
    alert('Debes iniciar sesión primero');
    navigateTo('usuario');
    return;
  }
  if (userTeam.length >= 6) {
    alert('Tu equipo ya tiene 6 Pokémon. Elimina alguno primero.');
    return;
  }
  if (userTeam.some(p => p.id === pokemonId)) {
    alert('Este Pokémon ya está en tu equipo');
    return;
  }
  fetchPokemonBasicData(pokemonId).then(pokemon => {
    if (pokemon) {
      const nickname = prompt(`¿Qué apodo le quieres poner a ${pokemon.name}? (deja vacío para usar el nombre original)`, '');
      const displayName = nickname.trim() || pokemon.name;
      userTeam.push({ id: pokemon.id, name: pokemon.name, apiName: pokemon.apiName, sprite: pokemon.sprite, nickname: displayName });
      localStorage.setItem('pokedex_team', JSON.stringify(userTeam));
      updateTeamUI();
      alert(`${displayName} agregado a tu equipo`);
      if (document.getElementById('equipoView').classList.contains('active')) {
        renderTeamView();
      }
    }
  }).catch(console.error);
}

function removeFromTeam(index) {
  userTeam.splice(index, 1);
  localStorage.setItem('pokedex_team', JSON.stringify(userTeam));
  updateTeamUI();
  if (document.getElementById('equipoView').classList.contains('active')) {
    renderTeamView();
  }
}

function updateTeamUI() {
  const teamCountSpan = document.getElementById('teamCount');
  if (teamCountSpan) teamCountSpan.textContent = userTeam.length;
}

function editNickname(index) {
  const pokemon = userTeam[index];
  const currentNickname = pokemon.nickname || pokemon.name;
  const newNickname = prompt(`Editar apodo para ${pokemon.name}:`, currentNickname);
  if (newNickname !== null) {
    const trimmedNickname = newNickname.trim();
    pokemon.nickname = trimmedNickname || pokemon.name;
    localStorage.setItem('pokedex_team', JSON.stringify(userTeam));
    renderTeamView();
  }
}

function renderTeamView() {
  const container = document.getElementById('teamContainer');
  if (!userTeam.length) {
    container.innerHTML = '<div class="empty-team">No tienes Pokémon en tu equipo. Ve al catálogo y agrega algunos.</div>';
    return;
  }
  container.innerHTML = userTeam.map((p, idx) => `
    <div class="team-card">
      <button class="remove-team-btn" onclick="removeFromTeam(${idx})">✖</button>
      <img src="${p.sprite}" alt="${p.name}">
      <div class="grid-pokemon-id">#${String(p.id).padStart(3,'0')}</div>
      <div class="grid-pokemon-name" onclick="editNickname(${idx})">${p.nickname || p.name}</div>
      <button class="add-to-team-btn" onclick="showPokemonDetail('${p.apiName}')">Ver detalles</button>
    </div>
  `).join('');
}

// ========== NAVEGACIÓN ==========
async function navigateTo(module) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`${module}View`).classList.remove('hidden');
  
  if (module === 'catalogo') {
    loadPage(currentPage);
  } else if (module === 'movimientos') {
    if (totalMovesCount === 0) {
      await getTotalMovesCount();
    }
    loadMovesPage(currentMovesPage);
  } else if (module === 'equipo') {
    renderTeamView();
  } else if (module === 'usuario') {
    loadStoredData();
  }
}

async function navigateToMoveDetail(moveName) {
  await navigateTo('movimientos');
  setTimeout(() => showMoveDetail(moveName), 100);
}

// ========== TEMA ==========
function toggleTheme() {
  document.body.classList.toggle('light');
  const isLight = document.body.classList.contains('light');
  localStorage.setItem('pokedex_theme', isLight ? 'light' : 'dark');
}

function loadTheme() {
  const saved = localStorage.getItem('pokedex_theme');
  if (saved === 'light') document.body.classList.add('light');
  else if (saved === 'dark') document.body.classList.remove('light');
  else if (window.matchMedia('(prefers-color-scheme: light)').matches) document.body.classList.add('light');
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([getTotalPokemonCount(), getTotalMovesCount()]);
  loadTheme();
  loadStoredData();
  setupFilters();
  setupMovesFilters();
  setupPaginationEvents();
  setupMovesPaginationEvents();
  currentPage = 1;
  currentMovesPage = 1;
  await loadPage(1);
  navigateTo('catalogo');
});

function setupPaginationEvents() {
  document.getElementById('firstPageBtn').addEventListener('click', goToFirstPage);
  document.getElementById('prevPageBtn').addEventListener('click', goToPrevPage);
  document.getElementById('nextPageBtn').addEventListener('click', goToNextPage);
  document.getElementById('lastPageBtn').addEventListener('click', goToLastPage);
}

function showLoader(show) {
  const loader = document.getElementById('loader');
  if (loader) loader.classList.toggle('hidden', !show);
}

// ========== HOVER PREVIEW ==========
const evoPreviewCache = {};
let previewEl = null;
let previewActiveId = null;

function getOrCreateTooltip() {
  if (!previewEl) {
    previewEl = document.createElement('div');
    previewEl.className = 'poke-preview-tooltip';
    document.body.appendChild(previewEl);
  }
  return previewEl;
}

function showPreview(card, pokemonId, types, generation) {
  previewActiveId = pokemonId;
  const tooltip = getOrCreateTooltip();

  const typesBadges = types.map(t =>
    `<span class="preview-type-badge" style="background:${TYPE_COLORS[t]}">${getSpanishTypeName(t)}</span>`
  ).join('');

  tooltip.innerHTML = `
    <span class="preview-label">Tipo</span>
    <div class="preview-types">${typesBadges}</div>
    <div class="preview-divider"></div>
    <span class="preview-label">Generación</span>
    <div class="preview-gen">Gen ${generation}</div>
    <div class="preview-divider"></div>
    <span class="preview-label">Evoluciones</span>
    <div class="preview-evos" id="previewEvosInner">
      <span class="preview-evo-loading">Cargando...</span>
    </div>
  `;

  positionTooltip(tooltip, card);
  tooltip.classList.add('visible');

  if (evoPreviewCache[pokemonId] !== undefined) {
    renderPreviewEvos(evoPreviewCache[pokemonId]);
  } else {
    fetchPreviewEvoChain(pokemonId).then(names => {
      evoPreviewCache[pokemonId] = names;
      if (previewActiveId === pokemonId) renderPreviewEvos(names);
    }).catch(() => {
      evoPreviewCache[pokemonId] = [];
      if (previewActiveId === pokemonId) renderPreviewEvos([]);
    });
  }
}

function renderPreviewEvos(stages) {
  const el = document.getElementById('previewEvosInner');
  if (!el) return;
  if (!stages || stages.length === 0) {
    el.innerHTML = '<span class="preview-evo-loading">Sin cadena de evolución</span>';
    return;
  }
  el.innerHTML = stages.map((stage, i) => {
    const items = stage.map(name =>
      `<div class="preview-evo-item"><span class="evo-dot"></span>${name}</div>`
    ).join('');
    const arrow = i < stages.length - 1
      ? '<div class="preview-evo-item evo-arrow-sep">▶</div>'
      : '';
    return items + arrow;
  }).join('');
}

async function fetchPreviewEvoChain(pokemonId) {
  const species = await fetchJSON(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}`);
  const evoData = await fetchJSON(species.evolution_chain.url);
  const stages = collectEvoStages(evoData.chain);
  return Promise.all(stages.map(stageSpecies =>
    Promise.all(stageSpecies.map(async sp => {
      try {
        const id = sp.url.split('/').filter(Boolean).pop();
        const spData = await fetchJSON(sp.url);
        return getSpanishPokemonName(spData, capitalize(sp.name));
      } catch { return capitalize(sp.name); }
    }))
  ));
}

function positionTooltip(tooltip, card) {
  const rect = card.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const TW = 250;
  const TH = 220;

  let left = rect.right + 12;
  let top  = rect.top;

  if (left + TW > vw - 8) left = rect.left - TW - 12;
  if (top + TH > vh - 8) top = vh - TH - 8;
  if (top < 8) top = 8;

  tooltip.style.left = left + 'px';
  tooltip.style.top  = top + 'px';
}

function hidePreview() {
  previewActiveId = null;
  if (previewEl) previewEl.classList.remove('visible');
}

// Exponer funciones globales
window.navigateTo = navigateTo;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.addToTeam = addToTeam;
window.removeFromTeam = removeFromTeam;
window.showPokemonDetail = showPokemonDetail;
window.toggleTheme = toggleTheme;
window.closeMoveDetail = closeMoveDetail;