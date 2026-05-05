/**
 * CORE.JS - Główna logika aplikacji WASSYL AI
 */

const SHOP_CONTEXT = `
Jesteś głównym ekspertem ds. content marketingu i copywriterem dla polskiej marki modowej WASSYL.

GRUPA DOCELOWA I STYL KOMUNIKACJI:
- Grupa docelowa: Gen Z i Millenialsi.
- Styl: "edgy", na luzie, "vibe", jak dobra kumpela. Zawsze pisz lifestylowo (spacer z psem, kawa z przyjaciółkami, uczelnia, chill).
- ZAKAZANE SŁOWA: premium, luksus, bogactwo, ekskluzywny oraz nazwy miast/lokalizacji (np. Wrocław).

ASORTYMENT I KATEGORIE PRODUKTÓW:
- NAJWAŻNIEJSZA sprzedażowo kategoria: BLUZY (to absolutny core sprzedaży, traktuj je priorytetowo!).
- Kluczowe kategorie: bluzy dresowe, spodnie dresowe, bluzki, komplety, sukienki, spódnice.
- Mniej znaczące kategorie: stroje kąpielowe (1 i 2-częściowe), płaszcze, kombinezony.

SŁOWA KLUCZOWE DO WPLATAŃ W TEKSTACH:
- ubrania basic, bluzy oversize, spodnie baggy, ubrania z bawełny prążkowanej, ubrania z wiskozy, ubrania na co dzień.

Zawsze pisz w języku polskim, z naturalnymi potocznymi wtrąceniami, bez sztywnego, korporacyjnego języka.
`;

let scrapedContext = "";

// --- NAWIGACJA GŁÓWNA ---

function openModule(moduleName) {
    // Ukrywamy ekran startowy, pokazujemy aplikację
    document.getElementById('view-home').style.display = 'none';
    document.getElementById('view-app').style.display = 'flex';
    
    // 1. Resetujemy widoczność WSZYSTKICH modułów i sidebarów
    document.querySelectorAll('.module-sidebar').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.module-content').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none'; // Wymuszamy ukrycie wszystkich głównych okien
    });
    
    // 2. Aktywujemy TYLKO ten sidebar i moduł, który został kliknięty
    const activeSidebar = document.getElementById('sidebar-' + moduleName);
    const activeModule = document.getElementById('module-' + moduleName);
    
    if (activeSidebar) activeSidebar.style.display = 'block';
    if (activeModule) {
        activeModule.classList.add('active');
        activeModule.style.display = 'block'; // Wymuszamy pokazanie naszego okna!
    }
    // 3. Dodatkowe akcje przy otwieraniu konkretnych modułów (np. ustawienie domyślnej zakładki)
    if (moduleName === 'blog') {
        if (typeof switchTab === 'function') switchTab('tab1');
    } 
    else if (moduleName === 'social') {
        if (typeof switchSocialTab === 'function') switchSocialTab('sm-trend');
        console.log("Ładowanie modułu Social Media...");
        if (typeof initSocialDashboard === 'function') {
            initSocialDashboard();
        }
    } 
    else if (moduleName === 'products') {
        const prodInit = document.getElementById('prod-init');
        const prodEditor = document.getElementById('prod-editor');
        if (prodInit) prodInit.classList.add('active');
        if (prodEditor) prodEditor.classList.remove('active');
    }
    else if (moduleName === 'studio') {
        // Upewniamy się, że po wejściu w studio aktywna jest nasza nowa zakładka Flat Lay
        if (typeof switchStudioTab === 'function') switchStudioTab('studio-flatlay');
    }
}

function goHome() {
    document.getElementById('view-app').style.display = 'none';
    document.getElementById('view-home').style.display = 'flex';
}

function toggleMobileMenu() {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

// --- FORMATER TEKSTU ---

function formatMarkdown(text) {
    if (!text) return "";
    let html = text
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/^\- (.*$)/gim, '<li>$1</li>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        .replace(/\n/gim, '<br>');
    
    if (html.includes('<li>')) {
        html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>').replace(/<\/ul><ul>/gim, '');
    }
    return html;
}

// --- EKSPORT I NARZĘDZIA ---

async function exportToDrive(elementId, title, btnElement) {
    const content = document.getElementById(elementId).innerHTML;
    const originalText = btnElement.innerText;
    
    btnElement.innerText = "⏳ Zapisywanie...";
    btnElement.disabled = true;
    
    try {
        const res = await fetch('/api/export_drive', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ title, content })
        });
        const data = await res.json();
        
        if(data.url) {
            btnElement.style.background = "#28a745";
            btnElement.innerHTML = `✅ <a href="${data.url}" target="_blank" style="color:white;text-decoration:none">Otwórz Plik</a>`;
        } else {
            alert("Błąd: " + (data.error || "Nieznany błąd"));
            btnElement.innerText = originalText;
            btnElement.disabled = false;
        }
    } catch(e) {
        alert("Błąd sieci: " + e);
        btnElement.innerText = originalText;
        btnElement.disabled = false;
    }
}

async function fetchUrlContext() {
    const urlInput = document.getElementById('store-url');
    const statusLabel = document.getElementById('url-status');
    if(!urlInput || !urlInput.value) return;
    
    statusLabel.innerText = "⏳ Pobieram...";
    try {
        const res = await fetch('/api/fetch_url', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({url: urlInput.value})
        });
        const data = await res.json();
        if(data.text) {
            scrapedContext = "KONTEKST Z URL: " + data.text;
            statusLabel.innerText = "✅ Pobrano!";
        }
    } catch(e) {
        statusLabel.innerText = "❌ Błąd";
    }
}

async function getProductContextText(inputId) {
    const input = document.getElementById(inputId);
    if(!input || !input.value) return "";
    
    try {
        const resProd = await fetch('/api/idosell/products', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ids: input.value})
        });
        const dataProd = await resProd.json();
        if(dataProd.context) return "\nDANE PRODUKTÓW:\n" + dataProd.context;
    } catch(e) {
        console.error("Błąd IdoSell:", e);
    }
    return "";
}

// Inicjalizacja przycisków i UI po załadowaniu
document.addEventListener('DOMContentLoaded', () => {
    console.log("Wassyl Core Ready.");
});

// --- LOGIKA ZAKŁADEK DLA STUDIO ---
function switchStudioTab(tabId) {
    document.querySelectorAll('#module-studio .tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#sidebar-studio button').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    document.getElementById('btn-' + tabId).classList.add('active');
}

// --- GENEROWANIE OBRAZU FLAT LAY ---
async function generateFlatLay() {
    const fileInput = document.getElementById('studio-image-upload');
    const topDesc = document.getElementById('studio-top-desc').value;
    const bottomDesc = document.getElementById('studio-bottom-desc').value;
    const props = document.getElementById('studio-props').value;

    if (fileInput.files.length === 0) return alert("Wgraj zdjęcie źródłowe!");
    if (!topDesc) return alert("Opisz co najmniej górną część ubioru!");

    // Składamy dynamiczny prompt z Twojego wzoru
    let clothesDesc = `Góra: Dokładnie odwzorowana ${topDesc}. Należy wiernie odtworzyć jej fakturę materiału i kolor. Musi być rozłożona gładko, bez fałd, jak po prasowaniu.`;
    if (bottomDesc) {
        clothesDesc += `\nDół: Dokładnie odwzorowane ${bottomDesc}. Należy wiernie odtworzyć ich materiał i kolor. Rozłożone płasko, nogawki równoległe.`;
    }

    const dynamicPrompt = `Tytuł kompozycji: Profesjonalne zdjęcie Flat Lay (z góry) odzieży z załączonego obrazu na czystym, jasnym tle.
Szczegółowy opis kompozycji:
Tworzy to wysokiej rozdzielczości, profesjonalne zdjęcie typu Flat Lay (top-down view), przedstawiające dokładnie tę samą odzież, która znajduje się na modelce na zdjęciu źródłowym, rozłożoną na płasko w estetyczny sposób.
Kluczowa odzież:
${clothesDesc}
Wierność materiału i koloru:
Faktura materiału ubrań musi być niezwykle wierna i wyraźnie widoczna pod naturalnym oświetleniem. Kolory muszą być identyczne z kolorem na modelu.
Tło i Oświetlenie:
Czyste, bardzo jasne tło, np. lekko fakturowana, jasnokremowa (off-white) powierzchnia, całkowicie wolne od cieni i przedmiotów. Oświetlenie jest miękkie, rozproszone, naturalne światło dzienne.
Estetyczne ułożenie (Styl Pinteresta):
Zestaw jest ułożony centralnie w kadrze, z góry. Całość jest otoczona starannie dobranymi, minimalistycznymi rekwizytami:
${props}
Rekwizyty te są ułożone asymetrycznie, aby nadać kompozycji naturalny, profesjonalnie zaaranżowany wygląd.
Kadr i Ostrość:
Wysoka ostrość w całym kadrze, z wyraźnym widokiem wszystkich szczegółów tekstury odzieży i rekwizytów.`;

    const loader = document.getElementById('loader-studio');
    const resultContainer = document.getElementById('studio-result-container');
    const placeholderText = document.getElementById('studio-placeholder-text');
    const imgEl = document.getElementById('studio-result-img');
    const downloadBtn = document.getElementById('studio-download-btn');

    loader.style.display = 'block';
    resultContainer.style.display = 'none';
    placeholderText.style.display = 'none';

    // Przygotowujemy dane do wysłania (zdjęcie + prompt)
    const formData = new FormData();
    formData.append('image', fileInput.files[0]);
    formData.append('prompt', dynamicPrompt);

    try {
        // Tę końcówkę API zbudujemy w Pythonie w następnym kroku
        const res = await fetch('/api/generate_image', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success && data.image_url) {
            imgEl.src = data.image_url;
            downloadBtn.href = data.image_url;
            resultContainer.style.display = 'block';
        } else {
            alert("Błąd generowania obrazu: " + (data.error || "Nieznany błąd"));
            placeholderText.style.display = 'block';
        }
    } catch (e) {
        alert("Błąd połączenia z serwerem: " + e.message);
        placeholderText.style.display = 'block';
    } finally {
        loader.style.display = 'none';
    }
}
