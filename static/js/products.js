/**
 * PRODUCTS.JS - Optymalizacja pod Google Discover (Zoptymalizowany Prompt + Aktualizacja)
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

        // Obsługa zarówno surowego payloadu (results) jak i zmapowanego (products)
        let product;
        if (data.results && data.results.length > 0) product = data.results[0];
        else if (data.products && data.products.length > 0) product = data.products[0];
        else throw new Error("Brak produktu w odpowiedzi z API.");

        // 1. NAZWA I OPIS
        let nazwa = product.nazwa || "Brak nazwy";
        let opisDlugi = product.opis || "Brak opisu";
        
        if (product.productDescriptionsLangData) {
            const polData = product.productDescriptionsLangData.find(d => d.langId === 'pol');
            if (polData) {
                nazwa = polData.productName || nazwa;
                opisDlugi = polData.productLongDescription || polData.productDescription || opisDlugi;
            }
        }

        // 2. ZDJĘCIA
        let zdjeciaUrls = [];
        if (product.productImages && Array.isArray(product.productImages)) {
            zdjeciaUrls = product.productImages.map(img => img.productImageSmallUrl || img.productImageLargeUrl);
        } else if (product.zdjecia && Array.isArray(product.zdjecia)) {
            zdjeciaUrls = product.zdjecia;
        }

        // 3. PARAMETRY
        let parametryTekst = "Brak parametrów";
        if (product.productParameters && Array.isArray(product.productParameters)) {
             parametryTekst = product.productParameters.map(p => {
                 const polName = p.parameterDescriptionsLangData?.find(l => l.langId === 'pol')?.parameterName || "Parametr";
                 const val = p.parameterValues?.[0]?.parameterValueDescriptionsLangData?.find(l => l.langId === 'pol')?.parameterValueName || "";
                 return `${polName}: ${val}`;
             }).join('\n');
        } else if (product.parametry) {
             parametryTekst = product.parametry;
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
        imgContainer.innerHTML = product.zdjeciaUrls.map(src => `<img src="${src}" style="height: 100px; border-radius: 5px; border: 1px solid #ddd;">`).join('');
    } else {
        imgContainer.innerHTML = '<p style="color: #888;">Brak zdjęć do wyświetlenia (Sprawdź endpoint w backendzie).</p>';
    }

    generateSEOContent(product);
}

async function generateSEOContent(product) {
    const editor = document.getElementById('new-description-editor');
    editor.innerHTML = "⏳ AI analizuje parametry i pisze opis (ok. 3000 znaków)...";

    // Wyciągamy kod modelu, np. "E253 k01" z oryginalnej nazwy
    const modelCodeMatch = product.nazwa.match(/([A-Z0-9]+\s*[a-z0-9]*)$/i);
    const modelCode = modelCodeMatch ? modelCodeMatch[0] : "WASSYL";

    const prompt = `
Jesteś copywriterem e-commerce dla polskiej marki modowej WASSYL.

DANE:
- Stara Nazwa: ${product.nazwa}
- Parametry: ${product.parametry}
- Stary Opis: ${product.opis}

WYTYCZNE NAZWY (BARDZO WAŻNE):
1. Podział na 2 części oddzielone myślnikiem: " – ". (np. Dopasowana sukienka mini w prążki – idealna na imprezę ${modelCode}).
2. ZAKAZ UŻYWANIA WIELKICH LITER NA POCZĄTKU KAŻDEGO SŁOWA. Użyj standardowej wielkości liter (np. "Czarna dopasowana sukienka...").
3. Na końcu musi zostać kod: ${modelCode}.

WYTYCZNE OPISU:
1. Długość: Ok. 3000 znaków (max 3200). Nie lej wody na 5000 znaków!
2. Język: Zrozumiały, dla Gen-Z, bez formalnego slangu i ZERO emoji. ZERO informacji o wariantach kolorystycznych.
3. Konstrukcja: Bierz fakty (np. materiał) z "Parametrów" i rozwijaj z nich lifestylowy opis (gdzie to ubrać: randka, uczelnia, praca).
4. HTML: Wyjustuj całość <div style="text-align: justify;">. Kluczowe info pogrubiaj <strong>.

ZWRÓĆ CZYSTY JSON (bez bloków markdownowych \`\`\`json):
{"name": "nazwa", "description": "html opisu"}
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

        document.getElementById('new-name-input').value = result.name || "";
        editor.innerHTML = result.description || "Błąd generowania.";
        updateCharCounter();
        editor.addEventListener('input', updateCharCounter);
        
    } catch (e) {
        editor.innerHTML = `<span style="color:red;">Błąd generowania AI. Odśwież i spróbuj ponownie.</span>`;
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
    generateSEOContent({ nazwa: origName, opis: "Generuj od nowa.", parametry: "Zachowaj parametry." });
}

// NOWA FUNKCJA WYSYŁKI DO IDOSELL
async function updateProductInIdosell() {
    const productId = document.getElementById('opt-product-id').value;
    const newName = document.getElementById('new-name-input').value;
    const newDesc = document.getElementById('new-description-editor').innerHTML;
    
    if (!confirm("Czy na pewno chcesz nadpisać dane tego produktu w sklepie IdoSell?")) return;

    const btn = document.getElementById('btn-prod-update');
    const origText = btn.innerText;
    btn.innerText = "⏳ Aktualizowanie w sklepie...";
    btn.disabled = true;

    try {
        // Tu podpinamy endpoint z Twojego backendu (przygotujemy go za moment)
        const res = await fetch('/api/idosell/update_product', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                id: productId, 
                name: newName, 
                long_description: newDesc 
            })
        });
        const data = await res.json();
        
        if (data.success) {
            alert("✅ Sukces! Produkt został zaktualizowany w IdoSell.");
        } else {
            alert("❌ Błąd z IdoSell: " + (data.error || "Nieznany błąd"));
        }
    } catch (e) {
        alert("❌ Błąd sieci: " + e.message);
    } finally {
        btn.innerText = origText;
        btn.disabled = false;
    }
}
