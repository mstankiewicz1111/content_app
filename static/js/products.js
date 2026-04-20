/**
 * PRODUCTS.JS - Optymalizacja pod Google Discover
 */

async function loadProductToEdit() {
    const productId = document.getElementById('opt-product-id').value;
    if (!productId) return alert("Podaj ID!");

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

        if (!data.products || data.products.length === 0) throw new Error("Nie znaleziono produktu.");

        const product = data.products[0];
        loader.style.display = 'none';
        statusBox.style.display = 'block';

        // Raport z pobierania
        const check = (val) => val ? "✅" : "❌";
        statusList.innerHTML = `
            <li>${check(product.nazwa)} Nazwa towaru</li>
            <li>${check(product.opis)} Opis długi</li>
            <li>${check(product.parametry)} Parametry techniczne</li>
            <li>${check(product.zdjecia && product.zdjecia.length)} Zdjęcia (${product.zdjecia.length})</li>
        `;

        // Przejście do edytora po 1.5s
        setTimeout(() => {
            showProductEditor(product);
        }, 1500);

    } catch (e) {
        loader.style.display = 'none';
        alert("Błąd: " + e.message);
    }
}

function showProductEditor(product) {
    document.getElementById('prod-init').classList.remove('active');
    document.getElementById('prod-editor').classList.add('active');

    document.getElementById('orig-name').innerText = product.nazwa;
    
    // Zdjęcia
    const imgContainer = document.getElementById('prod-images-preview');
    imgContainer.innerHTML = product.zdjecia.map(src => `<img src="${src}" style="height: 100px; border-radius: 5px; border: 1px solid #ddd;">`).join('');

    // Automatyczne generowanie pierwszej propozycji
    generateSEOContent(product);
}

async function generateSEOContent(product) {
    const editor = document.getElementById('new-description-editor');
    editor.innerHTML = "⏳ AI generuje opis zgodny z Google Discover (min. 3000 znaków)...";

    const prompt = `
        Zadanie: Optymalizacja SEO produktu pod Google Discover.
        DANE PRODUKTU:
        Nazwa: ${product.nazwa}
        Parametry: ${product.parametry}
        Aktualny opis: ${product.opis}

        WYTYCZNE DLA OPISU:
        1. Język: Styl Wassyl (edgy, lifestylowy, "vibe").
        2. Długość: Minimum 3000 znaków.
        3. Zakaz: Pisania o kolorach, używania emoji.
        4. Treść: Opieraj się na faktach (skład materiału, krój). Opisz konteksty użycia (randka, spacer, kawa, praca).
        5. Formatowanie HTML: tekst wyjustowany <div style="text-align: justify;">, kluczowe frazy pogrubione <strong>.
        
        WYTYCZNE DLA NAZWY:
        Stwórz nazwę dwuczęściową z długim myślnikiem " — ". 
        Część 1: SEO-friendly opis. Część 2: lifestylowy benefit + kod modelu na końcu.
        Kod modelu do zachowania: (wyciągnij z oryginalnej nazwy: ${product.nazwa}).

        Zwróć JSON: {"name": "nowa nazwa", "description": "opis html"}
    `;

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt: prompt, json_mode: true })
        });
        const data = await res.json();
        const result = JSON.parse(data.result);

        document.getElementById('new-name-input').value = result.name;
        editor.innerHTML = result.description;
        updateCharCounter();
    } catch (e) {
        editor.innerHTML = "Błąd generowania. Spróbuj ponownie.";
    }
}

function updateCharCounter() {
    const text = document.getElementById('new-description-editor').innerText;
    const counter = document.getElementById('prod-char-counter');
    counter.innerText = text.length + " znaków";
    counter.className = text.length >= 3000 ? "counter-badge counter-good" : "counter-badge counter-warn";
}
