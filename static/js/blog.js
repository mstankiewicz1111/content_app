/**
 * BLOG.JS - Wersja Premium (Storytelling, Auto-dobór, Poprawki Copywriterskie, Fixy)
 */

function switchTab(tabId) {
    document.querySelectorAll('#module-blog .tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#sidebar-blog button').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.getElementById('btn-' + tabId).classList.add('active');
}

function saveDraft() {}

function syncProductIds() {
    const ids = document.getElementById('context-product-ids').value;
    document.getElementById('pub-rec-ids').value = ids;
    document.getElementById('pub-html-ids').value = ids;
    document.getElementById('pub-collage-ids').value = ids;
}

// 0. GENEROWANIE POMYSŁÓW
async function generateIdeas(userIdea) {
    const resBox = document.getElementById('ideas-result');
    const loader = document.getElementById('loader-1');
    loader.style.display = 'block';
    resBox.innerHTML = '';
    
    const prompt = userIdea 
        ? `Jesteś redaktorką bloga modowego Wassyl. Zaproponuj 5 chwytliwych tematów na podstawie pomysłu: "${userIdea}". UWAGA: Zwróć TYLKO I WYŁĄCZNIE czysty JSON w formacie tablicy obiektów: [{"title": "Tytuł", "desc": "Krótki opis"}]. Żadnego przywitania, żadnego tekstu przed ani po JSONie.`
        : `Jesteś redaktorką bloga modowego Wassyl. Kwiecień 2026. Poszukaj aktualnych trendów modowych i zaproponuj 5 chwytliwych tematów. UWAGA: Zwróć TYLKO I WYŁĄCZNIE czysty JSON w formacie tablicy obiektów: [{"title": "Tytuł", "desc": "Krótki opis"}]. Żadnego przywitania, żadnego tekstu przed ani po JSONie.`;

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt: prompt, search: !userIdea, json_mode: true })
        });
        const data = await res.json();
        loader.style.display = 'none';
        
        // PANCERNY PARSER JSON: Szukamy tylko tego, co jest między [ a ]
        let rawText = data.result;
        let cleanJson = "";
        
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            cleanJson = jsonMatch[0];
        } else {
            throw new Error("AI nie wygenerowało tablicy JSON. Zwróciło tekst: " + rawText.substring(0, 50) + "...");
        }

        const ideas = JSON.parse(cleanJson);
        
        let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
        ideas.forEach(idea => {
            const safeTitle = idea.title.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            html += `
            <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <h4 style="margin-top: 0; color: #000; font-size: 16px;">${idea.title}</h4>
                <p style="font-size: 13px; color: #666; margin-bottom: 15px;">${idea.desc}</p>
                <button class="btn-primary" onclick="selectBlogIdea('${safeTitle}')" style="margin: 0; font-size: 12px; padding: 6px 12px; background: #000;">✍️ Wybierz ten temat</button>
            </div>`;
        });
        html += '</div>';
        resBox.innerHTML = html;
    } catch (e) {
        loader.style.display = 'none';
        resBox.innerHTML = `<div style="color:red; padding:15px; background:#ffe6e6; border:1px solid red; border-radius:8px;">Błąd AI: ${e.message}</div>`;
    }
}
// 1. AUTO-DOBÓR PRODUKTÓW
async function autoSelectProducts() {
    const topic = document.getElementById('topic-input').value;
    if (!topic) return alert("Wpisz najpierw temat artykułu!");
    const idsInput = document.getElementById('context-product-ids');
    idsInput.value = "⏳ Szukam w XML...";
    try {
        const feedRes = await fetch('/api/idosell/auto_products', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({topic: topic})
        });
        const feedData = await feedRes.json();
        
        if (!feedData.products || feedData.products.length === 0) {
            idsInput.value = "";
            return alert("Brak produktów w XML.");
        }

        const prompt = `Temat: "${topic}".\nLista produktów: ${feedData.products.join("\n")}\nWybierz 3 najlepiej pasujące do tematu. Zwróć TYLKO ich ID po przecinku.`;
        const aiRes = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt: prompt, search: false })
        });
        const aiData = await aiRes.json();
        idsInput.value = aiData.result.trim();
        syncProductIds();
    } catch (e) {
        idsInput.value = "";
        alert("Błąd: " + e.message);
    }
}

// 2. GENEROWANIE KONSPEKTU
async function generatePlan() {
    const topic = document.getElementById('topic-input').value;
    if(!topic) return alert("Podaj temat wpisu!");
    document.getElementById('loader-plan').style.display = 'block';
    document.getElementById('plan-section').style.display = 'none';
    
    const productIds = document.getElementById('context-product-ids').value;
    let productContext = productIds ? `Uwzględnij te produkty (ID: ${productIds}).` : "";

    const prompt = `Zadanie: Stwórz chłodny, merytoryczny konspekt artykułu.\nTemat: ${topic}\n${productContext}\n\nWYTYCZNE:\n1. ZAKAZ języka stylizowanego ("ziomki"). To suchy dokument techniczny.\n2. 4-5 śródtytułów (H2).\n3. Pod każdym śródtytułem 1-2 ZDANIA INFORMACYJNE, o czym napisać.\n4. ZAKAZ używania "Title Case" w nagłówkach (pisz zwyczajnie, wielka litera tylko na początku zdania).`;

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({prompt: prompt})
        });
        const data = await res.json();
        document.getElementById('loader-plan').style.display = 'none';
        document.getElementById('plan-result').value = data.result;
        document.getElementById('plan-section').style.display = 'block';
    } catch(e) {
        document.getElementById('loader-plan').style.display = 'none';
        alert("Błąd: " + e.message);
    }
}

// 3. GENEROWANIE ARTYKUŁU
async function generateArticleFromPlan() {
    const topic = document.getElementById('topic-input').value;
    const plan = document.getElementById('plan-result').value;
    document.getElementById('loader-2').style.display = 'block';
    document.getElementById('article-section').style.display = 'none';
    
    const prompt = `
Zadanie: Napisz artykuł modowy wg konspektu.
TEMAT: ${topic}
KONSPEKT: ${plan}

WYTYCZNE (KRYTYCZNE):
1. TONE OF VOICE: Profesjonalny storytelling, zero slangu ("ziomki", "mega"). Pisz jak ekspertka.
2. AKAPITY: Krótkie (max 3-4 zdania). ZAKAZ "ścian tekstu".
3. NAGŁÓWKI: ZAKAZ Title Case (Zła: "Moda Na Wiosnę", Dobra: "Moda na wiosnę").
4. POGRUBIENIA: Stosuj z rzadka. KATEGORYCZNY ZAKAZ używania pogrubień w ramach cudzysłowu.
5. ZAKOŃCZENIE I LEAD: Na samym końcu wygeneruj w 2 zdaniach Lead, który zaintryguje czytelnika. Zwróć go na samym początku tekstu.
6. Format Markdown.
    `;

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({prompt: prompt})
        });
        const data = await res.json();
        document.getElementById('loader-2').style.display = 'none';
        
        let formatted = data.result;
        if (typeof marked !== 'undefined') formatted = marked.parse(formatted);
        
        document.getElementById('article-result').innerHTML = formatted;
        document.getElementById('article-section').style.display = 'block';
        updateBlogCharCounter();
    } catch(e) {
        document.getElementById('loader-2').style.display = 'none';
        alert("Błąd: " + e.message);
    }
}

// NAPRAWIONA ZMIANA NAZWY LICZNIKA (Brak konfliktu z products.js)
function updateBlogCharCounter() {
    const el = document.getElementById('article-result');
    if(!el) return;
    const text = el.innerText || "";
    document.getElementById('char-counter').innerText = text.length + " znaków";
}

function handleArticleEdit() { updateBlogCharCounter(); }

// PRZYWRÓCONA I ZOPTYMALIZOWANA FUNKCJA REWIZJI
async function reviseArticle() {
    const article = document.getElementById('article-result').innerHTML;
    const instruction = document.getElementById('revision-input').value;
    if(!instruction) return alert("Podaj instrukcję do poprawek!");

    document.getElementById('loader-2').style.display = 'block';

    const prompt = `Skoryguj ten tekst blogowy wg instrukcji.\n\nTEKST:\n${article}\n\nINSTRUKCJA: ${instruction}\n\nWYTYCZNE:\n1. Zachowaj lifestylowy, profesjonalny ton.\n2. ZAKAZ Title Case w nagłówkach.\n3. ZAKAZ nadużywania pogrubień. ZAKAZ pogrubień udających cudzysłów.\n4. Zwróć kod w formacie Markdown.`;

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({prompt: prompt})
        });
        const data = await res.json();

        let formatted = data.result;
        if (typeof marked !== 'undefined') formatted = marked.parse(formatted);

        document.getElementById('article-result').innerHTML = formatted;
        document.getElementById('loader-2').style.display = 'none';
        updateBlogCharCounter();
        document.getElementById('revision-input').value = "";
    } catch(e) {
        document.getElementById('loader-2').style.display = 'none';
        alert("Błąd: " + e.message);
    }
}

function quickRevise(instruction) {
    document.getElementById('revision-input').value = instruction;
    reviseArticle();
}

// PŁYNNE PRZEJŚCIE DO PUBLIKACJI Z WYPEŁNIENIEM DANYCH
function goToPublish() {
    document.getElementById('pub-title').value = document.getElementById('topic-input').value;
    switchTab('tab3');
    generateHtml(); // Od razu ładujemy HTML żeby formularz nie był pusty!
}

// 4. KOLAŻ ZDJĘĆ
async function generateCollage() {
    const ids = document.getElementById('pub-collage-ids').value;
    if(!ids) return alert("Podaj ID produktów!");
    document.getElementById('loader-collage').style.display = 'block';
    const preview = document.getElementById('collage-preview');
    preview.style.display = 'none';
    try {
        const res = await fetch('/api/idosell/products', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ids: ids})
        });
        const data = await res.json();
        const products = data.results || data.products || [];
        if(products.length === 0) {
            document.getElementById('loader-collage').style.display = 'none';
            return alert("Brak produktów!");
        }
        let htmlImages = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; margin-top:15px;">`;
        products.forEach(p => {
            let imgUrl = "";
            if (p.productImages && p.productImages.length > 0) imgUrl = p.productImages[0].productImageMediumUrl || p.productImages[0].productImageSmallUrl;
            if(imgUrl) htmlImages += `<img src="${imgUrl}" style="width: 100%; border-radius: 8px; object-fit: cover;">`;
        });
        htmlImages += `</div>`;
        preview.outerHTML = htmlImages;
        document.getElementById('loader-collage').style.display = 'none';
    } catch(e) {
        document.getElementById('loader-collage').style.display = 'none';
        alert("Błąd: " + e.message);
    }
}

// 5. GENEROWANIE HTML
async function generateHtml() {
    const article = document.getElementById('article-result').innerHTML;
    const htmlIds = document.getElementById('pub-html-ids').value;
    document.getElementById('loader-html').style.display = 'block';
    document.getElementById('html-section').style.display = 'none';
    
    let imageInstructions = "Nie wstawiaj dodatkowych zdjęć.";
    if (htmlIds) {
        try {
            const res = await fetch('/api/idosell/products', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids: htmlIds}) });
            const data = await res.json();
            const products = data.results || data.products || [];
            if (products.length > 0) {
                let imagesHtmlToInject = "\n<br><div style='display:flex; justify-content:center; gap:20px; margin: 20px 0;'>\n";
                products.forEach(p => {
                    let imgUrl = (p.productImages && p.productImages.length > 0) ? p.productImages[0].productImageMediumUrl : "";
                    if (imgUrl) imagesHtmlToInject += `<a href="https://wassyl.pl/product-pol-${p.productId || p.id}.html" target="_blank"><img src="${imgUrl}" style="max-width: 300px; border-radius: 5px;"></a>\n`;
                });
                imagesHtmlToInject += "</div>\n<br>";
                imageInstructions = `Wpleć zgrabnie ten kod HTML w środkowej części artykułu:\n\`\`\`html\n${imagesHtmlToInject}\n\`\`\``;
            }
        } catch(e) {}
    }

    const prompt = `Przekonwertuj tekst na HTML.\nTEKST:\n${article}\n\nWYTYCZNE HTML:\n1. Zwróć TYLKO zawartość do <body>.\n2. Śródtytuły jako <h2>. ZAKAZ Title Case w nagłówkach.\n3. ZDJĘCIA: ${imageInstructions}`;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) });
        const data = await res.json();
        let finalHtml = data.result.replace(/```html/g, '').replace(/```/g, '').trim();
        document.getElementById('html-result').value = finalHtml;
        document.getElementById('loader-html').style.display = 'none';
        document.getElementById('html-section').style.display = 'block';
    } catch(e) {
        document.getElementById('loader-html').style.display = 'none';
        alert("Błąd: " + e.message);
    }
}

// 6. PUBLIKACJA W IDOSELL
async function publishToIdosell() {
    const title = document.getElementById('pub-title').value;
    const lead = document.getElementById('pub-lead').value;
    const htmlContent = document.getElementById('html-result').value;
    if (!title || !htmlContent) return alert("Uzupełnij tytuł wpisu i wygeneruj HTML!");
    if (!confirm("Przesłać szkic do IdoSell?")) return;
    
    const loader = document.getElementById('loader-publish');
    loader.style.display = 'block';
    
    try {
        const res = await fetch('/api/idosell/publish_blog', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ title: title, lead: lead, content: htmlContent })
        });
        const data = await res.json();
        loader.style.display = 'none';
        
        if(data.success) {
            alert("✅ Sukces! Wpis zapisany jako SZKIC w module Blog IdoSell.");
        } else {
            alert("❌ Błąd IdoSell: " + (data.error));
        }
    } catch(e) {
        loader.style.display = 'none';
        alert("Błąd: " + e.message);
    }
}
