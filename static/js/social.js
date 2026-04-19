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
    console.log("LOG: Próba inicjalizacji dashboardu...");
    const container = document.getElementById('social-dashboard');
    if (!container) return;

    container.innerHTML = `<div style="text-align:center; padding:20px;">🚀 Ładowanie planu na dziś...</div>`;

    try {
        const [eventRes, aiInspo] = await Promise.all([
            fetch('/api/get_upcoming_events').then(r => r.json()),
            fetch('/api/generate', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({prompt: "Podaj 1 krótką inspirację na dziś dla marki odzieżowej Wassyl.", search: false})
            }).then(r => r.json())
        ]);

        const eventsHtml = eventRes.events.map(ev => `
            <div class="event-card" style="background:#fff; padding:10px; border-left:4px solid #000; margin-bottom:5px;">
                <strong>${ev.date}</strong> - ${ev.name}
            </div>`).join('');

        container.innerHTML = `
            <div class="dashboard-wrapper" style="background:#f9f9f9; padding:20px; border-radius:15px; margin-top:20px; border: 1px solid #eee;">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                    <div>
                        <h3 style="margin-top:0;">📅 Nadchodzące okazje</h3>
                        ${eventsHtml}
                    </div>
                    <div>
                        <h3 style="margin-top:0;">💡 Pomysł na dziś</h3>
                        <div style="font-size:0.9rem;">${typeof formatMarkdown === 'function' ? formatMarkdown(aiInspo.result) : aiInspo.result}</div>
                    </div>
                </div>
            </div>`;
        console.log("LOG: Dashboard gotowy!");
    } catch (e) {
        container.innerHTML = "<p>Błąd dashboardu. Sprawdź połączenie.</p>";
        console.error(e);
    }
}

// DOPISZ RESZTĘ FUNKCJI (TYLKO RAZ!)
async function analyzeTrends() { /* Twój kod analyzeTrends */ }
async function generateHooks() { /* Twój kod generateHooks */ }
async function generateScript() { /* Twój kod generateScript */ }
