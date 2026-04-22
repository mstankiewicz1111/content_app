/**
 * PROMPTS.JS - Baza wszystkich zapytań do AI
 * Tutaj edytujesz zachowanie modelu. Zmiany w tym pliku NIE zepsują logiki aplikacji.
 */

const Prompts = {
    // 1. GENEROWANIE POMYSŁÓW
    getIdeas: function(userIdea) {
        const base = `Jesteś copywriterką polskiej marki modowej WASSYL. Sprzedajemy ubrania na co dzień: STREETWEAR, dresy, prążkowane komplety, basic, luźne sukienki. Nasz vibe to miejski luz, a nie paryskie wybiegi.
        KATEGORYCZNY ZAKAZ: poetyckiego języka, metafor typu "Ogrody Hesperyd". Masz pisać lifestylowo i pod SEO. Tematy mają dotyczyć WYŁĄCZNIE ubrań i stylizacji (ZAKAZ kulinariów, technologii, podróży). `;
        
        if (userIdea) {
            return base + `Zaproponuj 5 tematów na podstawie pomysłu: "${userIdea}". Zwróć TYLKO JSON: [{"title": "Tytuł", "desc": "Opis"}].`;
        } else {
            return base + `Mamy wiosnę 2026. Poszukaj aktualnych trendów (streetwear, casual) i zaproponuj 5 klikalnych tematów. Zwróć TYLKO JSON: [{"title": "Tytuł", "desc": "Opis"}].`;
        }
    },

    // 2. GENEROWANIE KONSPEKTU
    getPlan: function(topic, productContext) {
        return `Stwórz chłodny, merytoryczny konspekt artykułu. 
        Temat: ${topic}. 
        ${productContext}
        WYTYCZNE: 1. ZAKAZ języka stylizowanego ("ziomki"). To suchy dokument techniczny. 2. 4-5 śródtytułów (H2). 3. Pod każdym śródtytułem 1-2 ZDANIA INFORMACYJNE, o czym napisać. 4. ZAKAZ używania "Title Case" w nagłówkach. 5. ZAKAZ komentarzy AI.`;
    },

    // 3. GENEROWANIE TREŚCI ARTYKUŁU
    getArticle: function(topic, plan) {
        return `Napisz artykuł modowy (SAMA TREŚĆ, bez tytułu i wstępu). 
        TEMAT: ${topic}
        KONSPEKT: ${plan}
        WYTYCZNE:
        1. Używaj nagłówków Markdown (##) dla sekcji. ZAKAZ Title Case.
        2. Akapity: krótkie (3-4 zdania). Ton profesjonalny lifestylowy, zero taniego slangu.
        3. ZAKAZ używania podwójnych gwiazdek jako cudzysłowu (używaj zwykłego "").
        4. KATEGORYCZNY ZAKAZ komentarzy AI (np. "Oto tekst", "Mam nadzieję, że się podoba"). Zacznij od razu od treści.`;
    },

    // 4. REWIZJA TEKSTU
    getRevision: function(article, instruction) {
        return `Skoryguj poniższy tekst wg instrukcji.
        TEKST: ${article}
        INSTRUKCJA: ${instruction}
        WYTYCZNE: Zwróć TYLKO poprawiony tekst jako czysty Markdown. ZAKAZ Title Case w nagłówkach. KATEGORYCZNY ZAKAZ komentarzy AI typu "Jasne, poprawiłem" albo "Oto zmieniony tekst".`;
    },

    // 5. GENEROWANIE TYTUŁU I LEADU
    getMeta: function(article, instruction) {
        return `Na podstawie poniższego artykułu wymyśl chwytliwy Tytuł SEO i Lead (2-3 zdania zaczepnego wstępu/hooka).
        ${instruction ? `Dodatkowa instrukcja do stylu: "${instruction}"` : ""}
        TEKST ARTYKUŁU: ${article}
        Zwróć TYLKO obiekt JSON: {"title": "Wymyślony tytuł bez kropki na końcu", "lead": "Wymyślony lead"}`;
    },

    // 6. GENEROWANIE HTML
    getHtml: function(article, imgContext) {
        return `Zadanie: Przekonwertuj tekst na HTML wg szablonu Wassyl.
        TEKST: ${article}
        ZDJĘCIA DO UŻYCIA: ${imgContext}
        WYTYCZNE SZABLONU:
        1. Używaj układu: <div style="display: flex; flex-wrap: wrap; margin-bottom: 30px;"><div style="flex: 1 1 0%; padding: 10px;">TEKST</div><div style="flex: 1 1 0%; padding: 10px;"><a href="LINK"><img src="URL" style="max-width: 100%; display: block; margin: 0 auto;" width="90%"></a></div></div>.
        2. Przeplataj tekst ze zdjęciami.
        3. ZAKAZ śmieciowego kodu (np. id="docs-internal-guid").
        4. Zwróć TYLKO czysty kod HTML, żadnych komentarzy.`;
    }
};
