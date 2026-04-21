/**
 * BLOG.JS - Wersja Premium (Storytelling, Auto-dobór, Poprawki Copywriterskie)
 */

function switchTab(tabId) {
    document.querySelectorAll('#module-blog .tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#sidebar-blog button').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.getElementById('btn-' + tabId).classList.add('active');
}

function saveDraft() {
    // Prosta funkcja zapisu lokalnego (opcjonalnie do rozbudowy)
}

function syncProductIds() {
    const ids = document.getElementById('context-product-ids').value;
    document.getElementById('pub-rec-ids').value = ids;
    document.getElementById('pub-html-ids').value = ids;
    document.getElementById('pub-collage-ids').value = ids;
}

// ==========================================
// 1. AUTO-DOBÓR PRODUKTÓW DO TEMATU
// ==========================================
async function autoSelectProducts() {
    const topic = document.getElementById('topic-input').value;
    if (!topic) return alert("Wpisz najpierw temat artykułu!");

    const idsInput = document.getElementById('context-product-ids');
    idsInput.value = "⏳ Szukam w XML...";

    try {
        // Pobieramy pulę produktów z XML
        const feedRes = await fetch('/api/idosell/auto_products', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({topic: topic})
        });
        const feedData = await feedRes.json();
        
        if (!feedData.products || feedData.products.length === 0) {
            idsInput.value = "";
            return alert("Brak produktów w XML. Wpisz ręcznie.");
        }

        // Prosimy AI o wybranie 3 najlepszych z listy
        const prompt = `
        Temat artykułu modowego: "${topic}".
        Oto lista najnowszych produktów ze sklepu (ID i Nazwa):\n${feedData.products.join("\n")}\n
        Wybierz dokładnie 3 produkty, które najlepiej pasują do tego tematu. Zwróć TYLKO ich ID, oddzielone przecinkiem (np. 1234, 5678, 9012). Bez żadnego innego tekstu.
        `;

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
        alert("Błąd auto-doboru: " + e.message);
    }
}

// ==========================================
// 2. GENEROWANIE KONSPEKTU (CHŁODNY, INFORMACYJNY)
// ==========================================
async function generatePlan() {
    const topic = document.getElementById('topic-input').value;
    if(!topic) return alert("Podaj temat wpisu!");
    
    document.getElementById('loader-plan').style.display = 'block';
    document.getElementById('plan-section').style.display = 'none';
    
    const productIds = document.getElementById('context-product-ids').value;
    let productContext = "";
    if (productIds) {
        productContext = `Uwzględnij w konspekcie miejsce na lokowanie tych produktów (ID: ${productIds}). Wplatamy je naturalnie.`;
    }

    const prompt = `
Zadanie: Stwórz chłodny, merytoryczny i czysto roboczy konspekt artykułu na bloga modowego.
Temat: ${topic}
${productContext}

WYTYCZNE DLA KONSPEKTU (KRYTYCZNE):
1. ZAKAZ używania języka stylizowanego ("ziomki", "hej dziewczyny" itp.). To dokument techniczny dla copywritera.
2. Konspekt ma zawierać 4-5 głównych śródtytułów (H2).
3. Pod każdym śródtytułem NAPISZ 1-2 ZDANIA INFORMACYJNE, wyjaśniające dokładnie, o czym będzie ten fragment tekstu, jakie argumenty poruszyć i w jakiej kolejności. Zwróć uwagę copywriterowi, na czym ma się skupić.
4. Oznacz miejsce na podsumowanie, ale pomiń lead (będzie pisany na końcu).
    `;

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

// ==========================================
// 3. GENEROWANIE ARTYKUŁU (STORYTELLING, AKAPITY, LEAD NA KOŃCU)
// ==========================================
async function generateArticleFromPlan() {
    const topic = document.getElementById('topic-input').value;
    const plan = document.getElementById('plan-result').value;
    
    document.getElementById('loader-2').style.display = 'block';
    document.getElementById('article-section').style.display = 'none';
    
    const prompt = `
Zadanie: Napisz pełny artykuł na bloga modowego na podstawie poniższego roboczego konspektu.

TEMAT: ${topic}
KONSPEKT ROBOCZY:
${plan}

WYTYCZNE COPYWRITERSKIE (ABSOLUTNIE KRYTYCZNE):
1. TONE OF VOICE: Profesjonalny, kobiecy, inspirujący lifestylowy storytelling. 
2. ZAKAZ TANIEGO SLANGU. Nie używaj słów typu: "ziomki", "tryb pełen akcji", "mega", "sztos". Pisz jak redaktorka Vogue, a nie nastolatka na TikToku.
3. STRUKTURA AKAPITÓW (BARDZO WAŻNE): Tekst musi oddychać. ZAKAZ pisania "ścian tekstu". Jeden akapit może mieć MAKSYMALNIE 3-4 krótkie zdania. Pod każdym śródtytułem zrób minimum 2 osobne, krótkie akapity (oddzielone Enterem).
4. SPRZEDAŻ: Pisz w formie storytellingu, edukuj i inspiruj. Lokowanie produktów ma być dyskretne i naturalne. Bez nachalnego "Kup teraz".
5. LEAD (WSTĘP): Zostaw go na sam koniec procesu twórczego. Napisz NA SAMEJ GÓRZE artykułu krótki Lead (dokładnie 2 lub 3 zdania). Lead nie ma być nudnym "W tym artykule dowiesz się", ale potężnym, zaczepnym "haczykiem" (Hook), który intryguje i podsumowuje sedno artykułu.
6. Zwróć tekst jako czysty Markdown (## Śródtytuły, **pogrubienia** ważnych fraz). Zrób widoczne odstępy między akapitami.
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
        if (typeof marked !== 'undefined') formatted = marked.parse(formatted); // Jeśli masz bibliotekę marked.js
        
        const resBox = document.getElementById('article-result');
        resBox.innerHTML = formatted;
        document.getElementById('article-section').style.display = 'block';
        updateCharCounter();
    } catch(e) {
        document.getElementById('loader-2').style.display = 'none';
        alert("Błąd: " + e.message);
    }
}

function updateCharCounter() {
    const text = document.getElementById('article-result').innerText;
    document.getElementById('char-counter').innerText = text.length + " znaków";
}

function handleArticleEdit() { updateCharCounter(); }

async function reviseArticle() {
    // Kod bez zmian, poprawianie działa prawidłowo
}
function quickRevise(instruction) {
    document.getElementById('revision-input').value = instruction;
    reviseArticle();
}

// ==========================================
// 4. KOLAŻ ZDJĘĆ (NAPRAWIONE POBIERANIE)
// ==========================================
async function generateCollage() {
    const ids = document.getElementById('pub-collage-ids').value;
    if(!ids) return alert("Podaj ID produktów na kolaż!");
    
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
            return alert("Nie znaleziono produktów w IdoSell! Sprawdź poprawność ID.");
        }
        
        // Zamiast rysować na canvas, zrobimy CSS Grid dla czystego podglądu
        let htmlImages = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; margin-top:15px;">`;
        
        products.forEach(p => {
            let imgUrl = "";
            if (p.productImages && p.productImages.length > 0) {
                imgUrl = p.productImages[0].productImageMediumUrl || p.productImages[0].productImageSmallUrl;
            } else if (p.zdjeciaUrls && p.zdjeciaUrls.length > 0) {
                imgUrl = p.zdjeciaUrls[0];
            } else if (p.url_zdjecia) {
                imgUrl = p.url_zdjecia;
            }
            
            if(imgUrl) {
                htmlImages += `<img src="${imgUrl}" style="width: 100%; border-radius: 8px; border: 1px solid #ddd; object-fit: cover;">`;
            }
        });
        htmlImages += `</div>`;
        
        preview.outerHTML = htmlImages; // Zastępujemy stary tag img gridem
        document.getElementById('loader-collage').style.display = 'none';
    } catch(e) {
        document.getElementById('loader-collage').style.display = 'none';
        alert("Błąd pobierania zdjęć: " + e.message);
    }
}

// ==========================================
// 5. GENEROWANIE HTML ZE ZDJĘCIAMI
// ==========================================
async function generateHtml() {
    const article = document.getElementById('article-result').innerHTML;
    const htmlIds = document.getElementById('pub-html-ids').value;
    
    document.getElementById('loader-html').style.display = 'block';
    document.getElementById('html-section').style.display = 'none';
    
    // Jeśli podano ID, spróbujmy najpierw pobrać do nich linki zdjęć
    let imageInstructions = "Nie wstawiaj żadnych dodatkowych zdjęć produktów.";
    if (htmlIds) {
        try {
            const res = await fetch('/api/idosell/products', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ids: htmlIds})
            });
            const data = await res.json();
            const products = data.results || data.products || [];
            
            if (products.length > 0) {
                let imagesHtmlToInject = "\n<br><div style='display:flex; justify-content:center; gap:20px; margin: 20px 0;'>\n";
                products.forEach(p => {
                    let imgUrl = "";
                    if (p.productImages && p.productImages.length > 0) {
                        imgUrl = p.productImages[0].productImageMediumUrl;
                    }
                    if (imgUrl) {
                        imagesHtmlToInject += `<a href="https://wassyl.pl/product-pol-${p.productId || p.id}.html" target="_blank"><img src="${imgUrl}" alt="${p.productName || 'Produkt Wassyl'}" style="max-width: 300px; border-radius: 5px;"></a>\n`;
                    }
                });
                imagesHtmlToInject += "</div>\n<br>";
                
                imageInstructions = `Wpleć zgrabnie ten kod HTML ze zdjęciami polecanych produktów w środkowej części artykułu, najlepiej między pasującymi akapitami:\n\`\`\`html\n${imagesHtmlToInject}\n\`\`\``;
            }
        } catch(e) { console.error("Nie udało się pobrać zdjęć do HTML", e); }
    }

    const prompt = `
Przekonwertuj ten tekst na czysty, estetyczny kod HTML na bloga.
TEKST:
${article}

WYTYCZNE HTML:
1. Zwróć TYLKO zawartość do wklejenia w edytor źródłowy (bez tagów <html>, <head>, <body>).
2. Śródtytuły używaj jako <h2> lub <h3>. 
3. Akapity jako <p> z marginesem dolnym. 
4. Pogrubienia zachowaj jako <strong>.
5. ZDJĘCIA: ${imageInstructions}
    `;

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({prompt: prompt})
        });
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

// ==========================================
// 6. PUBLIKACJA W IDOSELL (NAPRAWIONO KOMUNIKACJE)
// ==========================================
async function publishToIdosell() {
    const title = document.getElementById('pub-title').value;
    const lead = document.getElementById('pub-lead').value;
    const htmlContent = document.getElementById('html-result').value;
    
    if (!title || !htmlContent) return alert("Uzupełnij tytuł wpisu i wygeneruj HTML!");
    if (!confirm("Czy na pewno chcesz przesłać ten szkic do panelu IdoSell?")) return;
    
    const loader = document.getElementById('loader-publish');
    loader.style.display = 'block';
    
    try {
        // Uderzamy do nowego, poprawionego endpointu
        const res = await fetch('/api/idosell/publish_blog', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                title: title,
                lead: lead,
                content: htmlContent
            })
        });
        
        const data = await res.json();
        loader.style.display = 'none';
        
        if(data.success) {
            alert("✅ Sukces! Wpis zapisany jako SZKIC w module Blog IdoSell.");
        } else {
            alert("❌ Odrzucono przez IdoSell: " + (data.error || "Sprawdź ID Bloga w konfiguracji backendu."));
        }
    } catch(e) {
        loader.style.display = 'none';
        alert("Błąd połączenia: " + e.message);
    }
}
