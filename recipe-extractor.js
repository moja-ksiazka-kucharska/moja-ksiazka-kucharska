// Recipe Extractor - Bezpieczny i działający
class RecipeExtractor {
    constructor() {
        // BEZPIECZNE: Klucze będą w zmiennych środowiskowych
        this.openAiKey = null;
        this.claudeKey = null;
        this.setupApiKeys();
    }

    // Konfiguracja API - użytkownik wkleja klucze przez interfejs
    setupApiKeys() {
        // Sprawdź czy są zapisane klucze w localStorage
        this.openAiKey = localStorage.getItem('openai_api_key');
        this.claudeKey = localStorage.getItem('claude_api_key');
    }

    // Główna funkcja wyodrębniania
    async extractRecipe(url) {
        console.log('🔍 Analizuję URL:', url);
        
        try {
            // Krok 1: Pobierz zawartość strony
            const html = await this.fetchPageContent(url);
            console.log('✅ Pobrano zawartość strony');
            
            // Krok 2: Szukaj strukturalnych danych JSON-LD
            const structuredRecipe = this.parseJsonLdRecipe(html);
            if (structuredRecipe) {
                console.log('✅ Znaleziono dane JSON-LD');
                return await this.translateIfNeeded(structuredRecipe);
            }
            
            // Krok 3: Użyj AI do parsowania HTML
            if (this.hasApiKey()) {
                console.log('🤖 Używam AI do parsowania...');
                const aiRecipe = await this.parseWithAI(html, url);
                return await this.translateIfNeeded(aiRecipe);
            }
            
            // Krok 4: Fallback - podstawowy parser
            return this.parseBasicHTML(html, url);
            
        } catch (error) {
            console.error('❌ Błąd:', error);
            throw error;
        }
    }

    // Pobiera zawartość strony przez bezpłatny proxy
    async fetchPageContent(url) {
        const proxies = [
            `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
            `https://corsproxy.io/?${encodeURIComponent(url)}`,
            `https://proxy.cors.sh/${url}`
        ];
        
        for (const proxyUrl of proxies) {
            try {
                console.log('🌐 Próbuję proxy:', proxyUrl.split('?')[0]);
                
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                if (!response.ok) continue;
                
                const data = await response.json();
                if (data.contents || data.body || data.data) {
                    return data.contents || data.body || data.data;
                }
                
            } catch (error) {
                console.log('⚠️ Proxy nie działa, próbuję następny...');
                continue;
            }
        }
        
        throw new Error('Nie można pobrać zawartości strony. Spróbuj z innym linkiem.');
    }

    // Parsuje JSON-LD (strukturalne dane)
    parseJsonLdRecipe(html) {
        const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
        let match;
        
        while ((match = jsonLdRegex.exec(html)) !== null) {
            try {
                const jsonText = match[1].trim();
                const jsonData = JSON.parse(jsonText);
                
                const items = Array.isArray(jsonData) ? jsonData : [jsonData];
                
                for (const item of items) {
                    if (this.isRecipeData(item)) {
                        const recipe = this.parseRecipeFromJsonLd(item);
                        if (recipe && recipe.ingredients.length > 0) {
                            console.log('✅ Przepis z JSON-LD:', recipe.name);
                            return recipe;
                        }
                    }
                }
            } catch (e) {
                console.log('⚠️ Błąd parsowania JSON-LD');
                continue;
            }
        }
        
        return null;
    }

    // Sprawdza czy obiekt JSON-LD to przepis
    isRecipeData(item) {
        if (!item || !item['@type']) return false;
        
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        return types.some(type => type === 'Recipe' || type.includes('Recipe'));
    }

    // Parsuje przepis z JSON-LD
    parseRecipeFromJsonLd(item) {
        return {
            name: item.name || 'Przepis bez nazwy',
            prepTime: this.parseDuration(item.prepTime || item.cookTime || item.totalTime),
            ingredients: this.extractIngredients(item.recipeIngredient || []),
            instructions: this.extractInstructions(item.recipeInstructions || []),
            servings: item.recipeYield || 'Nie podano',
            description: item.description || ''
        };
    }

    // Wyodrębnia składniki
    extractIngredients(ingredients) {
        if (!Array.isArray(ingredients)) return [];
        
        return ingredients.map(ingredient => {
            if (typeof ingredient === 'string') return ingredient.trim();
            if (ingredient.text) return ingredient.text.trim();
            if (ingredient.name) return ingredient.name.trim();
            return String(ingredient).trim();
        }).filter(item => item.length > 0);
    }

    // Wyodrębnia instrukcje
    extractInstructions(instructions) {
        if (!Array.isArray(instructions)) return [];
        
        return instructions.map(instruction => {
            if (typeof instruction === 'string') return instruction.trim();
            if (instruction.text) return instruction.text.trim();
            if (instruction.name) return instruction.name.trim();
            return String(instruction).trim();
        }).filter(item => item.length > 0);
    }

    // Parsuje czas (PT30M -> 30 min)
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

    // Sprawdza czy ma klucz API
    hasApiKey() {
        return (this.openAiKey && this.openAiKey.startsWith('sk-')) || 
               (this.claudeKey && this.claudeKey.length > 20);
    }

    // Parsuje z AI (OpenAI lub Claude)
    async parseWithAI(html, url) {
        const cleanText = this.cleanHtmlForAI(html);
        
        if (this.openAiKey) {
            return await this.parseWithOpenAI(cleanText, url);
        } else if (this.claudeKey) {
            return await this.parseWithClaude(cleanText, url);
        }
        
        throw new Error('Brak kluczy API');
    }

    // OpenAI parser
    async parseWithOpenAI(text, url) {
        const prompt = `Wyodrębnij przepis kulinarny z tekstu strony internetowej. Zwróć TYLKO poprawny JSON:

{
  "name": "nazwa przepisu",
  "prepTime": "czas np. 30 min",
  "ingredients": ["składnik 1", "składnik 2"],
  "instructions": ["krok 1", "krok 2"]
}

Tekst strony:
${text.substring(0, 3000)}`;

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
                temperature: 0.1
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        
        try {
            return JSON.parse(content);
        } catch (e) {
            throw new Error('AI zwróciło nieprawidłowy JSON');
        }
    }

    // Claude parser (alternatywa)
    async parseWithClaude(text, url) {
        const prompt = `Wyodrębnij przepis z tekstu i zwróć jako JSON:
{
  "name": "nazwa",
  "prepTime": "czas",
  "ingredients": ["składniki"],
  "instructions": ["kroki"]
}

Tekst: ${text.substring(0, 3000)}`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': this.claudeKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1000,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            throw new Error(`Claude API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.content[0].text.trim();
        
        try {
            return JSON.parse(content);
        } catch (e) {
            throw new Error('Claude zwróciło nieprawidłowy JSON');
        }
    }

    // Czyści HTML dla AI
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

    // Podstawowy parser (bez AI)
    parseBasicHTML(html, url) {
        const domain = new URL(url).hostname;
        
        // Znajdź tytuł
        const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i) || 
                          html.match(/<title>(.*?)<\/title>/i);
        const name = titleMatch ? 
            titleMatch[1].replace(/<[^>]*>/g, '').trim() : 
            `Przepis ze strony ${domain}`;
        
        // Podstawowe składniki (jeśli znajdzie listy)
        const ingredients = this.extractBasicIngredients(html);
        const instructions = this.extractBasicInstructions(html);
        
        return {
            name: name.substring(0, 100),
            prepTime: 'Sprawdź na stronie',
            ingredients: ingredients.length > 0 ? ingredients : 
                ['Sprawdź składniki na oryginalnej stronie'],
            instructions: instructions.length > 0 ? instructions : 
                ['Zobacz instrukcje na stronie źródłowej']
        };
    }

    // Podstawowe wyodrębnianie składników z HTML
    extractBasicIngredients(html) {
        const ingredients = [];
        
        // Szukaj list ze składnikami
        const listMatches = html.match(/<ul[^>]*>.*?<\/ul>/gis) || 
                           html.match(/<ol[^>]*>.*?<\/ol>/gis) || [];
        
        for (const list of listMatches) {
            const items = list.match(/<li[^>]*>(.*?)<\/li>/gis) || [];
            for (const item of items) {
                const text = item.replace(/<[^>]*>/g, '').trim();
                if (text.length > 5 && text.length < 100) {
                    ingredients.push(text);
                }
            }
            if (ingredients.length >= 5) break; // Wystarczy pierwsza sensowna lista
        }
        
        return ingredients.slice(0, 10); // Max 10 składników
    }

    // Podstawowe wyodrębnianie instrukcji z HTML
    extractBasicInstructions(html) {
        const instructions = [];
        
        // Szukaj numerowanych lub punktowanych list
        const listMatches = html.match(/<ol[^>]*>.*?<\/ol>/gis) || 
                           html.match(/<ul[^>]*>.*?<\/ul>/gis) || [];
        
        for (const list of listMatches) {
            const items = list.match(/<li[^>]*>(.*?)<\/li>/gis) || [];
            const listInstructions = [];
            
            for (const item of items) {
                const text = item.replace(/<[^>]*>/g, '').trim();
                if (text.length > 10 && text.length < 300) {
                    listInstructions.push(text);
                }
            }
            
            // Jeśli lista wygląda na instrukcje (długie teksty)
            if (listInstructions.length > 2 && listInstructions[0].length > 20) {
                instructions.push(...listInstructions);
                break;
            }
        }
        
        return instructions.slice(0, 10); // Max 10 kroków
    }

    // Tłumacz na polski (jeśli potrzeba)
    async translateIfNeeded(recipe) {
        const polishPattern = /[ąćęłńóśźż]/i;
        const textToCheck = `${recipe.name} ${recipe.ingredients.join(' ')}`;
        
        if (polishPattern.test(textToCheck)) {
            console.log('✅ Przepis już po polsku');
            return recipe;
        }

        console.log('🔄 Tłumaczę na polski...');
        
        try {
            const translatedRecipe = { ...recipe };
            
            // Tłumacz tylko jeśli tekst jest w języku obcym
            translatedRecipe.name = await this.translateText(recipe.name) || recipe.name;
            
            // Tłumacz składniki (z opóźnieniem, żeby nie przeciążyć API)
            translatedRecipe.ingredients = [];
            for (let i = 0; i < recipe.ingredients.length; i++) {
                const translated = await this.translateText(recipe.ingredients[i]);
                translatedRecipe.ingredients.push(translated || recipe.ingredients[i]);
                
                if (i < recipe.ingredients.length - 1) {
                    await this.sleep(200); // 200ms przerwy
                }
            }
            
            // Tłumacz instrukcje
            translatedRecipe.instructions = [];
            for (let i = 0; i < recipe.instructions.length; i++) {
                const translated = await this.translateText(recipe.instructions[i]);
                translatedRecipe.instructions.push(translated || recipe.instructions[i]);
                
                if (i < recipe.instructions.length - 1) {
                    await this.sleep(200);
                }
            }
            
            console.log('✅ Przepis przetłumaczony');
            return translatedRecipe;
            
        } catch (e) {
            console.warn('⚠️ Błąd tłumaczenia, zwracam oryginał');
            return recipe;
        }
    }

    // Tłumacz pojedynczy tekst
    async translateText(text) {
        if (!text || text.length === 0) return text;
        
        try {
            const response = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|pl`
            );
            
            if (!response.ok) return text;
            
            const data = await response.json();
            return data.responseData?.translatedText || text;
            
        } catch (e) {
            return text;
        }
    }

    // Pomocnicza funkcja sleep
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Konfiguracja kluczy API przez użytkownika
    setApiKey(provider, key) {
        if (provider === 'openai') {
            this.openAiKey = key;
            localStorage.setItem('openai_api_key', key);
        } else if (provider === 'claude') {
            this.claudeKey = key;
            localStorage.setItem('claude_api_key', key);
        }
    }

    // Usuń klucze API
    clearApiKeys() {
        this.openAiKey = null;
        this.claudeKey = null;
        localStorage.removeItem('openai_api_key');
        localStorage.removeItem('claude_api_key');
    }
}

// Udostępnij globalnie
window.RecipeExtractor = RecipeExtractor;
