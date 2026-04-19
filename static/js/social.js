function switchSocialTab(tabId) { 
    document.querySelectorAll('#module-social .tab-content').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('#sidebar-social button').forEach(el => el.classList.remove('active')); 
    document.getElementById(tabId).classList.add('active'); 
    document.getElementById('btn-' + tabId).classList.add('active'); 
    if(window.innerWidth <= 768) toggleMobileMenu(); 

    // Automatyczne odświeżenie dashboardu przy wejściu w główną zakładkę social media
    if(tabId === 'social-home' || tabId === 'tab-social-home') {
        initSocialDashboard();
    }
}

// --- FUNKCJE GENERUJĄCE ---

async function analyzeTrends() {
    const resBox = document.getElementById('trend-result'); 
    document.getElementById('loader-trend').style.display = 'block'; 
    document.getElementById('trend-wrapper').style.display = 'none';
    
    const prompt = `Twoje zadanie to przeprowadzić research na żywo (Google Search). Znajdź aktualne trendy modowe i ubraniowe na TikToku. 1. Wymień 3 najgorętsze trendy. 2. 🔗 PRZYKŁADY: Do każdego dodaj link do wideo/hashtagu. 3. WDROŻENIE WASSYL: Napisz jak możemy to wykorzystać w rolkach. Markdown.`;
    
    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt, search: true}) });
        const data = await res.json(); 
        document.getElementById('loader-trend').style.display = 'none'; 
        resBox.innerHTML = formatMarkdown(data.result); 
        document.getElementById('trend-wrapper').style.display = 'block';
    } catch(e) { 
        document.getElementById('loader-trend').style.display = 'none'; 
    }
}

async function generateHooks() {
    const topic = document.getElementById('hook-topic').value; 
    if(!topic && !document.getElementById('hook-product-ids').value) { alert("Podaj temat!"); return; }
    
    const resBox = document.getElementById('hooks-result'); 
    document.getElementById('loader-hooks').style.display = 'block'; 
    document.getElementById('hooks-wrapper').style.display = 'none';
    
    const extraProductData = await getProductContextText('hook-product-ids');
    const prompt = `${SHOP_CONTEXT}\nWygeneruj 10 viralowych hooków na TikTok/Reels o: "${topic}". ${extraProductData}\nPodziel hooki na 3 kategorie: 1. Negatywne 2. Tajemnica 3. Ból/Rozwiązanie. Markdown.`;
    
    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) });
        const data = await res.json(); 
        document.getElementById('loader-hooks').style.display = 'none'; 
        resBox.innerHTML = formatMarkdown(data.result); 
        document.getElementById('hooks-wrapper').style.display = 'block';
    } catch(e) { 
        document.getElementById('loader-hooks').style.display = 'none'; 
    }
}

async function generateScript() {
    const topic = document.getElementById('script-topic').value; 
    const dur = document.getElementById('script-duration').value; 
    if(!topic) { alert("Podaj temat wideo!"); return; }
    
    const resBox = document.getElementById('script-result'); 
    document.getElementById('loader-script').style.display = 'block'; 
    document.getElementById('script-wrapper').style.display = 'none';
    
    const extraProductData = await getProductContextText('script-product-ids');
    const prompt = `${SHOP_CONTEXT}\nStwórz gotowy, reżyserski scenariusz wideo na TikTok. Czas: ${dur} Temat: "${topic}" ${extraProductData}\nWYTYCZNE: 1. Lista: **[SEKUNDY]** | **WIZJA:** | **FONIA:**. 2. Mocny Hook. 3. Opis posta z wezwaniem do akcji (CTA) i hashtagami. Markdown.`;
    
    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) });
        const data = await res.json(); 
        document.getElementById('loader-script').style.display = 'none'; 
        resBox.innerHTML = formatMarkdown(data.result); 
        document.getElementById('script-wrapper').style.display = 'block';
    } catch(e) { 
        document.getElementById('loader-script').style.display = 'none'; 
    }
}

function repurposeFromBlog() {
    const blogText = document.getElementById('article-result').innerText; 
    if(!blogText || blogText.length < 50) { alert("Najpierw stwórz artykuł!"); return; }
    
    document.getElementById('script-topic').value = "Recykling na podstawie artykułu. BAZA WIEDZY: \n" + blogText.substring(0, 500) + "..."; 
    generateScript();
}

// --- DASHBOARD INSPIRACJI ---

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

        const fullContext = contents.map(c => c.text).join("\n\n---\n\n");

        const aiRes = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                prompt: `Oto najnowsze doniesienia o trendach z portali branżowych:\n${fullContext}\n\nNa ich podstawie wybierz 2 konkretne trendy pasujące do WASSYL. Zaproponuj opis i pomysł na post. Markdown.`,
                search: false
            })
        });
        const data = await aiRes.json();
        return data.result;
    } catch (e) {
        return "Nie udało się pobrać danych z portali zewnętrznych.";
    }
}

async function initSocialDashboard() {
    const dashboardContainer = document.getElementById('social-dashboard');
    if (!dashboardContainer) return;

    dashboardContainer.innerHTML = `
        <div style="text-align:center; padding: 30px;">
            <p>🚀 Agreguję inspiracje z kalendarza, TikToka i blogów branżowych...</p>
        </div>`;

    try {
        // Pobieramy wszystko równolegle (4 źródła)
        const [eventRes, aiInspoRes, tiktokTrendRes, externalInspoText] = await Promise.all([
            fetch('/api/get_upcoming_events').then(r => r.json()),
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
                    prompt: "Znajdź 1 gorący trend modowy na TikToku z ostatnich 48h i napisz jak Wassyl może go wykorzystać.",
                    search: true
                })
            }).then(r => r.json()),
            getExternalInspirations() // Nasza nowa funkcja
        ]);

        dashboardContainer.innerHTML = `
            <div class="dashboard-wrapper">
                <div class="dashboard-block">
                    <h3>📅 Nadchodzące Okazje</h3>
                    <div class="event-grid">
                        ${eventRes.events.length > 0 
                            ? eventRes.events.map(ev => `<div class="event-card"><strong>${ev.date}</strong><br>${ev.name}</div>`).join('')
                            : '<p>Brak wydarzeń w najbliższych dniach.</p>'}
                    </div>
                </div>

                <div class="dashboard-block">
                    <h3>💡 Szybka Inspiracja</h3>
                    <div class="ai-content">${formatMarkdown(aiInspoRes.result)}</div>
                </div>

                <div class="dashboard-block trend-live">
                    <h3>🔥 TikTok Trend (Live)</h3>
                    <div class="trend-content">${formatMarkdown(tiktokTrendRes.result)}</div>
                </div>

                <div class="dashboard-block external-trends">
                    <h3>🌐 Z blogów branżowych</h3>
                    <div class="ai-content">${formatMarkdown(externalInspoText)}</div>
                </div>
            </div>
        `;
    } catch (e) {
        console.error(e);
        dashboardContainer.innerHTML = '<p>Błąd ładowania dashboardu.</p>';
    }
}
