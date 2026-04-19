/**
 * SOCIAL.JS - WASSYL CONTENT INTELLIGENCE
 */

// 1. Logika przełączania zakładek wewnątrz modułu
function switchSocialTab(tabId) { 
    document.querySelectorAll('#module-social .tab-content').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('#sidebar-social button').forEach(el => el.classList.remove('active')); 
    
    const targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.add('active'); 
    
    const targetBtn = document.getElementById('btn-' + tabId);
    if(targetBtn) targetBtn.classList.add('active'); 

    if(window.innerWidth <= 768 && typeof toggleMobileMenu === 'function') toggleMobileMenu(); 
}

// 2. Funkcja pomocnicza do bezpiecznego renderowania Markdown
function safeMarkdown(text) {
    if (typeof formatMarkdown === 'function') return formatMarkdown(text);
    return text; // Fallback jeśli core.js jeszcze nie gotowy
}

// 3. Pobieranie danych z zewnętrznych portali
async function getExternalInspirations() {
    const urls = [
        "https://www.ramd.am/blog/trends-instagram",
        "https://www.ramd.am/blog/trends-tiktok",
        "https://later.com/blog/tiktok-trends/"
    ];
    try {
        const contents = await Promise.all(urls.map(url => 
            fetch('/api/fetch_url', {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ url: url })
            }).then(res => res.json()).catch(() => ({text: ""}))
        ));
        const fullContext = contents.map(c => c.text).filter(t => t).join("\n\n").substring(0, 3000);
        
        const aiRes = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                prompt: `Na podstawie trendów: ${fullContext} wybierz 2 dla marki WASSYL.`,
                search: false
            })
        });
        const data = await aiRes.json();
        return data.result || "Brak danych.";
    } catch (e) { return "Nie udało się pobrać danych z blogów."; }
}

// 4. GŁÓWNA FUNKCJA DASHBOARDU
async function initSocialDashboard() {
    const container = document.getElementById('social-dashboard');
    if (!container) return;

    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:30px; background:#f0f0f0; border-radius:15px;">
        <p>🚀 Generuję inspiracje na dzisiaj (${new Date().toLocaleDateString()})...</p>
    </div>`;

    try {
        const [eventRes, aiInspo, tiktokTrend, externalInspo] = await Promise.all([
            fetch('/api/get_upcoming_events').then(r => r.json()),
            fetch('/api/generate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({prompt: "Krótka inspiracja modowa na dziś dla marki Wassyl (1-2 zdania).", search: false})
            }).then(r => r.json()),
            fetch('/api/generate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({prompt: "Jaki jest teraz trend na TikTok fashion?", search: true})
            }).then(r => r.json()),
            getExternalInspirations()
        ]);

        // Renderowanie kalendarza [cite: 1, 2, 3, 4]
        const eventsHtml = eventRes.events && eventRes.events.length > 0 
            ? eventRes.events.map(ev => `<div class="event-card"><strong>${ev.date}</strong><br>${ev.name}</div>`).join('')
            : '<p>Brak wydarzeń w najbliższych dniach.</p>';

        container.innerHTML = `
            <div class="dashboard-wrapper">
                <div class="dashboard-block events-block">
                    <h3>📅 Kalendarz Marketingowy</h3>
                    <div class="event-grid">${eventsHtml}</div>
                </div>
                <div class="dashboard-block">
                    <h3>💡 Szybka Inspiracja</h3>
                    <div class="ai-content">${safeMarkdown(aiInspo.result)}</div>
                </div>
                <div class="dashboard-block trend-live">
                    <h3>🔥 TikTok Trend (Live)</h3>
                    <div class="trend-content">${safeMarkdown(tiktokTrend.result)}</div>
                </div>
                <div class="dashboard-block external-trends">
                    <h3>🌐 Z blogów branżowych</h3>
                    <div class="ai-content">${safeMarkdown(externalInspo)}</div>
                </div>
            </div>
        `;
    } catch (e) { 
        console.error("Dashboard error:", e);
        container.innerHTML = "<p>Błąd ładowania dashboardu. Sprawdź konsolę.</p>";
    }
}

// Pozostałe funkcje modułu
async function analyzeTrends() { /* Twój oryginalny kod analyzeTrends */ }
async function generateHooks() { /* Twój oryginalny kod generateHooks */ }
async function generateScript() { /* Twój oryginalny kod generateScript */ }
function repurposeFromBlog() { /* Twój oryginalny kod repurposeFromBlog */ }
