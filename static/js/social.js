// social.js - CZYSZCZENIE TOTALNE

function switchSocialTab(tabId) { 
    document.querySelectorAll('#module-social .tab-content').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('#sidebar-social button').forEach(el => el.classList.remove('active')); 
    const targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.add('active'); 
    const targetBtn = document.getElementById('btn-' + tabId);
    if(targetBtn) targetBtn.classList.add('active'); 
    if(window.innerWidth <= 768 && typeof toggleMobileMenu === 'function') toggleMobileMenu(); 
}

async function initSocialDashboard() {
    const container = document.getElementById('social-dashboard');
    if (!container) return;

    // Wymuszamy widoczność kontenera i dodajemy loader
    container.style.display = "block";
    container.innerHTML = `
        <div style="padding: 20px; background: #f8f9fa; border-radius: 10px; border: 1px solid #ddd; text-align: center; margin-top: 20px;">
            <p style="margin: 0; font-weight: bold;">⏳ Generuję Twój plan na dziś...</p>
            <small style="color: #666;">(Pobieram trendy live i kalendarz 2026)</small>
        </div>`;

    try {
        // Pobieramy dane
        const eventRes = await fetch('/api/get_upcoming_events').then(r => r.json());
        
        // Generujemy inspirację i trendy równolegle
        const [aiInspoRes, tiktokTrendRes] = await Promise.all([
            fetch('/api/generate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    prompt: "Jesteś ekspertem social media Wassyl. Podaj 1 kreatywny pomysł na post na dziś (max 3 zdania).",
                    search: false
                })
            }).then(r => r.json()),
            fetch('/api/generate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    prompt: "Znajdź 1 gorący trend modowy na TikToku z ostatnich 48h.",
                    search: true
                })
            }).then(r => r.json())
        ]);

        const eventsHtml = eventRes.events && eventRes.events.length > 0 
            ? eventRes.events.map(ev => `<div class="event-card"><strong>${ev.date}</strong><br>${ev.name}</div>`).join('')
            : '<p>Brak wydarzeń w najbliższych dniach.</p>';

        const safeMd = (text) => typeof formatMarkdown === 'function' ? formatMarkdown(text) : text;

        // FINALNE RENDEROWANIE
        container.innerHTML = `
            <div class="dashboard-wrapper">
                <div class="dashboard-block">
                    <h3>📅 Nadchodzące Okazje</h3>
                    <div class="event-grid">${eventsHtml}</div>
                </div>
                <div class="dashboard-block">
                    <h3>💡 Szybka Inspiracja</h3>
                    <div class="ai-content">${safeMd(aiInspoRes.result)}</div>
                </div>
                <div class="dashboard-block trend-live">
                    <h3>🔥 TikTok Trend</h3>
                    <div class="trend-content">${safeMd(tiktokTrendRes.result)}</div>
                </div>
            </div>
        `;
        console.log("✅ Dashboard wyrenderowany!");
    } catch (e) {
        console.error("❌ Błąd Dashboardu:", e);
        container.innerHTML = `<div style="color: red; padding: 20px;">Nie udało się załadować inspiracji: ${e.message}</div>`;
    }
}

// DOPISZ RESZTĘ FUNKCJI (TYLKO RAZ!)
async function analyzeTrends() { /* Twój kod analyzeTrends */ }
async function generateHooks() { /* Twój kod generateHooks */ }
async function generateScript() { /* Twój kod generateScript */ }
