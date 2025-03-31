const POKE_API_BASE_URL = 'https://pokeapi.co/api/v2';
const SCRYFALL_API_URL = 'https://api.scryfall.com/cards/search';
let allPokemon = [];
let filteredPokemon = [];

// DOM Elements
const pokemonGrid = document.getElementById('pokemonGrid');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const modal = document.getElementById('pokemonModal');
const modalContent = document.getElementById('modalContent');
const closeBtn = document.querySelector('.close');

// Event Listeners
searchInput.addEventListener('input', filterPokemon);
typeFilter.addEventListener('change', filterPokemon);
closeBtn.addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
});

// Fetch all Pokemon
async function fetchAllPokemon() {
    try {
        // First, get the total count of Pokemon
        const response = await fetch(`${POKE_API_BASE_URL}/pokemon?limit=1`);
        const countResponse = await response.json();
        const totalPokemon = countResponse.count;

        // Now fetch all Pokemon
        const allPokemonResponse = await fetch(`${POKE_API_BASE_URL}/pokemon?limit=${totalPokemon}`);
        const data = await allPokemonResponse.json();
        
        // Show loading message
        pokemonGrid.innerHTML = '<div style="text-align: center; padding: 20px;">Loading Pokemon... This may take a few minutes.</div>';
        
        // Fetch details for all Pokemon
        allPokemon = await Promise.all(
            data.results.map(async (pokemon) => {
                const details = await fetchPokemonDetails(pokemon.url);
                return details;
            })
        );
        
        // Filter out any null values (in case of failed fetches)
        allPokemon = allPokemon.filter(pokemon => pokemon !== null);
        filteredPokemon = [...allPokemon];
        displayPokemon();
    } catch (error) {
        console.error('Error fetching Pokemon:', error);
        pokemonGrid.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">Error loading Pokemon. Please try again later.</div>';
    }
}

// Fetch Pokemon details
async function fetchPokemonDetails(url) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // Fetch species data for evolution chain
        const speciesResponse = await fetch(data.species.url);
        const speciesData = await speciesResponse.json();
        
        // Fetch evolution chain if available
        let evolutionChain = [];
        if (speciesData.evolution_chain) {
            const evolutionResponse = await fetch(speciesData.evolution_chain.url);
            const evolutionData = await evolutionResponse.json();
            evolutionChain = await processEvolutionChain(evolutionData.chain);
        }

        // Fetch MTG card data
        const mtgCard = await fetchMTGCard(data.name);

        return {
            id: data.id,
            name: data.name,
            types: data.types.map(type => type.type.name),
            stats: data.stats,
            sprites: data.sprites,
            height: data.height,
            weight: data.weight,
            abilities: data.abilities,
            moves: data.moves.slice(0, 5),
            evolutionChain,
            description: speciesData.flavor_text_entries.find(entry => entry.language.name === 'en')?.flavor_text || '',
            mtgCard
        };
    } catch (error) {
        console.error('Error fetching Pokemon details:', error);
        return null;
    }
}

// Fetch MTG card data
async function fetchMTGCard(pokemonName) {
    try {
        // Search for Pokemon-themed cards
        const response = await fetch(`${SCRYFALL_API_URL}?q=name:${encodeURIComponent(pokemonName)}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            // Get the first matching card
            return {
                name: data.data[0].name,
                imageUrl: data.data[0].image_uris?.small || null
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching MTG card:', error);
        return null;
    }
}

// Process evolution chain
async function processEvolutionChain(chain) {
    const evolutions = [];
    let current = chain;
    
    while (current) {
        const speciesName = current.species.name;
        const response = await fetch(`${POKE_API_BASE_URL}/pokemon/${speciesName}`);
        const data = await response.json();
        evolutions.push({
            name: speciesName,
            sprite: data.sprites.front_default
        });
        current = current.evolves_to[0];
    }
    
    return evolutions;
}

// Display Pokemon cards
function displayPokemon() {
    pokemonGrid.innerHTML = '';
    filteredPokemon.forEach(pokemon => {
        const card = createPokemonCard(pokemon);
        pokemonGrid.appendChild(card);
    });
}

// Create Pokemon card
function createPokemonCard(pokemon) {
    const card = document.createElement('div');
    card.className = 'pokemon-card';
    
    const typeColors = {
        normal: '#A8A878',
        fire: '#F08030',
        water: '#6890F0',
        electric: '#F8D030',
        grass: '#78C850',
        ice: '#98D8D8',
        fighting: '#C03028',
        poison: '#A040A0',
        ground: '#E0C068',
        flying: '#A890F0',
        psychic: '#F85888',
        bug: '#A8B820',
        rock: '#B8A038',
        ghost: '#705898',
        dragon: '#7038F8',
        dark: '#705848',
        steel: '#B8B8D0',
        fairy: '#EE99AC'
    };

    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

    card.innerHTML = `
        <div class="pokemon-images">
            <img src="${pokemon.sprites.front_default}" alt="${capitalize(pokemon.name)}" class="pokemon-sprite">
            ${pokemon.mtgCard ? `
                <img src="${pokemon.mtgCard.imageUrl}" alt="${pokemon.mtgCard.name}" class="mtg-card" title="${pokemon.mtgCard.name}">
            ` : ''}
        </div>
        <h2>${capitalize(pokemon.name)}</h2>
        <div class="type-badges">
            ${pokemon.types.map(type => `
                <span class="type-badge" style="background-color: ${typeColors[type]}">${capitalize(type)}</span>
            `).join('')}
        </div>
        <div class="evolution-chain">
            ${pokemon.evolutionChain.map(evo => `
                <img src="${evo.sprite}" alt="${capitalize(evo.name)}" title="${capitalize(evo.name)}" data-pokemon-name="${evo.name}">
            `).join('')}
        </div>
    `;

    // Add click handler for the card
    card.addEventListener('click', () => showPokemonDetails(pokemon));

    // Add click handlers for evolution chain images
    const evolutionImages = card.querySelectorAll('.evolution-chain img');
    evolutionImages.forEach(img => {
        img.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click
            const pokemonName = img.dataset.pokemonName;
            const targetPokemon = allPokemon.find(p => p.name === pokemonName);
            if (targetPokemon) {
                showPokemonDetails(targetPokemon);
            }
        });
    });

    return card;
}

// Show Pokemon details in modal
function showPokemonDetails(pokemon) {
    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
    
    modalContent.innerHTML = `
        <h2>${capitalize(pokemon.name)}</h2>
        <img src="${pokemon.sprites.front_default}" alt="${capitalize(pokemon.name)}" style="width: 150px; display: block; margin: 20px auto;">
        <p>${pokemon.description}</p>
        
        <div class="stats-container">
            ${pokemon.stats.map(stat => `
                <div class="stat-item">
                    <span>${capitalize(stat.stat.name)}</span>
                    <span>${stat.base_stat}</span>
                </div>
            `).join('')}
        </div>

        <h3>Key Moves</h3>
        <div class="attacks-list">
            ${pokemon.moves.map(move => `
                <div class="attack-item">
                    <span>${capitalize(move.move.name)}</span>
                </div>
            `).join('')}
        </div>

        <h3>Evolution Chain</h3>
        <div class="evolution-chain">
            ${pokemon.evolutionChain.map(evo => `
                <img src="${evo.sprite}" alt="${capitalize(evo.name)}" title="${capitalize(evo.name)}" data-pokemon-name="${evo.name}">
            `).join('')}
        </div>
    `;
    
    // Add click handlers for evolution chain images in modal
    const modalEvolutionImages = modalContent.querySelectorAll('.evolution-chain img');
    modalEvolutionImages.forEach(img => {
        img.addEventListener('click', () => {
            const pokemonName = img.dataset.pokemonName;
            const targetPokemon = allPokemon.find(p => p.name === pokemonName);
            if (targetPokemon) {
                showPokemonDetails(targetPokemon);
            }
        });
    });
    
    modal.style.display = 'block';
}

// Filter Pokemon based on search and type
function filterPokemon() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedType = typeFilter.value;

    filteredPokemon = allPokemon.filter(pokemon => {
        const matchesSearch = pokemon.name.toLowerCase().includes(searchTerm);
        const matchesType = !selectedType || pokemon.types.includes(selectedType);
        return matchesSearch && matchesType;
    });

    displayPokemon();
}

// Initialize the application
fetchAllPokemon(); 