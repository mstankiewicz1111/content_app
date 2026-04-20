/**
 * PRODUCTS.JS - Obsługa optymalizacji Google Discover + Wysyłka do IdoSell
 */

function switchProdTab(tabId) { 
    document.querySelectorAll('#module-products .tab-content').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('#sidebar-products button').forEach(el => el.classList.remove('active')); 
    
    const targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.add('active'); 
    
    const targetBtn = document.getElementById('btn-' + tabId);
    if(targetBtn) targetBtn.classList.add('active'); 

    if(window.innerWidth <= 768 && typeof toggleMobileMenu === 'function') toggleMobileMenu(); 
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

        // 1. NAZWA I OPIS (Szukamy języka polskiego)
        let nazwa = "Brak nazwy";
        let opisDlugi = "Brak opisu";
        
        if (product.productDescriptionsLangData) {
            const polData = product.productDescriptionsLangData.find(d => d.langId === 'pol');
            if (polData) {
                nazwa = polData.productName || nazwa;
                opisDlugi = polData.productLongDescription || polData.productDescription || opisDlugi;
            }
        }

        // 2. ZDJĘCIA (Szukamy productImages)
        let zdjeciaUrls = [];
        if (product.productImages && Array.isArray(product.productImages)) {
            zdjeciaUrls = product.productImages.map(img => img.productImageMediumUrl || img.productImageSmallUrl || img.productImageLargeUrl);
        }

        // 3. PARAMETRY (Szukamy polskich tłumaczeń)
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
    
    // Render zdjęć
    const imgContainer = document.getElementById('prod-images-preview');
    if (product.zdjeciaUrls && product.zdjeciaUrls.length > 0) {
        imgContainer.innerHTML = product.zdjeciaUrls.map(src => `<img src="${src}" style="height: 150px; border-radius: 5px; border: 1px solid #ddd; object-fit: cover;">`).join('');
    } else {
        imgContainer.innerHTML = '<p style="color: #888; font-size: 13px; font-style: italic;">Brak zdjęć dla tego produktu.</p>';
    }

    generateSEOContent(product);
}

async function generateSEOContent(product) {
    const editor = document.getElementById('new-description-editor');
    // Zmieniony komunikat ładowania
    editor.innerHTML = "⏳ AI analizuje parametry oraz zdjęcie produktu, aby napisać opis (ok. 3000 znaków)...";

    // Wyciągamy kod z oryginalnej nazwy (np. E253 k01)
    const modelCodeMatch = product.nazwa.match(/([A-Z0-9]+\s*[a-z0-9]*)$/i);
    const modelCode = modelCodeMatch ? modelCodeMatch[0] : "";

    // NOWOŚĆ: Pobieramy pierwszy URL zdjęcia do analizy przez AI (jeśli istnieje)
    const firstImageUrl = (product.zdjeciaUrls && product.zdjeciaUrls.length > 0) ? product.zdjeciaUrls[0] : null;

    const prompt = `
Zadanie: Optymalizacja SEO dla odzieży e-commerce (marka Wassyl).

DANE BAZOWE:
- Stara Nazwa: ${product.nazwa}
- Parametry (Skład, Krój, Wymiary, Modelka): ${product.parametry}

WYTYCZNE NAZWY TOWARU:
1. Składa się z 2 części, oddzielonych długim myślnikiem " – ". (np. Czarna dopasowana sukienka na ramiączkach – idealny wybór na randkę i imprezę ${modelCode}).
2. CAŁKOWITY ZAKAZ UŻYWANIA "TITLE CASE" (Wielkich Liter Na Początku Każdego Słowa). Stosuj zwykłe zasady pisowni, jak w zdaniu.
3. Na samym końcu MUSI pozostać kod modelu: ${modelCode}.

WYTYCZNE OPISU HTML (Google Discover):
1. DŁUGOŚĆ: Wygeneruj tekst o długości od 2800 do maksymalnie 3200 znaków. Pisz zwięźle.
2. STYL I TONE OF VOICE: Edgy, lifestylowy vibe Wassyl. Żadnej sztywnej korpo-mowy. ABSOLUTNY ZAKAZ UŻYWANIA EMOJI. ZAKAZ wspominania o kolorach (warianty są grupowane).
3. MERYTORYKA (ANALIZA ZDJĘCIA): Opieraj się na suchych faktach z "Parametrów" oraz na WŁASNEJ ANALIZIE ZAŁĄCZONEGO ZDJĘCIA (jeśli je otrzymałeś). Opisz krój, to, jak materiał układa się na sylwetce i wymyśl naturalne scenariusze użycia (kawa na mieście, spacer z psem, wyjście na uczelnię, wieczór ze znajomymi).
4. HTML FORMAT: Cały opis zamknij w tagu <div style="text-align: justify;">. Najważniejsze informacje pogrubiaj tagiem <strong>.

Zwróć wynik jako czysty obiekt JSON:
{"name": "nowa nazwa produktu", "description": "tutaj pełny kod HTML opisu"}
    `;

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                prompt: prompt, 
                json_mode: true,
                image_url: firstImageUrl // <-- PRZEKAZUJEMY URL ZDJĘCIA DO BACKENDU
            })
        });
        const data = await res.json();
        
        let cleanJson = data.result.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);

        document.getElementById('new-name-input').value = result.name || "";
        editor.innerHTML = result.description || "Błąd generowania.";
        updateCharCounter();
        editor.addEventListener('input', updateCharCounter);
        
    } catch (e) {
        editor.innerHTML = `<span style="color:red;">Błąd generowania AI. Odśwież i spróbuj ponownie. Błąd: ${e.message}</span>`;
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

function refreshProductSEO() {
    const origName = document.getElementById('orig-name').innerText;
    generateSEOContent({ nazwa: origName, opis: "Wygeneruj nową propozycję opisu (ok. 3000 znaków).", parametry: "Zachowaj parametry." });
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
    
    if (!confirm(`Czy na pewno chcesz zaktualizować dane dla produktu ID: ${productId} w systemie IdoSell? Zmiana nadpisze obecne dane na żywo.`)) return;

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
            alert("✅ Sukces! Produkt został zaktualizowany.");
        } else {
            alert("❌ Błąd aktualizacji IdoSell: " + (data.error || "Nieznany błąd"));
        }
    } catch (e) {
        alert("❌ Błąd połączenia: " + e.message);
    } finally {
        btn.innerText = origText;
        btn.disabled = false;
    }
}
