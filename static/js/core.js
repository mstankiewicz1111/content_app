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

function openModule(module) {
    // Ukrywamy ekran startowy, pokazujemy aplikację
    document.getElementById('view-home').style.display = 'none';
    document.getElementById('view-app').style.display = 'flex';
    
    // Resetujemy widoczność modułów i sidebarów
    document.querySelectorAll('.module-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.module-sidebar').forEach(el => el.style.display = 'none');
    
    if(module === 'blog') {
        document.getElementById('module-blog').classList.add('active');
        document.getElementById('sidebar-blog').style.display = 'block';
        if (typeof switchTab === 'function') switchTab('tab1');
    } 
    else if(module === 'social') {
        document.getElementById('module-social').classList.add('active');
        document.getElementById('sidebar-social').style.display = 'block';
        if (typeof switchSocialTab === 'function') switchSocialTab('sm-trend');
        
        // WYWOŁANIE DASHBOARDU: To kluczowy moment dla widoczności bloków
        console.log("Ładowanie modułu Social Media...");
        if (typeof initSocialDashboard === 'function') {
            initSocialDashboard();
        }
    } 
    else if(module === 'chat') {
        document.getElementById('module-chat').classList.add('active');
        document.getElementById('sidebar-chat').style.display = 'block';
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
