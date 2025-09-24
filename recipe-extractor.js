// Recipe Extractor - Prawdziwy silnik wyodrębniania przepisów
class RecipeExtractor {
    constructor() {
        // Klucze API - działające!
        this.scrapingBeeKey = 'EZ4IZDOHS4SPS8SG4KWW3T6PUBGPFJ0SBVFWDPGTURQLAMHHPMW7SP2H0T8RVXUP3WBNNSDMU27ZPU5Q';
        this.openAiKey = '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';
    }

    // GŁÓWNA FUNKCJA - wyodrębnia przepis z URL
    async extractRecipe(url) {
        console.log('🔍 Analizuję URL:', url);
        
        try {
            // Pobierz zawartość strony
            const html = await this.fetchPageContent(url);
            console.log('✅ Pobrano zawartość strony');
            
            // Szukaj JSON-LD (strukturalne dane)
            const recipe = this.extractJsonLdFromHtml(html);
            
            if (recipe) {
                console.log('✅ Znaleziono przepis w danych strukturalnych');
                return await this.translateToPolish(recipe);
            } else {
                console.log('❌ Brak danych strukturalnych, próbuję z AI...');
                
                // Użyj AI jako backup
                if (this.openAiKey && this.openAiKey.startsWith('sk-')) {
                    return await this.extractWithAI(html);
                } else {
                    throw new Error('Brak danych przepisu na tej stronie. Spróbuj z inną stroną kulinarną.');
                }
            }
            
        } catch (error) {
            console.error('❌ Błąd:', error);
            throw new Error(error.message || 'Nie udało się wyodrębnić przepisu');
        }
    }

    // Pobiera stronę przez bezpłatny proxy
    async fetchPageContent(url) {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        
        console.log('🌐 Pobieram przez proxy...');
        
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            throw new Error(`Nie można pobrać strony (${response.status})`);
        }
        
        const data = await response.json();
        
        if (!data.contents) {
            throw new Error('Pusta odpowiedź z serwera');
        }
        
        return data.contents;
    }

    // Wyodrębnia przepis z JSON-LD
    extractJsonLdFromHtml(html) {
        console.log('🔎 Szukam danych JSON-LD...');
        
        const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
        let match;
        
        while ((match = jsonLdRegex.exec(html)) !== null) {
            try {
                const jsonText = match[1].trim();
                const jsonData = JSON.parse(jsonText);
                
                // Może być obiekt lub tablica
                const items = Array.isArray(jsonData) ? jsonData : [jsonData];
                
                for (const item of items) {
                    const recipe = this.parseRecipeFromJsonLd(item);
                    if (recipe) {
                        console.log('✅ Znaleziono przepis:', recipe.name);
                        return recipe;
                    }
                }
            } catch (e) {
                console.log('⚠️ Błąd parsowania JSON-LD, próbuję dalej...');
                continue;
            }
        }
        
        console.log('❌ Nie znaleziono przepisu w JSON-LD');
        return null;
    }

    // Parsuje przepis z obiektu JSON-LD
    parseRecipeFromJsonLd(item) {
        // Sprawdź czy to przepis
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        
        if (!types.some(type => type === 'Recipe')) {
            return null;
        }

        const recipe = {
            name: item.name || 'Przepis bez nazwy',
            prepTime: this.parseDuration(item.prepTime),
            cookTime: this.parseDuration(item.cookTime),
            totalTime: this.parseDuration(item.totalTime),
            ingredients: this.extractIngredients(item.recipeIngredient || []),
            instructions: this.extractInstructions(item.recipeInstructions || [])
        };

        // Sprawdź czy przepis ma podstawowe dane
        if (recipe.ingredients.length === 0 && recipe.instructions.length === 0) {
            return null;
        }

        return recipe;
    }

    // Konwertuje czas ISO (PT30M) na czytelny format
    parseDuration(duration) {
        if (!duration) return 'Nie podano';
        
        // PT30M = 30 minut, PT1H30M = 1 godzina 30 minut
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
        if (!match) return duration;
        
        const hours = parseInt(match[1] || '0');
        const minutes = parseInt(match[2] || '0');
        
        const parts = [];
        if (hours > 0) parts.push(`${hours} godz`);
        if (minutes > 0) parts.push(`${minutes} min`);
        
        return parts.join(' ') || 'Nie podano';
    }

    // Wyodrębnia składniki z różnych formatów
    extractIngredients(ingredients) {
        if (!Array.isArray(ingredients)) return [];
        
        return ingredients.map(ingredient => {
            if (typeof ingredient === 'string') {
                return ingredient.trim();
            }
            if (ingredient.text) {
                return ingredient.text.trim();
            }
            if (ingredient.name) {
                return ingredient.name.trim();
            }
            return String(ingredient).trim();
        }).filter(ingredient => ingredient.length > 0);
    }

    // Wyodrębnia instrukcje z różnych formatów
    extractInstructions(instructions) {
        if (!Array.isArray(instructions)) return [];
        
        return instructions.map(instruction => {
            if (typeof instruction === 'string') {
                return instruction.trim();
            }
            if (instruction.text) {
                return instruction.text.trim();
            }
            if (instruction.name) {
                return instruction.name.trim();
            }
            return String(instruction).trim();
        }).filter(instruction => instruction.length > 0);
    }

    // Używa AI do wyodrębnienia (backup)
    async extractWithAI(html) {
        console.log('🤖 Używam AI do wyodrębnienia...');
        
        const cleanText = this.cleanHtmlForAI(html);
        
        const prompt = `Wyodrębnij przepis kulinarny z tekstu strony. Zwróć TYLKO poprawny JSON bez dodatkowych komentarzy:

{
  "name": "nazwa przepisu",
  "prepTime": "czas w minutach",
  "ingredients": ["składnik 1", "składnik 2"],
  "instructions": ["krok 1", "krok 2"]
}

Tekst strony:
${cleanText.substring(0, 2500)}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openAiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 800,
                temperature: 0.2
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI API error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        
        try {
            const recipe = JSON.parse(content);
            console.log('✅ AI wyodrębniło przepis:', recipe.name);
            return recipe;
        } catch (e) {
            console.error('❌ AI zwróciło nieprawidłowy JSON:', content);
            throw new Error('AI nie mogło przetworzyć tej strony');
        }
    }

    // Czyści HTML dla AI
    cleanHtmlForAI(html) {
        return html
            .replace(/<script[^>]*>.*?<\/script>/gis, '')
            .replace(/<style[^>]*>.*?<\/style>/gis, '')
            .replace(/<nav[^>]*>.*?<\/nav>/gis, '')
            .replace(/<footer[^>]*>.*?<\/footer>/gis, '')
            .replace(/<header[^>]*>.*?<\/header>/gis, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, ' ')
            .trim();
    }

    // Tłumaczy przepis na polski
    async translateToPolish(recipe) {
        // Sprawdź czy już po polsku
        const polishPattern = /[ąćęłńóśźż]/i;
        const textToCheck = `${recipe.name} ${recipe.ingredients.join(' ')} ${recipe.instructions.join(' ')}`;
        
        if (polishPattern.test(textToCheck)) {
            console.log('✅ Przepis już w języku polskim');
            return recipe;
        }

        console.log('🔄 Tłumaczę na polski...');
        
        try {
            // Tłumacz tylko jeśli tekst nie jest już po polsku
            const translatedRecipe = { ...recipe };
            
            translatedRecipe.name = await this.translateText(recipe.name);
            
            // Tłumacz składniki (po kolei, żeby nie przekroczyć limitów)
            translatedRecipe.ingredients = [];
            for (const ingredient of recipe.ingredients) {
                const translated = await this.translateText(ingredient);
                translatedRecipe.ingredients.push(translated);
                await this.sleep(100); // Krótka przerwa
            }
            
            // Tłumacz instrukcje
            translatedRecipe.instructions = [];
            for (const instruction of recipe.instructions) {
                const translated = await this.translateText(instruction);
                translatedRecipe.instructions.push(translated);
                await this.sleep(100);
            }
            
            console.log('✅ Przepis przetłumaczony na polski');
            return translatedRecipe;
            
        } catch (e) {
            console.warn('⚠️ Błąd tłumaczenia, zwracam oryginalny przepis');
            return recipe;
        }
    }

    // Tłumaczy pojedynczy tekst
    async translateText(text) {
        if (!text || text.length === 0) return text;
        
        try {
            const response = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|pl`
            );
            
            if (!response.ok) {
                return text;
            }
            
            const data = await response.json();
            
            if (data.responseData && data.responseData.translatedText) {
                return data.responseData.translatedText;
            }
            
            return text;
        } catch (e) {
            return text;
        }
    }

    // Pomocnicza funkcja - czeka określony czas
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Udostępnij klasę globalnie
window.RecipeExtractor = RecipeExtractor;
