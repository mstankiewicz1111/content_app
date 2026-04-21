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

    const prompt = `
Zadanie: Optymalizacja SEO odzieży e-commerce dla polskiej marki Wassyl.

DANE BAZOWE:
- Stara Nazwa: ${product.nazwa}
- Parametry: ${product.parametry}

WYTYCZNE NAZWY:
1. Podział na 2 części długim myślnikiem " – ".
2. ZAKAZ Title Case. Zdanie zaczyna się od wielkiej litery, reszta słów małymi literami.
3. ZAKAZ kropki na końcu nazwy. (Dobre: "Czarna bluza oversize – idealna na spacer X672 / X1")
4. Na końcu MUSI pozostać pełne oznaczenie modelu ze Starej Nazwy (absolutnie nie pomijaj końcówek takich jak k01, / X1 itp.). Szukaj kodu w tych słowach: "${suggestedCode}".

WYTYCZNE OPISU HTML:
1. DŁUGOŚĆ: Max 3000 znaków. Pisz treściwie.
2. STYL: Lifestylowy vibe Wassyl. ZAKAZ EMOJI. ZAKAZ kolorów.
3. ZAKAZ ROZMIARÓW: W opisie nie wolno wspominać o rozmiarach (np. "modelka nosi S" albo "dostępna w rozmiarze mini"). Informacje z parametrów o rozmiarach zignoruj w tekście.
4. PRODUKCJA: OBOWIĄZKOWO wpleć do każdego opisu informację, że ubranie jest szyte w Polsce, w Waszej własnej szwalni (brzmienie naturalne).
5. MERYTORYKA: Opieraj się na analizie załączonego zdjęcia oraz składzie/kroju z Parametrów.
6. FORMAT HTML: Wyjustuj <div style="text-align: justify;">. Używaj <strong> dla kluczowych atutów.

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

        document.getElementById('new-name-input').value = result.name || "";
        editor.innerHTML = result.description || "Błąd generowania.";
        updateCharCounter();
        editor.addEventListener('input', updateCharCounter);
        
    } catch (e) {
        editor.innerHTML = `<span style="color:red;">Błąd generowania AI: ${e.message}</span>`;
    }
}

// REWIZJA AI (Również zaktualizowana o nowe wytyczne)
async function reviseProductSEO(customInstruction = null) {
    const editor = document.getElementById('new-description-editor');
    const nameInput = document.getElementById('new-name-input');
    const instruction = customInstruction || document.getElementById('prod-revision-input').value;
    
    if (!instruction) return alert("Wpisz uwagi do poprawy!");
    
    const currentDesc = editor.innerHTML;
    const currentName = nameInput.value;
    const origText = editor.innerHTML;
    
    editor.innerHTML = "⏳ AI nanosi Twoje poprawki...";
    
    const prompt = `
    Zadanie: Skoryguj nazwę i opis produktu modowego wg zaleceń użytkownika.
    
    OBECNA NAZWA: ${currentName}
    OBECNY OPIS HTML: ${currentDesc}
    
    INSTRUKCJA OD UŻYTKOWNIKA:
    "${instruction}"
    
    WYTYCZNE (ZACHOWAJ BEZWZGLĘDNIE):
    1. Zwróć JSON: {"name": "...", "description": "..."}
    2. Opis musi pozostać w formacie wyjustowanego HTML z pogrubieniami <strong>.
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
