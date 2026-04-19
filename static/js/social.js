/**
 * SOCIAL.JS - Poprawiona wersja stabilna
 */

function switchSocialTab(tabId) { 
    document.querySelectorAll('#module-social .tab-content').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('#sidebar-social button').forEach(el => el.classList.remove('active')); 
    
    const targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.add('active'); 
    
    const targetBtn = document.getElementById('btn-' + tabId);
    if(targetBtn) targetBtn.classList.add('active'); 

    if(window.innerWidth <= 768 && typeof toggleMobileMenu === 'function') toggleMobileMenu(); 
}

async function analyzeTrends() {
    const resBox = document.getElementById('trend-result'); 
    const loader = document.getElementById('loader-trend');
    if(loader) loader.style.display = 'block'; 
    
    try {
        const res = await fetch('/api/generate', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({prompt: "Znajdź trendy modowe na TikTok. Markdown.", search: true}) 
        });
        const data = await res.json(); 
        if(loader) loader.style.display = 'none'; 
        resBox.innerHTML = formatMarkdown(data.result); 
        document.getElementById('trend-wrapper').style.display = 'block';
    } catch(e) { if(loader) loader.style.display = 'none'; }
}

async function generateHooks() {
    const topic = document.getElementById('hook-topic').value; 
    const resBox = document.getElementById('hooks-result'); 
    const loader = document.getElementById('loader-hooks');
    if(loader) loader.style.display = 'block'; 
    
    try {
        const res = await fetch('/api/generate', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({prompt: `Wygeneruj hooki dla: ${topic}`}) 
        });
        const data = await res.json(); 
        if(loader) loader.style.display = 'none'; 
        resBox.innerHTML = formatMarkdown(data.result); 
        document.getElementById('hooks-wrapper').style.display = 'block';
    } catch(e) { if(loader) loader.style.display = 'none'; }
}

async function generateScript() {
    const topic = document.getElementById('script-topic').value; 
    const resBox = document.getElementById('script-result'); 
    const loader = document.getElementById('loader-script');
    if(loader) loader.style.display = 'block'; 
    
    try {
        const res = await fetch('/api/generate', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({prompt: `Stwórz scenariusz o: ${topic}`}) 
        });
        const data = await res.json(); 
        if(loader) loader.style.display = 'none'; 
        resBox.innerHTML = formatMarkdown(data.result); 
        document.getElementById('script-wrapper').style.display = 'block';
    } catch(e) { if(loader) loader.style.display = 'none'; }
}

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
            }).then(res => res.json())
        ));
        const fullContext = contents.map(c => c.text).join("\n\n");
        const aiRes = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                prompt: `Na podstawie tych trendów: ${fullContext.substring(0,2000)} wybierz 2 dla marki WASSYL.`,
                search: false
            })
        });
        const data = await aiRes.json();
        return data.result;
    } catch (e) { return "Błąd pobierania trendów z blogów."; }
}

async function initSocialDashboard() {
    const container = document.getElementById('social-dashboard');
    if (!container) return;

    container.innerHTML = `<p style="text-align:center; padding:20px;">🚀 Pobieram plan na dziś (19.04.2026)...</p>`;

    try {
        const [eventRes, aiInspo, tiktokTrend, externalInspo] = await Promise.all([
            fetch('/api/get_upcoming_events').then(r => r.json()),
            fetch('/api/generate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({prompt: "Podaj krótki pomysł na post modowy na dziś.", search: false})
            }).then(r => r.json()),
            fetch('/api/generate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({prompt: "Znajdź trend modowy na TikTok.", search: true})
            }).then(r => r.json()),
            getExternalInspirations()
        ]);

        container.innerHTML = `
            <div class="dashboard-wrapper">
                <div class="dashboard-block events-block">
                    <h3>📅 Kalendarz Marketingowy</h3>
                    <div class="event-grid">
                        ${eventRes.events.length > 0 
                            ? eventRes.events.map(ev => `<div class="event-card"><strong>${ev.date}</strong><br>${ev.name}</div>`).join('')
                            : '<p>Brak wydarzeń na dziś.</p>'}
                    </div>
                </div>
                <div class="dashboard-block">
                    <h3>💡 Inspiracja AI</h3>
                    <div>${formatMarkdown(aiInspo.result)}</div>
                </div>
                <div class="dashboard-block trend-live">
                    <h3>🔥 TikTok Trend</h3>
                    <div>${formatMarkdown(tiktokTrend.result)}</div>
                </div>
                <div class="dashboard-block external-trends">
                    <h3>🌐 Z blogów</h3>
                    <div>${formatMarkdown(externalInspo)}</div>
                </div>
            </div>
        `;
    } catch (e) { 
        container.innerHTML = "<p>Błąd ładowania dashboardu.</p>";
        console.error(e);
    }
}
