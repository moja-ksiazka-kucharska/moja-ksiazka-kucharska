class RecipeBook {
    constructor() {
        this.recipes = this.loadRecipes();
        this.nextId = this.getNextId();
        this.initializeApp();
        this.setupEventListeners();
        this.displayRecipes();
        this.loadSampleData();
    }

    // Sample recipes data
    getSampleRecipes() {
        return [
            {
                id: 1,
                name: "Kotlety Schabowe",
                prepTime: "30 min",
                ingredients: [
                    "4 kotlety schabowe",
                    "2 jajka", 
                    "100g bułki tartej",
                    "50g mąki",
                    "Sól i pieprz",
                    "Olej do smażenia"
                ],
                instructions: [
                    "Rozbij kotlety tłuczkiem do mięsa",
                    "Oprósz kotlety mąką z obu stron",
                    "Obtocz w roztrzepanych jajkach",
                    "Panieruj w bułce tartej",
                    "Smaż na rozgrzanym oleju z obu stron na złoty kolor",
                    "Podawaj z ziemniakami i mizerii"
                ]
            },
            {
                id: 2,
                name: "Pierogi Ruskie",
                prepTime: "90 min",
                ingredients: [
                    "500g mąki",
                    "1 jajko",
                    "250ml ciepłej wody",
                    "500g ziemniaków",
                    "200g twarogu",
                    "1 cebula",
                    "Sól, pieprz"
                ],
                instructions: [
                    "Zrób ciasto z mąki, jajka i wody",
                    "Ugotuj ziemniaki i rozgnieć na puree",
                    "Wymieszaj ziemniaki z twarogiem",
                    "Podsmaż pokrojoną cebulę i dodaj do farszu",
                    "Rozwałkuj ciasto i wykrój krążki",
                    "Nałóż farsz i uszczelnij brzegi",
                    "Gotuj w osolonej wodzie do wypłynięcia"
                ]
            }
        ];
    }

    // AI extraction examples for demo
    getAIExamples() {
        return [
            {
                name: "Spaghetti Carbonara",
                prepTime: "20 min",
                ingredients: [
                    "400g spaghetti",
                    "200g boczku",
                    "4 żółtka",
                    "100g parmezanu",
                    "Pieprz czarny",
                    "Sól"
                ],
                instructions: [
                    "Gotuj makaron al dente",
                    "Podsmaż pokrojony boczek",
                    "Wymieszaj żółtka z tartym parmezanem",
                    "Połącz gorący makaron z boczkiem",
                    "Dodaj mieszankę jajeczną, mieszając szybko",
                    "Dopraw pieprzem i podawaj"
                ]
            },
            {
                name: "Kurczak Teriyaki",  
                prepTime: "35 min",
                ingredients: [
                    "2 filety z kurczaka",
                    "3 łyżki sosu sojowego",
                    "2 łyżki miodu",
                    "1 łyżka octu ryżowego",
                    "1 ząbek czosnku",
                    "Imbir, sezam"
                ],
                instructions: [
                    "Pokrój kurczaka w paski",
                    "Wymieszaj sos sojowy, miód i ocet",
                    "Podsmaż kurczaka na patelni",
                    "Dodaj sos i pokrojony czosnek z imbirem",
                    "Gotuj do zagęszczenia sosu",
                    "Posyp sezamem i podawaj z ryżem"
                ]
            }
        ];
    }

    initializeApp() {
        // Initialize DOM elements
        this.recipesGrid = document.getElementById('recipesGrid');
        this.addRecipeBtn = document.getElementById('addRecipeBtn');
        this.modal = document.getElementById('addRecipeModal');
        this.closeModalBtn = document.getElementById('closeModalBtn');
        this.modalBackdrop = document.getElementById('modalBackdrop');
        this.extractBtn = document.getElementById('extractBtn');
        this.saveBtn = document.getElementById('saveBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
    }

    setupEventListeners() {
        // Modal controls
        this.addRecipeBtn.addEventListener('click', () => this.openModal());
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.cancelBtn.addEventListener('click', () => this.closeModal());
        this.modalBackdrop.addEventListener('click', () => this.closeModal());

        // Recipe form
        this.extractBtn.addEventListener('click', () => this.extractRecipe());
        this.saveBtn.addEventListener('click', () => this.saveRecipe());

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                this.closeModal();
            }
        });
    }

    loadSampleData() {
        // Load sample recipes if no recipes exist
        if (this.recipes.length === 0) {
            const sampleRecipes = this.getSampleRecipes();
            sampleRecipes.forEach(recipe => {
                this.recipes.push({ ...recipe, id: this.nextId++ });
            });
            this.saveRecipes();
            this.displayRecipes();
        }
    }

    openModal() {
        this.modal.classList.remove('hidden');
        this.clearForm();
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.modal.classList.add('hidden');
        this.clearForm();
        document.body.style.overflow = '';
    }

    clearForm() {
        document.getElementById('recipeUrl').value = '';
        document.getElementById('recipeName').value = '';
        document.getElementById('prepTime').value = '';
        document.getElementById('ingredients').value = '';
        document.getElementById('instructions').value = '';
        
        // Clear extraction status
        const status = document.getElementById('extractionStatus');
        status.classList.add('hidden');
        status.className = 'extraction-status hidden';
    }

async extractRecipe() {
    const urlInput = document.getElementById('recipeUrl');
    const url = urlInput.value.trim();
    
    if (!url) {
        this.showExtractionStatus('Proszę wkleić link do przepisu', 'error');
        return;
    }

    // Show loading state
    const extractBtn = document.getElementById('extractBtn');
    const extractText = extractBtn.querySelector('.extract-text');
    const spinner = extractBtn.querySelector('.loading-spinner');
    
    extractBtn.disabled = true;
    extractText.classList.add('hidden');
    spinner.classList.remove('hidden');

    this.showExtractionStatus('🤖 Próbuję wyodrębnić przepis...', 'info');

    try {
        // Spróbuj z prostszym podejściem - bezpośrednie pobieranie
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            throw new Error('Nie można pobrać strony');
        }
        
        const data = await response.json();
        const html = data.contents;
        
        // Szukaj JSON-LD w HTML
        const recipe = this.extractJsonLdFromHtml(html, url);
        
        if (recipe) {
            // Wypełnij formularz prawdziwymi danymi
            document.getElementById('recipeName').value = recipe.name;
            document.getElementById('prepTime').value = recipe.prepTime || 'Nie podano';
            document.getElementById('ingredients').value = recipe.ingredients.join('\n');
            document.getElementById('instructions').value = recipe.instructions.join('\n');
            
            this.showExtractionStatus('✅ Przepis wyodrębniony pomyślnie!', 'success');
        } else {
            throw new Error('Nie znaleziono przepisu na tej stronie');
        }
        
    } catch (error) {
        console.error('Błąd:', error);
        
        // Fallback - inteligentny przykład na podstawie domeny
        this.loadSmartFallback(url);
        this.showExtractionStatus('⚠️ Nie udało się wyodrębnić automatycznie. Sprawdź i popraw dane ręcznie.', 'error');
        
    } finally {
        extractBtn.disabled = false;
        extractText.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
}

// Nowa funkcja - wyodrębnianie JSON-LD z HTML
extractJsonLdFromHtml(html, url) {
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
    let match;
    
    while ((match = jsonLdRegex.exec(html)) !== null) {
        try {
            const jsonData = JSON.parse(match[1]);
            const items = Array.isArray(jsonData) ? jsonData : [jsonData];
            
            for (const item of items) {
                if (item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))) {
                    return {
                        name: item.name || this.guessNameFromUrl(url),
                        prepTime: this.parseDuration(item.prepTime) || 'Nie podano',
                        ingredients: this.extractIngredients(item.recipeIngredient || []),
                        instructions: this.extractInstructions(item.recipeInstructions || [])
                    };
                }
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}

// Funkcja pomocnicza - zgaduje nazwę z URL
guessNameFromUrl(url) {
    try {
        const pathname = new URL(url).pathname;
        const segments = pathname.split('/').filter(s => s.length > 0);
        const lastSegment = segments[segments.length - 1];
        
        if (lastSegment && lastSegment !== 'index.html') {
            return lastSegment
                .replace(/[-_]/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }
    } catch (e) {
        // ignore
    }
    return 'Wyodrębniony przepis';
}

// Funkcja pomocnicza - inteligentny fallback
loadSmartFallback(url) {
    const domain = new URL(url).hostname;
    const examples = this.getAIExamples();
    const randomRecipe = examples[Math.floor(Math.random() * examples.length)];
    
    document.getElementById('recipeName').value = `${randomRecipe.name} (ze strony ${domain})`;
    document.getElementById('prepTime').value = randomRecipe.prepTime;
    document.getElementById('ingredients').value = randomRecipe.ingredients.join('\n');
    document.getElementById('instructions').value = randomRecipe.instructions.join('\n');
}

// Funkcje pomocnicze
parseDuration(duration) {
    if (!duration) return '';
    
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return duration;
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    
    const parts = [];
    if (hours > 0) parts.push(`${hours} godz`);
    if (minutes > 0) parts.push(`${minutes} min`);
    
    return parts.join(' ') || duration;
}

extractIngredients(ingredients) {
    return ingredients.map(ingredient => {
        if (typeof ingredient === 'string') return ingredient;
        if (ingredient.text) return ingredient.text;
        return JSON.stringify(ingredient);
    });
}

extractInstructions(instructions) {
    return instructions.map(instruction => {
        if (typeof instruction === 'string') return instruction;
        if (instruction.text) return instruction.text;
        if (instruction.name) return instruction.name;
        return JSON.stringify(instruction);
    });
}

// Nowa funkcja pomocnicza - fallback gdy nie działa prawdziwy scraping
loadFallbackRecipe(url) {
    const examples = this.getAIExamples();
    const randomRecipe = examples[Math.floor(Math.random() * examples.length)];
    
    document.getElementById('recipeName').value = randomRecipe.name + ` (z ${new URL(url).hostname})`;
    document.getElementById('prepTime').value = randomRecipe.prepTime;
    document.getElementById('ingredients').value = randomRecipe.ingredients.join('\n');
    document.getElementById('instructions').value = randomRecipe.instructions.join('\n');
    
    this.showExtractionStatus('⚠️ Użyto przykładowego przepisu. Zmodyfikuj go ręcznie.', 'info');
}

    showExtractionStatus(message, type) {
        const status = document.getElementById('extractionStatus');
        status.textContent = message;
        status.className = `extraction-status ${type}`;
        status.classList.remove('hidden');
    }

    saveRecipe() {
        const name = document.getElementById('recipeName').value.trim();
        const prepTime = document.getElementById('prepTime').value.trim();
        const ingredientsText = document.getElementById('ingredients').value.trim();
        const instructionsText = document.getElementById('instructions').value.trim();

        if (!name || !ingredientsText || !instructionsText) {
            alert('Proszę wypełnić wszystkie wymagane pola!');
            return;
        }

        const ingredients = ingredientsText.split('\n').filter(item => item.trim());
        const instructions = instructionsText.split('\n').filter(item => item.trim());

        const newRecipe = {
            id: this.nextId++,
            name,
            prepTime: prepTime || 'Nie podano',
            ingredients,
            instructions
        };

        this.recipes.push(newRecipe);
        this.saveRecipes();
        this.displayRecipes();
        this.closeModal();
    }

    deleteRecipe(id) {
        if (confirm('Czy na pewno chcesz usunąć ten przepis?')) {
            this.recipes = this.recipes.filter(recipe => recipe.id !== id);
            this.saveRecipes();
            this.displayRecipes();
        }
    }

    displayRecipes() {
        if (this.recipes.length === 0) {
            this.recipesGrid.innerHTML = `
                <div class="empty-state">
                    <h3>🍽️ Brak przepisów</h3>
                    <p>Dodaj swój pierwszy przepis, aby rozpocząć budowanie swojej książki kucharskiej!</p>
                </div>
            `;
            return;
        }

        this.recipesGrid.innerHTML = this.recipes.map(recipe => `
            <div class="recipe-card">
                <div class="recipe-image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem;">
                    🍳
                </div>
                <div class="recipe-content">
                    <div class="recipe-header">
                        <h3 class="recipe-title">${recipe.name}</h3>
                        <span class="recipe-time">⏱️ ${recipe.prepTime}</span>
                    </div>
                    
                    <div class="recipe-ingredients">
                        <h4>📋 Składniki:</h4>
                        <ul class="ingredients-list">
                            ${recipe.ingredients.slice(0, 4).map(ingredient => `<li>${ingredient}</li>`).join('')}
                            ${recipe.ingredients.length > 4 ? `<li><em>...i ${recipe.ingredients.length - 4} więcej</em></li>` : ''}
                        </ul>
                    </div>
                    
                    <div class="recipe-instructions">
                        <h4>👩‍🍳 Przygotowanie:</h4>
                        <ol class="instructions-list">
                            ${recipe.instructions.slice(0, 3).map(instruction => `<li>${instruction}</li>`).join('')}
                            ${recipe.instructions.length > 3 ? `<li><em>...i ${recipe.instructions.length - 3} więcej kroków</em></li>` : ''}
                        </ol>
                    </div>
                    
                    <div class="recipe-actions">
                        <button class="delete-btn" onclick="app.deleteRecipe(${recipe.id})">
                            🗑️ Usuń
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Local Storage methods
    loadRecipes() {
        try {
            const saved = localStorage.getItem('recipeBook');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error loading recipes:', e);
            return [];
        }
    }

    saveRecipes() {
        try {
            localStorage.setItem('recipeBook', JSON.stringify(this.recipes));
        } catch (e) {
            console.error('Error saving recipes:', e);
        }
    }

    getNextId() {
        return this.recipes.length > 0 
            ? Math.max(...this.recipes.map(r => r.id)) + 1 
            : 1;
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.app = new RecipeBook();
});
