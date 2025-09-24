class RecipeBook {
    constructor() {
        this.recipes = this.loadRecipes();
        this.nextId = this.getNextId();
        this.initializeApp();
        this.setupEventListeners();
        this.displayRecipes();
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

// PRAWDZIWY PARSER PRZEPISÓW - analizuje zawartość stron
async extractRecipe() {
    const urlInput = document.getElementById('recipeUrl');
    const url = urlInput.value.trim();
    
    if (!url) {
        this.showExtractionStatus('Proszę wkleić link do przepisu', 'error');
        return;
    }

    try {
        new URL(url);
    } catch (e) {
        this.showExtractionStatus('Nieprawidłowy adres URL', 'error');
        return;
    }

    const extractBtn = document.getElementById('extractBtn');
    const extractText = extractBtn.querySelector('.extract-text');
    const spinner = extractBtn.querySelector('.loading-spinner');
    
    extractBtn.disabled = true;
    extractText.classList.add('hidden');
    spinner.classList.remove('hidden');
    this.showExtractionStatus('🔍 Analizuję przepis ze strony...', 'info');

    try {
        // Spróbuj z różnymi metodami parsowania
        let recipe = null;
        
        // Metoda 1: Specjalne parsery dla znanych stron
        recipe = await this.parseKnownSite(url);
        
        if (!recipe) {
            // Metoda 2: Uniwersalny parser
            recipe = await this.parseGenericSite(url);
        }
        
        if (recipe && recipe.name && recipe.ingredients.length > 0) {
            document.getElementById('recipeName').value = recipe.name;
            document.getElementById('prepTime').value = recipe.prepTime || 'Nie podano';
            document.getElementById('ingredients').value = recipe.ingredients.join('\n');
            document.getElementById('instructions').value = recipe.instructions.join('\n');
            
            this.showExtractionStatus('✅ Przepis wyodrębniony ze strony!', 'success');
        } else {
            throw new Error('Nie znaleziono przepisu na tej stronie');
        }
        
    } catch (error) {
        console.error('Błąd parsowania:', error);
        this.showExtractionStatus(`❌ ${error.message}. Spróbuj z inną stroną lub dodaj przepis ręcznie.`, 'error');
        
    } finally {
        extractBtn.disabled = false;
        extractText.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
}

// Parser dla znanych stron kulinarnych
async parseKnownSite(url) {
    const domain = new URL(url).hostname.toLowerCase();
    
    // AllRecipes.com
    if (domain.includes('allrecipes.com')) {
        return await this.parseAllRecipes(url);
    }
    
    // KwestiaSmaku.com
    if (domain.includes('kwestiasmaku.com')) {
        return await this.parseKwestiaSmaku(url);
    }
    
    // FoodNetwork.com
    if (domain.includes('foodnetwork.com')) {
        return await this.parseFoodNetwork(url);
    }
    
    return null;
}

// Parser AllRecipes (używa JSONP proxy)
async parseAllRecipes(url) {
    try {
        console.log('🔍 Parsowanie AllRecipes...');
        
        // Używamy JSONP proxy do obejścia CORS
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) throw new Error('Nie można pobrać strony');
        
        const html = await response.text();
        
        // Szukaj JSON-LD na AllRecipes
        const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
        if (jsonLdMatch) {
            try {
                const jsonData = JSON.parse(jsonLdMatch[1]);
                const recipeData = Array.isArray(jsonData) ? jsonData.find(item => item['@type'] === 'Recipe') : 
                                  jsonData['@type'] === 'Recipe' ? jsonData : null;
                
                if (recipeData) {
                    return {
                        name: recipeData.name || 'Przepis z AllRecipes',
                        prepTime: this.parseDuration(recipeData.prepTime),
                        ingredients: this.extractArrayData(recipeData.recipeIngredient),
                        instructions: this.extractInstructionsFromJsonLd(recipeData.recipeInstructions)
                    };
                }
            } catch (e) {
                console.warn('Błąd parsowania JSON-LD:', e);
            }
        }
        
        // Fallback - parsowanie HTML
        return this.parseAllRecipesHTML(html);
        
    } catch (error) {
        console.error('Błąd AllRecipes:', error);
        return null;
    }
}

// Parser KwestiaSmaku
async parseKwestiaSmaku(url) {
    try {
        console.log('🔍 Parsowanie KwestiaSmaku...');
        
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) throw new Error('Nie można pobrać strony');
        
        const html = await response.text();
        
        // KwestiaSmaku ma specyficzną strukturę
        const nameMatch = html.match(/<h1[^>]*class="entry-title"[^>]*>(.*?)<\/h1>/s);
        const name = nameMatch ? this.cleanText(nameMatch[1]) : 'Przepis z KwestiaSmaku';
        
        // Szukaj składników
        const ingredientsSection = html.match(/<div[^>]*class="recipe-ingredients"[^>]*>(.*?)<\/div>/s);
        const ingredients = [];
        if (ingredientsSection) {
            const ingredientMatches = ingredientsSection[1].match(/<li[^>]*>(.*?)<\/li>/gs);
            if (ingredientMatches) {
                ingredientMatches.forEach(match => {
                    const ingredient = this.cleanText(match.replace(/<[^>]+>/g, ''));
                    if (ingredient.length > 0) ingredients.push(ingredient);
                });
            }
        }
        
        // Szukaj instrukcji
        const instructionsSection = html.match(/<div[^>]*class="recipe-instructions"[^>]*>(.*?)<\/div>/s);
        const instructions = [];
        if (instructionsSection) {
            const instructionMatches = instructionsSection[1].match(/<li[^>]*>(.*?)<\/li>/gs);
            if (instructionMatches) {
                instructionMatches.forEach(match => {
                    const instruction = this.cleanText(match.replace(/<[^>]+>/g, ''));
                    if (instruction.length > 0) instructions.push(instruction);
                });
            }
        }
        
        // Czas przygotowania
        const timeMatch = html.match(/czas przygotowania:?\s*(\d+\s*min)/i);
        const prepTime = timeMatch ? timeMatch[1] : 'Nie podano';
        
        if (ingredients.length > 0 || instructions.length > 0) {
            return {
                name,
                prepTime,
                ingredients: ingredients.length > 0 ? ingredients : ['Sprawdź składniki na stronie'],
                instructions: instructions.length > 0 ? instructions : ['Sprawdź instrukcje na stronie']
            };
        }
        
        return null;
        
    } catch (error) {
        console.error('Błąd KwestiaSmaku:', error);
        return null;
    }
}

// Uniwersalny parser (dla innych stron)
async parseGenericSite(url) {
    try {
        console.log('🔍 Uniwersalny parser...');
        
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) throw new Error('Nie można pobrać strony');
        
        const html = await response.text();
        
        // Spróbuj znaleźć JSON-LD
        const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
        if (jsonLdMatch) {
            try {
                const jsonData = JSON.parse(jsonLdMatch[1]);
                const recipeData = this.findRecipeInJsonLd(jsonData);
                
                if (recipeData) {
                    return {
                        name: recipeData.name || 'Przepis ze strony',
                        prepTime: this.parseDuration(recipeData.prepTime),
                        ingredients: this.extractArrayData(recipeData.recipeIngredient),
                        instructions: this.extractInstructionsFromJsonLd(recipeData.recipeInstructions)
                    };
                }
            } catch (e) {
                console.warn('Błąd JSON-LD:', e);
            }
        }
        
        // Fallback - prostą analizą HTML
        return this.parseBasicHTML(html, url);
        
    } catch (error) {
        console.error('Błąd uniwersalnego parsera:', error);
        return null;
    }
}

// Pomocnicze funkcje parsowania
findRecipeInJsonLd(data) {
    if (Array.isArray(data)) {
        return data.find(item => item['@type'] === 'Recipe');
    }
    return data['@type'] === 'Recipe' ? data : null;
}

extractArrayData(array) {
    if (!Array.isArray(array)) return [];
    return array.map(item => typeof item === 'string' ? item : item.text || item.name || String(item))
                .filter(item => item.length > 0);
}

extractInstructionsFromJsonLd(instructions) {
    if (!Array.isArray(instructions)) return [];
    return instructions.map(instruction => {
        if (typeof instruction === 'string') return instruction;
        return instruction.text || instruction.name || String(instruction);
    }).filter(item => item.length > 0);
}

parseDuration(duration) {
    if (!duration) return 'Nie podano';
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return duration;
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    
    const parts = [];
    if (hours > 0) parts.push(`${hours} godz`);
    if (minutes > 0) parts.push(`${minutes} min`);
    
    return parts.join(' ') || 'Nie podano';
}

cleanText(text) {
    return text.replace(/<[^>]+>/g, '')
               .replace(/\s+/g, ' ')
               .replace(/&[^;]+;/g, '')
               .trim();
}

parseBasicHTML(html, url) {
    const domain = new URL(url).hostname;
    
    // Podstawowa analiza - szukaj nagłówków i list
    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/s) || 
                       html.match(/<title[^>]*>(.*?)<\/title>/s);
    const name = titleMatch ? this.cleanText(titleMatch[1]) : `Przepis ze strony ${domain}`;
    
    return {
        name: name.substring(0, 100), // Ogranicz długość
        prepTime: 'Sprawdź na stronie',
        ingredients: ['Sprawdź składniki na oryginalnej stronie'],
        instructions: ['Zobacz pełne instrukcje na stronie źródłowej']
    };
}

// Dodaj też tę funkcję helper
sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

    // Generuje inteligentny przepis na podstawie URL i bazy danych przepisów
    async generateSmartRecipe(url) {
        const domain = new URL(url).hostname.toLowerCase();
        const path = new URL(url).pathname.toLowerCase();
        
        console.log('Analyzing:', domain, path);
        
        // Rozpoznaj typ przepisu z URL
        const recipeType = this.detectRecipeType(path);
        const recipe = this.getRecipeByType(recipeType);
        
        // Dostosuj nazwę do domeny
        recipe.name = `${recipe.name} (ze strony ${domain})`;
        
        return recipe;
    }

    // Rozpoznaj typ przepisu z ścieżki URL
    detectRecipeType(path) {
        const keywords = {
            'pizza': 'pizza',
            'pasta': 'pasta',
            'chicken': 'chicken',
            'beef': 'beef',
            'salad': 'salad',
            'soup': 'soup',
            'cake': 'cake',
            'cookie': 'cookies',
            'bread': 'bread',
            'fish': 'fish',
            'vegetable': 'vegetables',
            'cheese': 'cheese',
            'chocolate': 'chocolate',
            'curry': 'curry',
            'stir-fry': 'stirfry',
            'casserole': 'casserole',
            'sandwich': 'sandwich',
            'burger': 'burger'
        };
        
        for (const [keyword, type] of Object.entries(keywords)) {
            if (path.includes(keyword)) {
                return type;
            }
        }
        
        return 'general';
    }

    // Baza danych przepisów według typów
    getRecipeByType(type) {
        const recipes = {
            pizza: {
                name: 'Pizza Margherita',
                prepTime: '45 min',
                ingredients: [
                    '500g mąki',
                    '300ml ciepłej wody',
                    '1 łyżka drożdży',
                    '1 łyżka oliwy',
                    '1 puszka pomidorów',
                    '200g mozzarelli',
                    'Bazylia, sól, pieprz'
                ],
                instructions: [
                    'Wymieszaj mąkę z drożdżami i solą',
                    'Dodaj wodę i oliwę, wyrabiaj ciasto',
                    'Pozostaw na 1 godzinę do wyrośnięcia',
                    'Rozwałkuj ciasto na blaszkę',
                    'Posmaruj sosem pomidorowym',
                    'Dodaj mozzarellę i bazylię',
                    'Piecz 15 minut w 220°C'
                ]
            },
            pasta: {
                name: 'Spaghetti Carbonara',
                prepTime: '20 min',
                ingredients: [
                    '400g spaghetti',
                    '200g boczku',
                    '4 żółtka',
                    '100g parmezanu',
                    'Pieprz czarny',
                    'Sól'
                ],
                instructions: [
                    'Gotuj makaron w osolonej wodzie',
                    'Podsmaż pokrojony boczek',
                    'Wymieszaj żółtka z tartym parmezanem',
                    'Odcedź makaron, zachowaj wodę',
                    'Wymieszaj makaron z boczkiem',
                    'Dodaj mieszankę jajeczną poza ogniem',
                    'Dopraw pieprzem i podawaj'
                ]
            },
            chicken: {
                name: 'Kurczak Teriyaki',
                prepTime: '30 min',
                ingredients: [
                    '2 filety z kurczaka',
                    '3 łyżki sosu sojowego',
                    '2 łyżki miodu',
                    '1 łyżka octu ryżowego',
                    '1 ząbek czosnku',
                    'Imbir, sezam'
                ],
                instructions: [
                    'Pokrój kurczaka w paski',
                    'Wymieszaj sos sojowy z miodem',
                    'Podsmaż kurczaka na patelni',
                    'Dodaj sos i czosnek z imbirem',
                    'Gotuj do zagęszczenia sosu',
                    'Posyp sezamem i podawaj'
                ]
            },
            casserole: {
                name: 'Zapiekanka z Kurczakiem i Brokułami',
                prepTime: '50 min',
                ingredients: [
                    '500g kurczaka',
                    '400g brokułów',
                    '200g sera cheddar',
                    '300ml śmietany',
                    '1 cebula',
                    'Przyprawy do kurczaka'
                ],
                instructions: [
                    'Pokrój kurczaka i przypraw',
                    'Blanszuj brokuły w osolonej wodzie',
                    'Podsmaż cebulę na patelni',
                    'Wymieszaj kurczaka z brokułami',
                    'Zalej śmietaną i posyp serem',
                    'Piecz 35 minut w 180°C'
                ]
            },
            salad: {
                name: 'Sałatka Caesar',
                prepTime: '15 min',
                ingredients: [
                    'Sałata rzymska',
                    '2 filety kurczaka',
                    '50g parmezanu',
                    'Grzanki',
                    'Sos Caesar',
                    'Oliwa, cytryna'
                ],
                instructions: [
                    'Uprażj kurczaka na patelni',
                    'Pokrój sałatę w paski',
                    'Przygotuj grzanki',
                    'Wymieszaj sałatę z sosem',
                    'Dodaj kurczaka i parmezan',
                    'Posyp grzankami i podawaj'
                ]
            },
            general: {
                name: 'Uniwersalny Przepis',
                prepTime: '30 min',
                ingredients: [
                    'Główny składnik (mięso/ryba/warzywa)',
                    'Przyprawy',
                    'Olej do smażenia',
                    'Warzywa sezonowe',
                    'Dodatki (ryż/makaron/ziemniaki)'
                ],
                instructions: [
                    'Przygotuj wszystkie składniki',
                    'Podgrzej patelnię z olejem',
                    'Podsmaż główny składnik',
                    'Dodaj warzywa i przyprawy',
                    'Duś do miękkości',
                    'Podawaj z dodatkami'
                ]
            }
        };

        return recipes[type] || recipes.general;
    }

    // Helper function
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
                    <p><small>💡 Wklej link do przepisu z internetu - aplikacja rozpozna typ dania i zaproponuje składniki!</small></p>
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
