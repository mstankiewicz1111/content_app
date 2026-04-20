/**
 * PRODUCTS.JS - Optymalizacja pod Google Discover (Wersja z obsługą natywnego payloadu IdoSell)
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
    if (!productId) {
        alert("Podaj ID produktu!");
        return;
    }

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

        // Jeśli backend po prostu przepuszcza strukturę z IdoSell (co widać po Twoim payloadzie)
        let product;
        if (data.results && data.results.length > 0) {
             // Struktura bezpośrednia z requesta, który przesłałeś
            product = data.results[0]; 
        } else if (data.products && data.products.length > 0) {
            // Starsza wersja struktury backendu
            product = data.products[0];
        } else {
             throw new Error("API IdoSell nie zwróciło żadnego produktu o tym ID.");
        }

        // --- MAPOWANIE DANYCH Z PAYLOADU IDOSELL --- //
        
        // 1. Nazwa i opis (szukamy polskiego języka)
        let nazwa = "Brak nazwy";
        let opisDlugi = "Brak opisu";
        
        if (product.productDescriptionsLangData) {
            const polData = product.productDescriptionsLangData.find(d => d.langId === 'pol');
            if (polData) {
                nazwa = polData.productName || polData.productName;
                opisDlugi = polData.productLongDescription || polData.productDescription;
            }
        } else if (product.nazwa) { // Fallback, jeśli Twój backend to formatuje
            nazwa = product.nazwa;
            opisDlugi = product.opis;
        }

        // 2. Zdjęcia
        let zdjeciaUrls = [];
        if (product.productImages && Array.isArray(product.productImages)) {
            // Wyciągamy małe obrazki (są lżejsze do ładowania w podglądzie)
            zdjeciaUrls = product.productImages.map(img => img.productImageSmallUrl || img.productImageLargeUrl);
        } else if (product.zdjecia && Array.isArray(product.zdjecia)) {
             // Fallback
             zdjeciaUrls = product.zdjecia;
        }
        
        // 3. Parametry
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

        // Normalizowany obiekt do dalszej pracy
        const normalizedProduct = {
            nazwa: nazwa,
            opis: opisDlugi,
            parametry: parametryTekst,
            zdjeciaUrls: zdjeciaUrls
        };

        loader.style.display = 'none';
        statusBox.style.display = 'block';

        const check = (val) => val ? "✅" : "❌";
        statusList.innerHTML = `
            <li>${check(normalizedProduct.nazwa !== "Brak nazwy")} Nazwa towaru</li>
            <li>${check(normalizedProduct.opis !== "Brak opisu")} Opis długi</li>
            <li>${check(normalizedProduct.parametry !== "Brak parametrów")} Parametry techniczne</li>
            <li>${check(normalizedProduct.zdjeciaUrls.length > 0)} Zdjęcia (${normalizedProduct.zdjeciaUrls.length})</li>
        `;

        setTimeout(() => {
            showProductEditor(normalizedProduct);
        }, 1500);

    } catch (e) {
        loader.style.display = 'none';
        alert("Błąd połączenia: " + e.message);
        console.error("Szczegóły błędu:", e);
    }
}

function showProductEditor(product) {
    switchProdTab('prod-editor');

    document.getElementById('orig-name').innerText = product.nazwa;
    
    // Renderowanie zdjęć z URL-i wyciągniętych z payloadu
    const imgContainer = document.getElementById('prod-images-preview');
    if (product.zdjeciaUrls && product.zdjeciaUrls.length > 0) {
        imgContainer.innerHTML = product.zdjeciaUrls.map(src => `<img src="${src}" style="height: 100px; border-radius: 5px; border: 1px solid #ddd; object-fit: cover;">`).join('');
    } else {
        imgContainer.innerHTML = '<p style="color: #888; font-size: 13px; font-style: italic;">Brak zdjęć dla tego produktu.</p>';
    }

    generateSEOContent(product);
}

async function generateSEOContent(product) {
    const editor = document.getElementById('new-description-editor');
    editor.innerHTML = "⏳ AI analizuje dane i generuje opis zgodny z Google Discover (min. 3000 znaków)...";

    const safeDesc = product.opis || "Brak aktualnego opisu.";
    const safeParams = product.parametry || "Brak parametrów.";

    const prompt = `
Zadanie: Optymalizacja SEO produktu modowego pod usługę Google Discover.

DANE PRODUKTU BAZOWEGO:
- Obecna Nazwa: ${product.nazwa}
- Parametry: ${safeParams}
- Obecny Opis: ${safeDesc}

WYTYCZNE DLA NOWEJ NAZWY TOWARU:
- Musi być podzielona na 2 części za pomocą tzw. długiego myślnika " – ".
- Przykład formatu: [SEO-friendly nazwa i cechy] – [Lifestylowy benefit/Opis vibes + kod modelu].
- Na samym końcu nazwy MUSI pozostać oznaczenie modelu z oryginalnej nazwy (zazwyczaj kod na końcu, np. X672 / X1).

WYTYCZNE DLA NOWEGO OPISU (KRYTYCZNE):
1. Język i Styl: Piszemy do Gen Z i Millenialsów ("edgy", na luzie, "girl next door vibe").
2. Długość: Bezwzględnie minimum 3000 znaków (jest to wymóg SEO).
3. Zakazy: ZERO informacji o wariantach kolorystycznych, ZERO emoji.
4. Merytoryka: Unikaj lania wody. Opieraj się na faktach (skład, krój) wyciągniętych z parametrów. Odnoś się do funkcji ubrania w różnych sytuacjach lifestylowych (spacer z psem, randka, szybka kawa, praca).
5. Formatowanie HTML: 
   - Całość musi być wyjustowana: użyj <div style="text-align: justify;"> na początku i zamknij na końcu.
   - Używaj pogrubień <strong> do zaznaczania najważniejszych cech materiału lub kroju.

Zwróć odpowiedź w czystym formacie JSON:
{"name": "tutaj nowa nazwa", "description": "tutaj gotowy kod HTML opisu"}
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
        editor.innerHTML = result.description || "Nie udało się wygenerować opisu.";
        updateCharCounter();
        
        editor.addEventListener('input', updateCharCounter);
        
    } catch (e) {
        editor.innerHTML = `<span style="color:red;">Wystąpił błąd podczas generowania. Sprawdź format JSON z AI.</span>`;
        console.error("Błąd AI:", e);
    }
}

function updateCharCounter() {
    const editor = document.getElementById('new-description-editor');
    if(!editor) return;
    
    const textLength = editor.innerText.length;
    const counter = document.getElementById('prod-char-counter');
    
    counter.innerText = textLength + " znaków";
    counter.className = textLength >= 3000 ? "counter-badge counter-good" : "counter-badge counter-warn";
}

function refreshProductSEO() {
    const origName = document.getElementById('orig-name').innerText;
    generateSEOContent({
        nazwa: origName,
        opis: "Skup się na poprawie poprzedniego wyniku, zrób go dłuższym i bardziej lifestylowym. Zachowaj min. 3000 znaków.",
        parametry: "Uwzględnij parametry, by opis był rzetelny."
    });
}

function copyToClipboard(elementId) {
    const el = document.getElementById(elementId);
    const html = el.innerHTML;
    navigator.clipboard.writeText(html).then(() => {
        alert("Kod HTML opisu został skopiowany do schowka!");
    });
}
