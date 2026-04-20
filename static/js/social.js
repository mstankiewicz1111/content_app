/**
 * SOCIAL.JS - WERSJA FINALNA (Z FUNKCJĄ ODŚWIEŻANIA INSPIRACJI)
 */

// 1. ZARZĄDZANIE ZAKŁADKAMI
function switchSocialTab(tabId) { 
    console.log("Przełączanie zakładki na:", tabId);
    document.querySelectorAll('#module-social .tab-content').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('#sidebar-social button').forEach(el => el.classList.remove('active')); 
    
    const targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.add('active'); 
    
    const targetBtn = document.getElementById('btn-' + tabId);
    if(targetBtn) targetBtn.classList.add('active'); 

    if(window.innerWidth <= 768 && typeof toggleMobileMenu === 'function') toggleMobileMenu(); 
    
    if(tabId === 'sm-trend') {
        initSocialDashboard();
    }
}

// 2. DASHBOARD INSPIRACJI (ZABEZPIECZONY)
async function initSocialDashboard() {
    setTimeout(async () => {
        let container = document.getElementById('social-dashboard');
        
        if (!container) {
            const parent = document.getElementById('sm-trend');
            if (parent) {
                container = document.createElement('div');
                container.id = 'social-dashboard';
                parent.appendChild(container);
            } else { return; }
        }

        container.style.display = "block";
        container.innerHTML = `
            <div style="padding: 20px; background: #f8f9fa; border-radius: 10px; border: 1px dashed #000; text-align: center; margin-top: 20px;">
                <p style="margin: 0; font-weight: bold;">🚀 Przygotowuję inspiracje na dziś...</p>
                <small style="color: #666;">(Pobieram kalendarz i trendy live)</small>
            </div>`;

        try {
            const eventRes = await fetch('/api/get_upcoming_events').then(r => r.json());
            
            const [aiInspoRes, tiktokTrendRes] = await Promise.all([
                fetch('/api/generate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        prompt: "Jesteś ekspertem social media Wassyl. Podaj 1 kreatywny pomysł na post na dziś. UNIKAJ stylu vintage/grandpa/retro. Skup się na streetstyle, dresach i lifestylu. Max 3 zdania.",
                        search: false
                    })
                }).then(r => r.json()),
                fetch('/api/generate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        prompt: "Znajdź 1 gorący trend modowy na TikToku z ostatnich 48h pasujący do marki dresowej/basic. NIE podawaj trendu 'Eclectic Grandpa'.",
                        search: true
                    })
                }).then(r => r.json())
            ]);

            const eventsHtml = eventRes.events && eventRes.events.length > 0 
                ? eventRes.events.map(ev => `<div class="event-card"><strong>${ev.date}</strong><br>${ev.name}</div>`).join('')
                : '<p>Brak wydarzeń w najbliższych dniach.</p>';

            const safeMd = (text) => typeof formatMarkdown === 'function' ? formatMarkdown(text) : text;

            container.innerHTML = `
                <div class="dashboard-wrapper">
                    <div class="dashboard-block events-block">
                        <h3>📅 Nadchodzące Okazje</h3>
                        <div class="event-grid">${eventsHtml}</div>
                    </div>
                    <div class="dashboard-block">
                        <h3>💡 Szybka Inspiracja</h3>
                        <div class="ai-content">${safeMd(aiInspoRes.result)}</div>
                        <button class="btn-refresh-mini" onclick="refreshSingleInspiration('idea')">🔄 Inny pomysł</button>
                    </div>
                    <div class="dashboard-block trend-live">
                        <h3>🔥 TikTok Trend</h3>
                        <div class="trend-content">${safeMd(tiktokTrendRes.result)}</div>
                        <button class="btn-refresh-mini" onclick="refreshSingleInspiration('trend')">🔄 Inny trend</button>
                    </div>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<div style="color: red; padding: 20px; border: 1px solid red;">Błąd ładowania: ${e.message}</div>`;
        }
    }, 200);
}

// 2A. FUNKCJA ODŚWIEŻANIA POJEDYNCZEGO BLOKU
async function refreshSingleInspiration(type) {
    const blockIndex = type === 'idea' ? 2 : 3;
    const block = document.querySelector(`.dashboard-block:nth-child(${blockIndex})`);
    if (!block) return;

    const loaderHtml = `<p style="font-size:12px; color:#666;">🔄 Losuję coś nowego...</p>`;
    const contentArea = block.querySelector('.ai-content') || block.querySelector('.trend-content');
    contentArea.innerHTML = loaderHtml;

    const prompt = type === 'idea' 
        ? "Podaj NOWY, alternatywny pomysł na post dla Wassyl. Kategoryczny zakaz trendów vintage/grandpa. Skup się na dresach, oversize i vibe 'girl next door'. Max 2 zdania."
        : "Znajdź INNY, świeży trend fashion z TikToka, który nie jest 'Eclectic Grandpa'. Szukaj trendów viralowych dla Gen Z.";

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt: prompt, search: (type === 'trend') })
        }).then(r => r.json());

        const safeMd = (text) => typeof formatMarkdown === 'function' ? formatMarkdown(text) : text;
        contentArea.innerHTML = safeMd(res.result);
    } catch (e) {
        contentArea.innerHTML = "Błąd odświeżania.";
    }
}

// 3. ANALIZA TRENDÓW
async function analyzeTrends() {
    const resBox = document.getElementById('trend-result'); 
    const loader = document.getElementById('loader-trend');
    const wrapper = document.getElementById('trend-wrapper');
    if(loader) loader.style.display = 'block'; 
    if(wrapper) wrapper.style.display = 'none';
    
    try {
        const res = await fetch('/api/generate', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({prompt: "Wymień 3 najgorętsze trendy fashion na TikToku (nie grandpa style). Markdown.", search: true}) 
        });
        const data = await res.json(); 
        if(loader) loader.style.display = 'none'; 
        resBox.innerHTML = typeof formatMarkdown === 'function' ? formatMarkdown(data.result) : data.result; 
        if(wrapper) wrapper.style.display = 'block';
    } catch(e) { if(loader) loader.style.display = 'none'; }
}

// 4. GENERATOR HOOKÓW
async function generateHooks() {
    const topic = document.getElementById('hook-topic').value; 
    const resBox = document.getElementById('hooks-result'); 
    const loader = document.getElementById('loader-hooks');
    const wrapper = document.getElementById('hooks-wrapper');
    if(loader) loader.style.display = 'block'; 
    if(wrapper) wrapper.style.display = 'none';
    
    try {
        const extraData = typeof getProductContextText === 'function' ? await getProductContextText('hook-product-ids') : "";
        const res = await fetch('/api/generate', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({prompt: `Wygeneruj 10 viralowych hooków o: ${topic}. Styl Wassyl. ${extraData}`}) 
        });
        const data = await res.json(); 
        if(loader) loader.style.display = 'none'; 
        resBox.innerHTML = typeof formatMarkdown === 'function' ? formatMarkdown(data.result) : data.result; 
        if(wrapper) wrapper.style.display = 'block';
    } catch(e) { if(loader) loader.style.display = 'none'; }
}

// 5. GENERATOR SCENARIUSZA
async function generateScript() {
    const topic = document.getElementById('script-topic').value; 
    const dur = document.getElementById('script-duration').value; 
    const resBox = document.getElementById('script-result'); 
    const loader = document.getElementById('loader-script');
    const wrapper = document.getElementById('script-wrapper');
    if(loader) loader.style.display = 'block'; 
    if(wrapper) wrapper.style.display = 'none';
    
    try {
        const extraData = typeof getProductContextText === 'function' ? await getProductContextText('script-product-ids') : "";
        const res = await fetch('/api/generate', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({prompt: `Stwórz scenariusz wideo (${dur}) o: ${topic}. Styl Wassyl. ${extraData}. Markdown.`}) 
        });
        const data = await res.json(); 
        if(loader) loader.style.display = 'none'; 
        resBox.innerHTML = typeof formatMarkdown === 'function' ? formatMarkdown(data.result) : data.result; 
        if(wrapper) wrapper.style.display = 'block';
    } catch(e) { if(loader) loader.style.display = 'none'; }
}

// 6. RECYKLING Z BLOGA
function repurposeFromBlog() {
    const blogBox = document.getElementById('article-result');
    const blogText = blogBox ? blogBox.innerText : ""; 
    if(!blogText || blogText.length < 50) { alert("Najpierw stwórz artykuł w sekcji BLOG!"); return; }
    document.getElementById('script-topic').value = "Recykling na podstawie artykułu: " + blogText.substring(0, 300); 
    switchSocialTab('sm-scripts');
}
