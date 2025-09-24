class RecipeBook {
    constructor() {
        this.recipes = this.loadRecipes();
        this.nextId = this.getNextId();
        this.extractor = new RecipeExtractor();
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
        this.showApiKeyPrompt();
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

    // Pokazuje monit o klucze API (jednorazowo)
    showApiKeyPrompt() {
        if (!this.extractor.hasApiKey() && !localStorage.getItem('api_prompt_shown')) {
            const setupAI = confirm(`🤖 Chcesz włączyć AI do wyodrębniania przepisów?\n\nBez AI aplikacja będzie działać z podstawowym parserem.\n\nKliknij OK aby skonfigurować AI lub Anuluj aby pominąć.`);
            
            if (setupAI) {
                this.showApiKeySetup();
            } else {
                localStorage.setItem('api_prompt_shown', 'true');
                this.showExtractionStatus('💡 Używam podstawowego parsera. Możesz włączyć AI później w ustawieniach.', 'info');
            }
        }
    }

    // Panel konfiguracji AI
    showApiKeySetup() {
        const apiKey = prompt(`🔑 Wklej swój klucz OpenAI API:\n\n(Zaczyna się od "sk-proj-...")\n\nJeśli nie masz, wejdź na platform.openai.com\ni stwórz nowy klucz w zakładce "API Keys"`);
        
        if (apiKey && apiKey.startsWith('sk-')) {
            this.extractor.setApiKey('openai', apiKey);
            this.showExtractionStatus('✅ AI skonfigurowane! Teraz mogę wyodrębniać przepisy z każdej strony.', 'success');
        } else if (apiKey) {
            alert('❌ Nieprawidłowy klucz API. Klucz OpenAI musi zaczynać się od "sk-"');
        }
        
        localStorage.setItem('api_prompt_shown', 'true');
    }

    // GŁÓWNA FUNKCJA WYODRĘBNIANIA
    async extractRecipe() {
        const urlInput = document.getElementById('recipeUrl');
        const url = urlInput.value.trim();
        
        if (!url) {
            this.showExtractionStatus('Proszę wkleić link do przepisu', 'error');
            return;
        }

        // Sprawdź URL
        try {
            new URL(url);
        } catch (e) {
            this.showExtractionStatus('Nieprawidłowy adres URL', 'error');
            return;
        }

        // UI loading state
        const extractBtn = document.getElementById('extractBtn');
        const extractText = extractBtn.querySelector('.extract-text');
        const spinner = extractBtn.querySelector('.loading-spinner');
        
        extractBtn.disabled = true;
        extractText.classList.add('hidden');
        spinner.classList.remove('hidden');

        this.showExtractionStatus('🔍 Analizuję przepis...', 'info');

        try {
            // Używa prawdziwego ekstraktora
            const recipe = await this.extractor.extractRecipe(url);
            
            if (recipe && recipe.name && recipe.ingredients.length > 0) {
                // Wypełnij formularz
                document.getElementById('recipeName').value = recipe.name;
                document.getElementById('prepTime').value = recipe.prepTime || 'Nie podano';
                document.getElementById('ingredients').value = recipe.ingredients.join('\n');
                document.getElementById('instructions').value = recipe.instructions.join('\n');

                // Pokaż sukces
                if (this.extractor.hasApiKey()) {
                    this.showExtractionStatus('✅ Przepis wyodrębniony przez AI!', 'success');
                } else {
                    this.showExtractionStatus('✅ Przepis wyodrębniony przez parser!', 'success');
                }
            } else {
                throw new Error('Nie znaleziono przepisu na tej stronie');
            }
            
        } catch (error) {
            console.error('Błąd:', error);
            this.showExtractionStatus(`❌ ${error.message}`, 'error');
            
        } finally {
            // Reset UI
            extractBtn.disabled = false;
            extractText.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
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
        
        // Pokaż sukces
        this.showTemporaryMessage('✅ Przepis zapisany!');
    }

    showTemporaryMessage(message) {
        const alert = document.createElement('div');
        alert.className = 'success-alert';
        alert.textContent = message;
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #059669;
            color: white;
            padding: 1rem 2rem;
            border-radius: 0.5rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            font-weight: 500;
        `;
        
        document.body.appendChild(alert);
        
        setTimeout(() => {
            alert.remove();
        }, 3000);
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
                    <p>Dodaj swój pierwszy przepis, aby rozpocząć!</p>
                    <p><small>💡 Wklej link do przepisu - aplikacja wyodrębni składniki i instrukcje automatycznie!</small></p>
                    ${!this.extractor.hasApiKey() ? 
                        '<button onclick="app.showApiKeySetup()" class="btn btn--primary" style="margin-top: 1rem;">🤖 Włącz AI</button>' : 
                        ''
                    }
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
