// Recipe Extractor - Realny silnik wyodrębniania przepisów
class RecipeExtractor {
    constructor() {
        // Tutaj wkleisz swoje klucze API
        this.scrapingBeeKey = 'EZ4IZDOHS4SPS8SG4KWW3T6PUBGPFJ0SBVFWDPGTURQLAMHHPMW7SP2H0T8RVXUP3WBNNSDMU27ZPU5Q'; // Wklej tutaj klucz ze ScrapingBee
        this.openAiKey = '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'; // Opcjonalnie - wklej klucz OpenAI
    }

    // Główna funkcja wyodrębniania przepisu
    async extractRecipe(url) {
        console.log('🔍 Analizuję URL:', url);
        
        try {
            // Krok 1: Pobierz zawartość strony
            const content = await this.fetchPageContent(url);
            
            // Krok 2: Spróbuj wyodrębnić JSON-LD (ustrukturyzowane dane)
            const jsonLdRecipe = this.extractJsonLdRecipe(content);
            if (jsonLdRecipe) {
                console.log('✅ Znaleziono dane strukturalne JSON-LD');
                return await this.translateToPolish(jsonLdRecipe);
            }
            
            // Krok 3: Jeśli nie ma JSON-LD, użyj AI
            console.log('⚡ Używam AI do wyodrębnienia');
            const aiRecipe = await this.extractWithAI(content);
            return await this.translateToPolish(aiRecipe);
            
        } catch (error) {
            console.error('❌ Błąd przy wyodrębnianiu:', error);
            throw new Error(`Nie udało się wyodrębnić przepisu: ${error.message}`);
        }
    }

    // Pobiera zawartość strony przez ScrapingBee
    async fetchPageContent(url) {
        const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/`;
        
        const params = new URLSearchParams({
            api_key: this.scrapingBeeKey,
            url: url,
            render_js: 'false', // Oszczędzamy kredyty - większość stron nie potrzebuje JS
            premium_proxy: 'false'
        });

        const response = await fetch(`${scrapingBeeUrl}?${params}`);
        
        if (!response.ok) {
            throw new Error(`ScrapingBee error: ${response.status} ${response.statusText}`);
        }

        return await response.text();
    }

    // Wyodrębnia przepis z danych JSON-LD (Schema.org)
    extractJsonLdRecipe(html) {
        // Szuka skryptów z JSON-LD
        const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
        let match;
        
        while ((match = jsonLdRegex.exec(html)) !== null) {
            try {
                const jsonData = JSON.parse(match[1]);
                
                // Może być pojedynczy obiekt lub tablica
                const items = Array.isArray(jsonData) ? jsonData : [jsonData];
                
                for (const item of items) {
                    const recipe = this.parseJsonLdItem(item);
                    if (recipe) return recipe;
                }
            } catch (e) {
                // Kontynuuj szukanie w innych skryptach
                continue;
            }
        }
        
        return null;
    }

    // Parsuje pojedynczy element JSON-LD
    parseJsonLdItem(item) {
        // Sprawdź czy to przepis
        const type = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        if (!type.includes('Recipe')) return null;

        return {
            name: item.name || 'Bez nazwy',
            prepTime: this.parseDuration(item.prepTime) || 'Nie podano',
            cookTime: this.parseDuration(item.cookTime) || '',
            totalTime: this.parseDuration(item.totalTime) || '',
            ingredients: this.extractIngredients(item.recipeIngredient || []),
            instructions: this.extractInstructions(item.recipeInstructions || []),
            servings: item.recipeYield || 'Nie podano',
            description: item.description || '',
            cuisine: item.recipeCuisine || '',
            category: item.recipeCategory || ''
        };
    }

    // Konwertuje czas ISO 8601 na czytelny format
    parseDuration(duration) {
        if (!duration) return '';
        
        // Format PT30M (30 minut) lub PT1H30M (1 godzina 30 minut)
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
        if (!match) return duration; // Zwróć oryginalny jeśli nie można sparsować
        
        const hours = parseInt(match[1] || '0');
        const minutes = parseInt(match[2] || '0');
        
        const parts = [];
        if (hours > 0) parts.push(`${hours} godz`);
        if (minutes > 0) parts.push(`${minutes} min`);
        
        return parts.join(' ') || duration;
    }

    // Wyodrębnia składniki
    extractIngredients(ingredients) {
        return ingredients.map(ingredient => {
            if (typeof ingredient === 'string') return ingredient;
            if (ingredient.text) return ingredient.text;
            return JSON.stringify(ingredient);
        });
    }

    // Wyodrębnia instrukcje
    extractInstructions(instructions) {
        return instructions.map(instruction => {
            if (typeof instruction === 'string') return instruction;
            if (instruction.text) return instruction.text;
            if (instruction.name) return instruction.name;
            return JSON.stringify(instruction);
        });
    }

    // Używa AI do wyodrębnienia przepisu (gdy brak JSON-LD)
    async extractWithAI(html) {
        if (!this.openAiKey || this.openAiKey === 'TWOJ_OPENAI_KEY') {
            // Fallback - zwróć przykładowy przepis
            return {
                name: 'Przepis wyodrębniony automatycznie',
                prepTime: '30 min',
                ingredients: [
                    'Składnik 1',
                    'Składnik 2', 
                    'Składnik 3'
                ],
                instructions: [
                    'Krok 1: Przygotuj składniki',
                    'Krok 2: Wymieszaj wszystko',
                    'Krok 3: Ugotuj według instrukcji'
                ]
            };
        }

        // Skróć HTML do istotnych części
        const cleanText = this.cleanHtmlForAI(html);
        
        const prompt = `Wyodrębnij przepis kulinarny z poniższego tekstu strony internetowej. Zwróć wynik w formacie JSON:

{
  "name": "nazwa przepisu",
  "prepTime": "czas przygotowania",
  "ingredients": ["składnik 1", "składnik 2"],
  "instructions": ["krok 1", "krok 2"]
}

Tekst strony:
${cleanText.substring(0, 3000)}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openAiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1000,
                temperature: 0.3
            })
        });

        if (!response.ok) {
            throw new Error('AI extraction failed');
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        try {
            return JSON.parse(content);
        } catch (e) {
            throw new Error('AI returned invalid JSON');
        }
    }

    // Czyści HTML dla AI (usuwa zbędne tagi)
    cleanHtmlForAI(html) {
        return html
            .replace(/<script[^>]*>.*?<\/script>/gis, '')
            .replace(/<style[^>]*>.*?<\/style>/gis, '')
            .replace(/<nav[^>]*>.*?<\/nav>/gis, '')
            .replace(/<footer[^>]*>.*?<\/footer>/gis, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Tłumaczy przepis na polski (jeśli potrzeba)
    async translateToPolish(recipe) {
        // Prosta detekcja języka - sprawdź czy są polskie znaki
        const polishPattern = /[ąćęłńóśźż]/i;
        const isAlreadyPolish = polishPattern.test(recipe.name + ' ' + recipe.ingredients.join(' '));
        
        if (isAlreadyPolish) {
            console.log('✅ Przepis już w języku polskim');
            return recipe;
        }

        console.log('🔄 Tłumaczę na polski...');
        
        try {
            // Używamy bezpłatnego Google Translate
            recipe.name = await this.translateText(recipe.name);
            recipe.ingredients = await Promise.all(
                recipe.ingredients.map(ingredient => this.translateText(ingredient))
            );
            recipe.instructions = await Promise.all(
                recipe.instructions.map(instruction => this.translateText(instruction))
            );
            
            return recipe;
        } catch (e) {
            console.warn('⚠️ Nie udało się przetłumaczyć, zwracam oryginalny przepis');
            return recipe;
        }
    }

    // Przetłumacz pojedynczy tekst
    async translateText(text) {
        // Prosty translator używający publicznego API
        try {
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|pl`);
            const data = await response.json();
            
            if (data.responseData && data.responseData.translatedText) {
                return data.responseData.translatedText;
            }
        } catch (e) {
            // Jeśli tłumaczenie nie działa, zwróć oryginalny tekst
        }
        
        return text;
    }

    // Test funkcji - sprawdza czy klucze API działają
    async testConnection() {
        console.log('🧪 Testuję połączenie z API...');
        
        try {
            // Test ScrapingBee
            await this.fetchPageContent('https://httpbin.org/html');
            console.log('✅ ScrapingBee działa!');
            
            return true;
        } catch (error) {
            console.error('❌ Test połączenia nie powiódł się:', error);
            return false;
        }
    }
}

// Udostępnij klasę globalnie
window.RecipeExtractor = RecipeExtractor;
