const POKE_API_BASE_URL = 'https://pokeapi.co/api/v2';
let allPokemon = [];
let filteredPokemon = [];

// DOM Elements
const pokemonGrid = document.getElementById('pokemonGrid');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const modal = document.getElementById('pokemonModal');
const modalContent = document.getElementById('modalContent');
const closeBtn = document.querySelector('.close');

// Helper function to capitalize first letter
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

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
        pokemonGrid.innerHTML = '<div style="text-align: center; padding: 20px;">Loading Pokémon... This may take a few minutes.</div>';
        
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
        pokemonGrid.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">Error loading Pokémon. Please try again later.</div>';
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

        return {
            id: data.id,
            name: data.name,
            types: data.types.map(type => type.type.name),
            stats: data.stats,
            sprites: data.sprites,
            height: data.height,
            weight: data.weight,
            abilities: data.abilities,
            moves: data.moves.slice(0, 5), // Get first 5 moves
            evolutionChain,
            description: speciesData.flavor_text_entries.find(entry => entry.language.name === 'en')?.flavor_text || ''
        };
    } catch (error) {
        console.error('Error fetching Pokemon details:', error);
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

// Add speech synthesis function
function speakPokemonName(name) {
    const utterance = new SpeechSynthesisUtterance(capitalizeFirstLetter(name));
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
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

    card.innerHTML = `
        <img src="${pokemon.sprites.front_default}" alt="${capitalizeFirstLetter(pokemon.name)}">
        <div class="pokemon-name-container">
            <h2>${capitalizeFirstLetter(pokemon.name)}</h2>
            <button class="audio-button" title="Pronounce name">🔊</button>
        </div>
        <div class="type-badges">
            ${pokemon.types.map(type => `
                <span class="type-badge" style="background-color: ${typeColors[type]}">${type}</span>
            `).join('')}
        </div>
        <div class="evolution-chain">
            ${pokemon.evolutionChain.map(evo => `
                <a href="#" class="evolution-link" data-pokemon="${evo.name}">
                    <img src="${evo.sprite}" alt="${capitalizeFirstLetter(evo.name)}" title="${capitalizeFirstLetter(evo.name)}">
                </a>
            `).join('')}
        </div>
    `;

    // Add click event for the audio button
    const audioButton = card.querySelector('.audio-button');
    audioButton.addEventListener('click', (e) => {
        e.stopPropagation();
        speakPokemonName(pokemon.name);
    });

    // Add click event for the main card
    card.addEventListener('click', (e) => {
        // Don't trigger if clicking on an evolution link or audio button
        if (!e.target.closest('.evolution-link') && !e.target.closest('.audio-button')) {
            showPokemonDetails(pokemon);
        }
    });

    // Add click events for evolution links
    card.querySelectorAll('.evolution-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const evoPokemon = allPokemon.find(p => p.name === link.dataset.pokemon);
            if (evoPokemon) {
                showPokemonDetails(evoPokemon);
            }
        });
    });

    return card;
}

// Show Pokemon details in modal
function showPokemonDetails(pokemon) {
    modalContent.innerHTML = `
        <div class="pokemon-name-container">
            <h2>${capitalizeFirstLetter(pokemon.name)}</h2>
            <button class="audio-button" title="Pronounce name">🔊</button>
        </div>
        <img src="${pokemon.sprites.front_default}" alt="${capitalizeFirstLetter(pokemon.name)}" style="width: 200px; display: block; margin: 20px auto;">
        <p>${pokemon.description}</p>
        
        <div class="stats-container">
            ${pokemon.stats.map(stat => `
                <div class="stat-item">
                    <span>${capitalizeFirstLetter(stat.stat.name.replace('-', ' '))}</span>
                    <span>${stat.base_stat}</span>
                </div>
            `).join('')}
        </div>

        <h3>Key Moves</h3>
        <div class="attacks-list">
            ${pokemon.moves.map(move => `
                <div class="attack-item">
                    <span>${capitalizeFirstLetter(move.move.name.replace('-', ' '))}</span>
                </div>
            `).join('')}
        </div>

        <h3>Evolution Chain</h3>
        <div class="evolution-chain">
            ${pokemon.evolutionChain.map(evo => `
                <a href="#" class="evolution-link" data-pokemon="${evo.name}">
                    <img src="${evo.sprite}" alt="${capitalizeFirstLetter(evo.name)}" title="${capitalizeFirstLetter(evo.name)}">
                </a>
            `).join('')}
        </div>
    `;

    // Add click event for the audio button in modal
    const modalAudioButton = modalContent.querySelector('.audio-button');
    modalAudioButton.addEventListener('click', (e) => {
        e.stopPropagation();
        speakPokemonName(pokemon.name);
    });

    // Add click events for evolution links in modal
    modalContent.querySelectorAll('.evolution-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const evoPokemon = allPokemon.find(p => p.name === link.dataset.pokemon);
            if (evoPokemon) {
                showPokemonDetails(evoPokemon);
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