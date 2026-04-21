/**
 * BLOG.JS - Wersja Ostateczna (Brak gadulstwa AI, 1200x675 Kolaż, Oddzielny Lead, HTML 2-kolumnowy)
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

// ==========================================
// 0. GENEROWANIE POMYSŁÓW
// ==========================================
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
        
        // PANCERNY PARSER JSON (Trzystopniowy)
        let rawText = data.result || "";
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let ideas = [];
        try {
            // Próba 1: Czysty parse
            ideas = JSON.parse(rawText);
        } catch (e1) {
            // Próba 2: Wyciągnięcie siłą zawartości między nawiasami kwadratowymi
            const jsonMatch = rawText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                ideas = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("AI nie wygenerowało odpowiedniej struktury danych. Zwrócony tekst: " + rawText.substring(0, 100));
            }
        }

        // Zabezpieczenie przed sytuacją, gdy AI wypluje obiekt zamiast tablicy
        if (!Array.isArray(ideas)) {
            if (ideas.tematy && Array.isArray(ideas.tematy)) ideas = ideas.tematy;
            else if (ideas.ideas && Array.isArray(ideas.ideas)) ideas = ideas.ideas;
            else ideas = [ideas];
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
        ideas.forEach(idea => {
            const title = idea.title || "Brak tytułu";
            const desc = idea.desc || idea.description || "Brak opisu";
            const encodedTitle = encodeURIComponent(title);
            
            html += `
            <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <h4 style="margin-top: 0; color: #000; font-size: 16px;">${title}</h4>
                <p style="font-size: 13px; color: #666; margin-bottom: 15px;">${desc}</p>
                <button class="btn-primary" onclick="selectBlogIdea('${encodedTitle}')" style="margin: 0; font-size: 12px; padding: 6px 12px; background: #000;">✍️ Wybierz ten temat</button>
            </div>`;
        });
        html += '</div>';
        resBox.innerHTML = html;
    } catch (e) {
        loader.style.display = 'none';
        resBox.innerHTML = `<div style="color:red; padding:15px; background:#ffe6e6; border:1px solid red; border-radius:8px;">Błąd parsowania: ${e.message}</div>`;
    }
}

// 1. AUTO-DOBÓR
async function autoSelectProducts() {
    const topic = document.getElementById('topic-input').value;
    if (!topic) return alert("Wpisz najpierw temat artykułu!");
    const idsInput = document.getElementById('context-product-ids');
    idsInput.value = "⏳ Szukam w XML...";
    try {
        const feedRes = await fetch('/api/idosell/auto_products', {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({topic: topic})
        });
        const feedData = await feedRes.json();
        if (!feedData.products || feedData.products.length === 0) {
            idsInput.value = ""; return alert("Brak produktów w XML.");
        }
        const prompt = `Temat: "${topic}".\nLista: ${feedData.products.join("\n")}\nWybierz 3 najlepiej pasujące. Zwróć TYLKO ID po przecinku. ŻADNEGO ZBĘDNEGO TEKSTU.`;
        const aiRes = await fetch('/api/generate', {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ prompt: prompt, search: false })
        });
        const aiData = await aiRes.json();
        idsInput.value = aiData.result.trim();
        syncProductIds();
    } catch (e) {
        idsInput.value = ""; alert("Błąd: " + e.message);
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
    const prompt = `Zadanie: Stwórz chłodny, merytoryczny konspekt artykułu.\nTemat: ${topic}\n${productContext}\n\nWYTYCZNE:\n1. ZAKAZ języka stylizowanego ("ziomki"). To suchy dokument techniczny.\n2. ZAKAZ Title Case w nagłówkach.\n3. ZAKAZ gadulstwa. Zacznij od razu od konspektu.`;
    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) });
        const data = await res.json();
        document.getElementById('loader-plan').style.display = 'none';
        document.getElementById('plan-result').value = data.result;
        document.getElementById('plan-section').style.display = 'block';
    } catch(e) { document.getElementById('loader-plan').style.display = 'none'; alert("Błąd: " + e.message); }
}

// 3. GENEROWANIE ARTYKUŁU (BEZ LEADU, TYLKO BODY)
async function generateArticleFromPlan() {
    const topic = document.getElementById('topic-input').value;
    const plan = document.getElementById('plan-result').value;
    document.getElementById('loader-2').style.display = 'block';
    document.getElementById('article-section').style.display = 'none';
    
    const prompt = `
Zadanie: Napisz artykuł modowy wg konspektu (TYLKO treść główna, bez tytułu i bez wstępu/leadu).
TEMAT: ${topic}
KONSPEKT: ${plan}

WYTYCZNE (KRYTYCZNE):
1. TONE OF VOICE: Profesjonalny storytelling, zero slangu.
2. ZAKAZ GADULSTWA AI. Zacznij bezpośrednio od pierwszego śródtytułu. Nie dodawaj "Oto artykuł:".
3. AKAPITY: Krótkie (max 3-4 zdania). ZAKAZ "ścian tekstu".
4. NAGŁÓWKI: ZAKAZ Title Case.
5. POGRUBIENIA: Stosuj z rzadka. ZAKAZ używania podwójnych gwiazdek udających cudzysłów. Cudzysłów to "", a pogrubienie to **słowo**.
6. Zwróć Markdown.
    `;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) });
        const data = await res.json();
        document.getElementById('loader-2').style.display = 'none';
        let formatted = data.result;
        if (typeof marked !== 'undefined') formatted = marked.parse(formatted);
        document.getElementById('article-result').innerHTML = formatted;
        document.getElementById('article-section').style.display = 'block';
        updateBlogCharCounter();
    } catch(e) { document.getElementById('loader-2').style.display = 'none'; alert("Błąd: " + e.message); }
}

function updateBlogCharCounter() {
    const el = document.getElementById('article-result');
    if(!el) return;
    document.getElementById('char-counter').innerText = (el.innerText || "").length + " znaków";
}
function handleArticleEdit() { updateBlogCharCounter(); }

// 4. REWIZJA ARTYKUŁU (KNEBEL NA GADATLIWOŚĆ)
async function reviseArticle() {
    const article = document.getElementById('article-result').innerHTML;
    const instruction = document.getElementById('revision-input').value;
    if(!instruction) return alert("Podaj instrukcję!");
    const origText = article;
    document.getElementById('article-result').innerHTML = "⏳ Czekaj, naniosę poprawki...";
    
    const prompt = `Skoryguj tekst wg instrukcji.
TEKST:
${article}
INSTRUKCJA: ${instruction}

KRYTYCZNE WYTYCZNE:
1. Zwróć TYLKO I WYŁĄCZNIE poprawiony tekst. Kategoryczny zakaz dodawania jakichkolwiek komentarzy typu "Jasne, poprawiłem", "Oto tekst". 
2. ZAKAZ Title Case w nagłówkach i zakaz podwójnych gwiazdek jako cudzysłowu.
3. Zwróć Markdown.`;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) });
        const data = await res.json();
        let formatted = data.result;
        if (typeof marked !== 'undefined') formatted = marked.parse(formatted);
        document.getElementById('article-result').innerHTML = formatted;
        updateBlogCharCounter();
        document.getElementById('revision-input').value = "";
    } catch(e) { document.getElementById('article-result').innerHTML = origText; alert("Błąd: " + e.message); }
}

function quickRevise(instruction) {
    document.getElementById('revision-input').value = instruction;
    reviseArticle();
}

// 5. META DANE (TYTUŁ I LEAD) NA BAZIE NAPISANEGO TEKSTU
async function generateMeta(instruction = "") {
    const article = document.getElementById('article-result').innerText;
    if (article.length < 100) return alert("Napisz najpierw artykuł!");
    const metaSection = document.getElementById('meta-section');
    metaSection.style.display = 'block';
    
    const titleInput = document.getElementById('final-title');
    const leadInput = document.getElementById('final-lead');
    titleInput.value = "⏳ AI myśli...";
    leadInput.value = "⏳ AI analizuje tekst by stworzyć idealny hook...";
    
    const extra = instruction ? `Dodatkowa instrukcja do stylu: "${instruction}"` : "";

    const prompt = `
Przeanalizuj poniższy artykuł i wymyśl do niego idealny SEO Tytuł i krótki Lead (Hook).
TEKST ARTYKUŁU: ${article.substring(0, 3000)}...

WYTYCZNE:
1. Tytuł ma być chwytliwy, bez Title Case, bez kropki na końcu.
2. Lead to dokładnie 2-3 zdania "haczyka", które streszczają tekst i zachęcają do czytania. To nie może być nudne "W tym wpisie...".
${extra}

Zwróć TYLKO czysty obiekt JSON:
{"title": "Wymyślony tytuł", "lead": "Wymyślony lead"}
    `;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt, json_mode: true}) });
        const data = await res.json();
        let cleanJson = data.result.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);
        titleInput.value = result.title;
        leadInput.value = result.lead;
    } catch (e) {
        titleInput.value = "Błąd"; leadInput.value = "Błąd generowania.";
    }
}
function tweakMeta(instruction) { generateMeta(instruction); }

// PRZEJŚCIE DO PUBLIKACJI
function goToPublish() {
    const finalTitle = document.getElementById('final-title').value;
    const finalLead = document.getElementById('final-lead').value;
    if (!finalTitle || finalTitle.includes('⏳')) return alert("Wygeneruj najpierw Tytuł i Lead!");
    
    document.getElementById('pub-title').value = finalTitle;
    document.getElementById('pub-lead').value = finalLead;
    switchTab('tab3');
    generateHtml();
}

// 6. GENEROWANIE KOLAŻU STRICT 1200x675 W CANVAS
async function generateCollage() {
    const ids = document.getElementById('pub-collage-ids').value;
    if(!ids) return alert("Podaj ID produktów!");
    document.getElementById('loader-collage').style.display = 'block';
    
    const container = document.getElementById('collage-container');
    const canvas = document.getElementById('collage-canvas');
    const ctx = canvas.getContext('2d');
    container.style.display = 'none';

    try {
        const res = await fetch('/api/idosell/products', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids: ids}) });
        const data = await res.json();
        const products = data.results || data.products || [];
        
        let imageUrls = [];
        products.forEach(p => {
            if (p.productImages && p.productImages.length > 0) imageUrls.push(p.productImages[0].productImageLargeUrl || p.productImages[0].productImageMediumUrl);
            else if (p.zdjeciaUrls && p.zdjeciaUrls.length > 0) imageUrls.push(p.zdjeciaUrls[0]);
        });

        if(imageUrls.length === 0) {
            document.getElementById('loader-collage').style.display = 'none';
            return alert("Zwrócono produkty, ale nie mają zdjęć w IdoSell.");
        }

        // Ładujemy obrazy z CORS by móc zrysować
        const loadedImages = await Promise.all(imageUrls.slice(0,3).map(url => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => resolve(img);
                img.onerror = () => reject();
                img.src = url;
            });
        }));

        // Renderowanie 1200x675
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, 1200, 675);
        
        const count = loadedImages.length;
        const w = 1200 / count; // dzielimy szerokość równo
        
        loadedImages.forEach((img, i) => {
            // Skalowanie proporcjonalne jak "object-fit: cover"
            const scale = Math.max(w / img.width, 675 / img.height);
            const drawW = img.width * scale;
            const drawH = img.height * scale;
            const x = (i * w) + (w / 2) - (drawW / 2);
            const y = (675 / 2) - (drawH / 2);
            
            // Maskowanie, by zdjęcia nie wychodziły poza swoje "kolumny"
            ctx.save();
            ctx.beginPath();
            ctx.rect(i * w, 0, w, 675);
            ctx.clip();
            ctx.drawImage(img, x, y, drawW, drawH);
            ctx.restore();
            
            // Pionowa linia miedzy fotami
            if (i > 0) {
                ctx.fillStyle = "#fff";
                ctx.fillRect(i * w - 5, 0, 10, 675);
            }
        });

        document.getElementById('loader-collage').style.display = 'none';
        container.style.display = 'block';
    } catch(e) {
        document.getElementById('loader-collage').style.display = 'none';
        alert("Błąd tworzenia kolażu (częsty powód: IdoSell blokuje CORS dla obrazków). Użyj bezpośredniego pobrania ze sklepu.");
    }
}

// ==========================================
// 7. GENEROWANIE 2-KOLUMNOWEGO HTML (ZGODNIE Z SZABLONEM WASSYL)
// ==========================================
async function generateHtml() {
    const article = document.getElementById('article-result').innerHTML;
    const htmlIds = document.getElementById('pub-html-ids').value;
    document.getElementById('loader-html').style.display = 'block';
    document.getElementById('html-section').style.display = 'none';
    
    let injectedImagesInfo = "Brak zdjęć dodatkowych. Wygeneruj układ 1-kolumnowy z samym tekstem.";
    let products = [];
    if (htmlIds) {
        try {
            const res = await fetch('/api/idosell/products', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids: htmlIds}) });
            const data = await res.json();
            products = data.results || [];
            if(products.length > 0) {
                injectedImagesInfo = `Oto produkty, które MUSISZ osadzić w tekście, używając układów kolumnowych ze zdjęciami: \n`;
                products.forEach(p => {
                    let imgUrl = "";
                    if (p.productImages && p.productImages.length > 0) {
                        imgUrl = p.productImages[0].productImageLargeUrl || p.productImages[0].productImageMediumUrl;
                    } else if (p.zdjeciaUrls && p.zdjeciaUrls.length > 0) {
                        imgUrl = p.zdjeciaUrls[0];
                    }
                    if(imgUrl) {
                        injectedImagesInfo += `- URL Zdjęcia: ${imgUrl}, Link docelowy: https://wassyl.pl/product-pol-${p.productId || p.id}.html\n`;
                    }
                });
            }
        } catch(e) { console.error("Błąd pobierania info o zdjęciach:", e); }
    }

    const prompt = `
Zadanie: Przekonwertuj tekst artykułu na gotowy, czysty kod HTML dopasowany do szablonu bloga IdoSell.

TEKST ARTYKUŁU:
${article}

DOSTĘPNE ZDJĘCIA PRODUKTÓW DO OSADZENIA:
${injectedImagesInfo}

WYTYCZNE SZABLONU WASSYL (ZACHOWAJ BEZWZGLĘDNIE):
1. Zwróć TYLKO czysty kod HTML. Żadnych markdownów \`\`\`html.
2. ZAKAZ używania śmieciowych tagów w rodzaju id="docs-internal-guid..." czy zagnieżdżonych spanów z font-family.
3. Buduj układ korzystając z Flexboxa (styl inline). Przeplataj tekst ze zdjęciami.

WZÓR 1: Tekst i Zdjęcie (obok siebie):
<div style="display: flex; flex-wrap: wrap; margin-bottom: 30px;">
    <div style="flex: 1 1 0%; padding: 10px;">
        <h3 style="font-size: 14pt; text-align: justify;">Tytuł akapitu</h3>
        <p style="text-align: justify;">Treść akapitu...</p>
    </div>
    <div style="flex: 1 1 0%; padding: 10px;">
        <a href="LINK_DO_PRODUKTU"><img src="URL_ZDJECIA" style="max-width: 100%; display: block; margin: 0 auto;" width="90%" border="0"></a>
    </div>
</div>
*(Możesz odwrócić kolejność w kodzie, by zdjęcie było po lewej, a tekst po prawej).*

WZÓR 2: Dwa zdjęcia (Double Photo):
<div style="display: flex; flex-wrap: wrap; margin-bottom: 30px;">
    <div style="flex: 1 1 0%; padding: 10px;">
        <a href="LINK_DO_PRODUKTU_1"><img src="URL_ZDJECIA_1" style="max-width: 100%; display: block; margin: 0 auto;" width="90%" border="0"></a>
    </div>
    <div style="flex: 1 1 0%; padding: 10px;">
        <a href="LINK_DO_PRODUKTU_2"><img src="URL_ZDJECIA_2" style="max-width: 100%; display: block; margin: 0 auto;" width="90%" border="0"></a>
    </div>
</div>

WZÓR 3: Sam tekst (pełna szerokość):
<div style="flex-direction: column; margin-bottom: 30px;">
    <h3 style="font-size: 14pt;">Tytuł akapitu</h3>
    <p style="text-align: justify;">Treść akapitu...</p>
</div>

DOPASOWANIE: Użyj zdjęć z listy "DOSTĘPNE ZDJĘCIA" i wstaw je do wzorów (Wzór 1 lub Wzór 2) tam, gdzie pasują kontekstowo do tekstu.
    `;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) });
        const data = await res.json();
        let finalHtml = data.result.replace(/```html/g, '').replace(/```/g, '').trim();
        document.getElementById('html-result').value = finalHtml;
        document.getElementById('loader-html').style.display = 'none';
        document.getElementById('html-section').style.display = 'block';
    } catch(e) {
        document.getElementById('loader-html').style.display = 'none';
        alert("Błąd generowania HTML: " + e.message);
    }
}

// 8. PUBLIKACJA W IDOSELL
async function publishToIdosell() {
    const title = document.getElementById('pub-title').value;
    const lead = document.getElementById('pub-lead').value;
    const htmlContent = document.getElementById('html-result').value;
    
    if (!title || !htmlContent) return alert("Uzupełnij tytuł i wygeneruj HTML!");
    
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
            alert("✅ Sukces! Wpis zapisany jako SZKIC w IdoSell.");
        } else {
            alert("❌ Błąd IdoSell: " + (data.error));
        }
    } catch(e) {
        loader.style.display = 'none';
        alert("Błąd serwera: " + e.message);
    }
}
