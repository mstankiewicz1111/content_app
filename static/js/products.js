/**
 * PRODUCTS.JS - Ostateczny Fix AI + Komunikacja IdoSell + Rewizje + Wytyczne Wassyl
 */

function switchProdTab(tabId) { 
    document.querySelectorAll('#module-products .tab-content').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('#sidebar-products button').forEach(el => el.classList.remove('active')); 
    
    const targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.add('active'); 
    
    const targetBtn = document.getElementById('btn-' + tabId);
    if(targetBtn) targetBtn.classList.add('active'); 
}

async function loadProductToEdit() {
    const productId = document.getElementById('opt-product-id').value;
    if (!productId) return alert("Podaj ID produktu!");

    const loader = document.getElementById('loader-prod-fetch');
    const statusBox = document.getElementById('fetch-status');
    const statusList = document.getElementById('status-list');
    
    loader.style.display = 'block';
    statusBox.style.display = 'none';

    try {
        const res = await fetch('/api/idosell/products', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ids: productId })
        });
        const data = await res.json();

        let product;
        if (data.results && data.results.length > 0) product = data.results[0];
        else throw new Error("Brak produktu w odpowiedzi z API.");

        let nazwa = "Brak nazwy";
        let opisDlugi = "Brak opisu";
        
        if (product.productDescriptionsLangData) {
            const polData = product.productDescriptionsLangData.find(d => d.langId === 'pol');
            if (polData) {
                nazwa = polData.productName || nazwa;
                opisDlugi = polData.productLongDescription || polData.productDescription || opisDlugi;
            }
        }

        let zdjeciaUrls = [];
        if (product.productImages && Array.isArray(product.productImages)) {
            zdjeciaUrls = product.productImages.map(img => img.productImageMediumUrl || img.productImageSmallUrl || img.productImageLargeUrl);
        }

        let parametryTekst = "Brak parametrów";
        if (product.productParameters && Array.isArray(product.productParameters)) {
             parametryTekst = product.productParameters.map(p => {
                 const polName = p.parameterDescriptionsLangData?.find(l => l.langId === 'pol')?.parameterName || "Parametr";
                 const val = p.parameterValues?.[0]?.parameterValueDescriptionsLangData?.find(l => l.langId === 'pol')?.parameterValueName || "";
                 return `${polName}: ${val}`;
             }).join('\n');
        }

        const normalizedProduct = { id: productId, nazwa, opis: opisDlugi, parametry: parametryTekst, zdjeciaUrls };

        loader.style.display = 'none';
        statusBox.style.display = 'block';

        const check = (val) => val ? "✅" : "❌";
        statusList.innerHTML = `
            <li>${check(normalizedProduct.nazwa !== "Brak nazwy")} Nazwa towaru</li>
            <li>${check(normalizedProduct.opis !== "Brak opisu")} Opis długi</li>
            <li>${check(normalizedProduct.parametry !== "Brak parametrów")} Parametry techniczne</li>
            <li>${check(normalizedProduct.zdjeciaUrls.length > 0)} Zdjęcia (${normalizedProduct.zdjeciaUrls.length})</li>
        `;

        setTimeout(() => showProductEditor(normalizedProduct), 1500);

    } catch (e) {
        loader.style.display = 'none';
        alert("Błąd: " + e.message);
    }
}

function showProductEditor(product) {
    switchProdTab('prod-editor');

    document.getElementById('orig-name').innerText = product.nazwa;
    
    const imgContainer = document.getElementById('prod-images-preview');
    if (product.zdjeciaUrls && product.zdjeciaUrls.length > 0) {
        imgContainer.innerHTML = product.zdjeciaUrls.map(src => `<img src="${src}" style="height: 150px; border-radius: 5px; border: 1px solid #ddd; object-fit: cover;">`).join('');
    } else {
        imgContainer.innerHTML = '<p style="color: #888;">Brak zdjęć do wyświetlenia.</p>';
    }

    generateSEOContent(product);
}

async function generateSEOContent(product) {
    const editor = document.getElementById('new-description-editor');
    editor.innerHTML = "⏳ AI analizuje zdjęcie oraz parametry... Generuję opis (ok. 3000 znaków)...";

    // Wyciągamy ostatnie człony z oryginalnej nazwy jako sugestię dla modelu
    const parts = product.nazwa.split(' ');
    const suggestedCode = parts.slice(Math.max(parts.length - 3, 0)).join(' ');
    const firstImageUrl = (product.zdjeciaUrls && product.zdjeciaUrls.length > 0) ? product.zdjeciaUrls[0] : null;

    // --- NOWOŚĆ: PODPIĘCIE DNA MARKI WASSYL ---
    const brandContext = (typeof WASSYL_DNA !== 'undefined') ? WASSYL_DNA + "\n\n" : "";

    const prompt = `${brandContext}Zadanie: Optymalizacja SEO odzieży e-commerce dla polskiej marki Wassyl.

DANE BAZOWE:
- Stara Nazwa: ${product.nazwa}
- Parametry: ${product.parametry}

WYTYCZNE NAZWY:
1. Podział na 2 części długim myślnikiem " – ". Staraj się użyć tego znaku mniej więcej w połowie nazwy.
2. ZAKAZ Title Case. Zdanie zaczyna się od wielkiej litery, reszta słów małymi literami.
3. ZAKAZ kropki na końcu nazwy. (Dobre: "Czarna bluza oversize – idealna na spacer X672 / X1")
4. Na końcu MUSI pozostać pełne oznaczenie modelu ze Starej Nazwy (absolutnie nie pomijaj końcówek takich jak k01, / X1 itp.). Szukaj kodu w tych słowach: "${suggestedCode}".

WYTYCZNE OPISU HTML:
1. DŁUGOŚĆ: Max 3000 znaków. Pisz treściwie.
2. STYL: Lifestylowy vibe Wassyl. ZAKAZ EMOJI. ZAKAZ kolorów.
3. ZAKAZ ROZMIARÓW: W opisie nie wolno wspominać o rozmiarach (np. "modelka nosi S" albo "dostępna w rozmiarze mini"). Informacje z parametrów o rozmiarach zignoruj w tekście. Zignoruj też informację typu "Mierzone na płasko do wymiarów +/- 2 cm."
4. PRODUKCJA: OBOWIĄZKOWO wpleć do każdego opisu informację, że ubranie jest szyte w Polsce, w Waszej własnej szwalni (brzmienie naturalne).
5. MERYTORYKA: Opieraj się na analizie załączonego zdjęcia oraz składzie/kroju z Parametrów.
6. FORMAT HTML: Wyjustuj <div style="text-align: justify;">. BEZWZGLĘDNY ZAKAZ UŻYWANIA ZNAKÓW ** DO POGRUBIEŃ. Zawsze używaj znacznika <strong> dla kluczowych atutów.

Zwróć obiekt JSON:
{"name": "nowa nazwa bez kropki", "description": "html opisu"}
    `;

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt: prompt, json_mode: true, image_url: firstImageUrl })
        });
        const data = await res.json();
        
        let cleanJson = data.result.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);

        // --- NOWOŚĆ: ŻELAZNA MIOTŁA NA ZNACZNIKI MARKDOWN ---
        if (result.description) {
            result.description = result.description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        }

        document.getElementById('new-name-input').value = result.name || "";
        editor.innerHTML = result.description || "Błąd generowania.";
        updateCharCounter();
        editor.addEventListener('input', updateCharCounter);
        
    } catch (e) {
        editor.innerHTML = `<span style="color:red;">Błąd generowania AI: ${e.message}</span>`;
    }
}

// REWIZJA AI (Również zaktualizowana o nowe wytyczne i sprzątanie gwiazdek)
async function reviseProductSEO(customInstruction = null) {
    const editor = document.getElementById('new-description-editor');
    const nameInput = document.getElementById('new-name-input');
    const instruction = customInstruction || document.getElementById('prod-revision-input').value;
    
    if (!instruction) return alert("Wpisz uwagi do poprawy!");
    
    const currentDesc = editor.innerHTML;
    const currentName = nameInput.value;
    const origText = editor.innerHTML;
    
    editor.innerHTML = "⏳ AI nanosi Twoje poprawki...";

    // --- NOWOŚĆ: PODPIĘCIE DNA MARKI WASSYL ---
    const brandContext = (typeof WASSYL_DNA !== 'undefined') ? WASSYL_DNA + "\n\n" : "";
    
    const prompt = `${brandContext}Zadanie: Skoryguj nazwę i opis produktu modowego wg zaleceń użytkownika.
    
    OBECNA NAZWA: ${currentName}
    OBECNY OPIS HTML: ${currentDesc}
    
    INSTRUKCJA OD UŻYTKOWNIKA:
    "${instruction}"
    
    WYTYCZNE (ZACHOWAJ BEZWZGLĘDNIE):
    1. Zwróć JSON: {"name": "...", "description": "..."}
    2. Opis musi pozostać w formacie wyjustowanego HTML z pogrubieniami <strong>. BEZWZGLĘDNY ZAKAZ UŻYWANIA ZNAKÓW **.
    3. ZAKAZ używania wielkich liter w środku nazwy (Title Case) i ZAKAZ kropki na końcu nazwy.
    4. ZAKAZ emoji, ZAKAZ wspominania o kolorach i ZAKAZ wspominania o rozmiarach/wymiarach modelki.
    5. Zachowaj kod modelu na końcu nazwy (np. E253 k01).
    6. W opisie musi pozostać informacja, że ubranie szyjecie w Polsce, we własnej szwalni.
    `;

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt: prompt, json_mode: true })
        });
        const data = await res.json();
        let cleanJson = data.result.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);

        // --- NOWOŚĆ: ŻELAZNA MIOTŁA NA ZNACZNIKI MARKDOWN W REWIZJI ---
        if (result.description) {
            result.description = result.description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        }

        nameInput.value = result.name || currentName;
        editor.innerHTML = result.description || currentDesc;
        updateCharCounter();
        if(!customInstruction) document.getElementById('prod-revision-input').value = '';
    } catch (e) {
        editor.innerHTML = origText;
        alert("Błąd podczas nanoszenia poprawek: " + e.message);
    }
}

function updateCharCounter() {
    const editor = document.getElementById('new-description-editor');
    if(!editor) return;
    const textLength = editor.innerText.length;
    const counter = document.getElementById('prod-char-counter');
    counter.innerText = textLength + " znaków";
    counter.className = (textLength >= 2800 && textLength <= 3500) ? "counter-badge counter-good" : "counter-badge counter-warn";
}

function copyToClipboard(elementId) {
    const el = document.getElementById(elementId);
    const html = el.innerHTML;
    navigator.clipboard.writeText(html).then(() => alert("Skopiowano kod HTML!"));
}

async function updateProductInIdosell() {
    const productId = document.getElementById('opt-product-id').value;
    const newName = document.getElementById('new-name-input').value;
    const newDesc = document.getElementById('new-description-editor').innerHTML;
    
    if (!confirm(`Czy na pewno chcesz zaktualizować dane dla produktu ID: ${productId} w IdoSell?`)) return;

    const btn = document.getElementById('btn-prod-update');
    const origText = btn.innerText;
    btn.innerText = "⏳ Aktualizuję...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/idosell/update_product', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id: productId, name: newName, long_description: newDesc })
        });
        const data = await res.json();
        
        if (data.success) {
            alert("✅ Sukces! Produkt został zaktualizowany w sklepie.");
        } else {
            alert("❌ Odrzucono przez IdoSell: " + (data.error || "Nieznany błąd"));
        }
    } catch (e) {
        alert("❌ Błąd połączenia: " + e.message);
    } finally {
        btn.innerText = origText;
        btn.disabled = false;
    }
}

// =====================================================================
// MASOWA OPTYMALIZACJA PRODUKTÓW (HUMAN-IN-THE-LOOP)
// =====================================================================

let massProductsQueue = []; // Tutaj trzymamy dane do wysyłki

async function startMassGeneration() {
    const idsInput = document.getElementById('mass-product-ids').value;
    // Wyciągamy same cyfry, ignorujemy spacje i białe znaki
    const ids = idsInput.split(/[\s,]+/).filter(id => id.trim() !== '' && !isNaN(id));
    
    if (ids.length === 0) return alert("Podaj przynajmniej jedno ID produktu!");
    if (ids.length > 20) return alert("Dla bezpieczeństwa jednorazowo możesz przetworzyć max 20 produktów.");

    const progressContainer = document.getElementById('mass-progress-container');
    const progressBar = document.getElementById('mass-progress-bar');
    const statusText = document.getElementById('mass-status-text');
    const resultsContainer = document.getElementById('mass-results-container');
    const publishBtn = document.getElementById('btn-mass-publish');

    // Resetowanie widoku
    progressContainer.style.display = 'block';
    resultsContainer.innerHTML = '';
    publishBtn.style.display = 'none';
    massProductsQueue = [];

    try {
        statusText.innerText = "⏳ Pobieranie danych z IdoSell...";
        progressBar.style.width = "10%";

        // 1. Pobieramy produkty z IdoSell
        const res = await fetch('/api/idosell/products', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ids: ids.join(',') })
        });
        const data = await res.json();
        
        if (!data.results || data.results.length === 0) {
            throw new Error("Nie znaleziono podanych produktów w bazie IdoSell.");
        }

        const products = data.results;
        
        // 2. Pętla przez produkty - generujemy opisy JEDEN PO DRUGIM
        // --- BEZPIECZNE WYCIĄGANIE NAZWY ---
            let nazwa = "Brak nazwy";
            if (prod.productDescriptionsLangData) {
                const polData = prod.productDescriptionsLangData.find(d => d.langId === 'pol');
                if (polData && polData.productName) nazwa = polData.productName;
            }

            // --- BEZPIECZNE WYCIĄGANIE PARAMETRÓW ---
            let parametryTekst = "Brak parametrów";
            if (prod.productParameters && Array.isArray(prod.productParameters)) {
                parametryTekst = prod.productParameters.map(p => {
                    const polName = p.parameterDescriptionsLangData?.find(l => l.langId === 'pol')?.parameterName || "Parametr";
                    const val = p.parameterValues?.[0]?.parameterValueDescriptionsLangData?.find(l => l.langId === 'pol')?.parameterValueName || "";
                    return `${polName}: ${val}`;
                }).join(', ');
            }

            // --- NOWOŚĆ: BEZPIECZNE WYCIĄGANIE ZDJĘCIA DLA AI ---
            let firstImageUrl = null;
            if (prod.productImages && prod.productImages.length > 0) {
                firstImageUrl = prod.productImages[0].productImageLargeUrl || prod.productImages[0].productImageMediumUrl;
            } else if (prod.productIcon && prod.productIcon.productIconLargeUrl) {
                firstImageUrl = prod.productIcon.productIconLargeUrl;
            }

            statusText.innerText = `🤖 Generowanie przez AI (${i + 1} z ${products.length}): ${nazwa}`;
            progressBar.style.width = `${10 + ((i / products.length) * 90)}%`;

            // Przygotowanie danych
            const parts = nazwa.split(' ');
            const suggestedCode = parts.slice(Math.max(parts.length - 3, 0)).join(' ');
            const brandContext = (typeof WASSYL_DNA !== 'undefined') ? WASSYL_DNA + "\n\n" : "";

            // --- PEŁNY, RYGORYSTYCZNY PROMPT (1:1 z pojedynczym produktem) ---
            const prompt = `${brandContext}Zadanie: Optymalizacja SEO odzieży e-commerce dla polskiej marki Wassyl.

DANE BAZOWE:
- Stara Nazwa: ${nazwa}
- Parametry: ${parametryTekst}

WYTYCZNE NAZWY:
1. Podział na 2 części długim myślnikiem " – ". Staraj się użyć tego znaku mniej więcej w połowie nazwy.
2. ZAKAZ Title Case. Zdanie zaczyna się od wielkiej litery, reszta słów małymi literami.
3. ZAKAZ kropki na końcu nazwy. (Dobre: "Czarna bluza oversize – idealna na spacer X672 / X1")
4. Na końcu MUSI pozostać pełne oznaczenie modelu ze Starej Nazwy (absolutnie nie pomijaj końcówek takich jak k01, / X1 itp.). Szukaj kodu w tych słowach: "${suggestedCode}".

WYTYCZNE OPISU HTML:
1. DŁUGOŚĆ: Max 3000 znaków. Pisz treściwie.
2. STYL: Lifestylowy vibe Wassyl. ZAKAZ EMOJI. ZAKAZ kolorów.
3. ZAKAZ ROZMIARÓW: W opisie nie wolno wspominać o rozmiarach (np. "modelka nosi S"). Informacje z parametrów o rozmiarach zignoruj w tekście. Zignoruj też info typu "Mierzone na płasko".
4. PRODUKCJA: OBOWIĄZKOWO wpleć do każdego opisu informację, że ubranie jest szyte w Polsce, w naszej własnej szwalni (brzmienie naturalne).
5. MERYTORYKA: Opieraj się na analizie załączonego zdjęcia oraz składzie/kroju z Parametrów.
6. FORMAT HTML: Wyjustuj <div style="text-align: justify;">. BEZWZGLĘDNY ZAKAZ UŻYWANIA ZNAKÓW ** DO POGRUBIEŃ. Zawsze używaj znacznika <strong> dla kluczowych atutów.

Zwróć obiekt JSON:
{"name": "nowa nazwa bez kropki", "description": "html opisu"}`;

            try {
                // Zapytanie do AI (teraz z uwzględnieniem zdjęcia!)
                const aiRes = await fetch('/api/generate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ prompt: prompt, json_mode: true, image_url: firstImageUrl })
                });
                const aiData = await aiRes.json();
                let aiResult = JSON.parse(aiData.result.replace(/```json/g, '').replace(/```/g, ''));
                
                // Żelazna miotła na gwiazdki
                let cleanDesc = aiResult.description || "Błąd generowania.";
                cleanDesc = cleanDesc.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

                // Zapisujemy do kolejki
                massProductsQueue.push({
                    id: prod.productId,
                    originalName: nazwa,
                    newName: aiResult.name || nazwa,
                    newDesc: cleanDesc,
                    accepted: false
                });

                // Rysujemy kafelek na ekranie
                if (typeof renderMassCard === 'function') {
                    renderMassCard(massProductsQueue.length - 1);
                }

            } catch (err) {
                console.error(`Błąd AI dla ${prod.productId}:`, err);
                resultsContainer.innerHTML += `<div style="color:red; padding: 10px;">❌ Błąd generowania dla ID: ${prod.productId}</div>`;
            }
        }

        statusText.innerText = "✅ Generowanie zakończone! Sprawdź i zaakceptuj opisy poniżej.";
        progressBar.style.width = "100%";
        publishBtn.style.display = 'block';

    } catch (e) {
        statusText.innerText = "❌ Wystąpił błąd!";
        alert(e.message);
    }
}

// Rysowanie pojedynczego kafelka do weryfikacji
function renderMassCard(index) {
    const item = massProductsQueue[index];
    const container = document.getElementById('mass-results-container');
    
    const cardHtml = `
    <div id="mass-card-${index}" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #fff; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0; color: #333;">🛒 ID: ${item.id}</h4>
            <span style="font-size: 12px; color: #888;">Oryginał: ${item.originalName}</span>
        </div>
        
        <div id="mass-card-content-${index}" style="margin-top: 15px;">
            <label style="font-size: 12px; font-weight: bold;">Nowa Nazwa:</label>
            <input type="text" id="mass-name-${index}" value="${item.newName.replace(/"/g, '&quot;')}" style="width: 100%; margin-bottom: 10px; padding: 5px;">
            
            <label style="font-size: 12px; font-weight: bold;">Nowy Opis (HTML):</label>
            <textarea id="mass-desc-${index}" style="width: 100%; height: 120px; font-family: monospace; font-size: 12px; padding: 5px;">${item.newDesc}</textarea>
            
            <button onclick="acceptMassProduct(${index})" class="btn-primary" style="margin-top: 10px; width: 100%; background: #28a745;">✅ Wygląda super, Akceptuj</button>
        </div>
    </div>`;
    
    container.insertAdjacentHTML('beforeend', cardHtml);
}

// Akceptowanie i zwijanie kafelka
function acceptMassProduct(index) {
    // Zapisujemy ewentualne ręczne poprawki z inputów
    massProductsQueue[index].newName = document.getElementById(`mass-name-${index}`).value;
    massProductsQueue[index].newDesc = document.getElementById(`mass-desc-${index}`).value;
    massProductsQueue[index].accepted = true;

    // Zwijamy kafelek (wizualny feedback)
    const content = document.getElementById(`mass-card-content-${index}`);
    content.style.display = 'none';
    
    const card = document.getElementById(`mass-card-${index}`);
    card.style.border = '2px solid #28a745';
    card.style.opacity = '0.7';
    
    // Dodajemy małą etykietkę "Zaakceptowano"
    const header = card.querySelector('div');
    header.innerHTML += `<span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px;">Gotowe do wysyłki</span>`;
}

// Ostateczna wysyłka do IdoSell
async function publishMassProducts() {
    const acceptedItems = massProductsQueue.filter(item => item.accepted);
    
    if (acceptedItems.length === 0) {
        return alert("Nie zaakceptowałeś jeszcze żadnego produktu!");
    }

    if (!confirm(`Wysyłasz ${acceptedItems.length} produktów do IdoSell. Jesteś pewien?`)) return;

    const btn = document.getElementById('btn-mass-publish');
    btn.innerText = "⏳ Wysyłanie...";
    btn.disabled = true;

    let successCount = 0;
    let errorCount = 0;

    // Wysyłamy pojedynczo, żeby nie dostać błędu 429 lub 207 (Multi-Status)
    for (const item of acceptedItems) {
        try {
            const res = await fetch('/api/idosell/update_product', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    id: item.id, 
                    name: item.newName, 
                    long_description: item.newDesc 
                })
            });
            const data = await res.json();
            
            if (data.success) {
                successCount++;
                document.getElementById(`mass-card-${massProductsQueue.indexOf(item)}`).style.display = 'none'; // Znika całkowicie po sukcesie
            } else {
                errorCount++;
                console.error(`Błąd wysyłki ID ${item.id}:`, data.error);
            }
        } catch (e) {
            errorCount++;
        }
    }

    btn.innerText = "✅ WYŚLIJ ZAAKCEPTOWANE DO IDOSELL";
    btn.disabled = false;
    alert(`Wysyłka zakończona!\nSukces: ${successCount}\nBłędy: ${errorCount} (Sprawdź konsolę F12 jeśli są błędy)`);
}
