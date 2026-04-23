/**
 * SOCIAL.JS - WERSJA ZOPTYMALIZOWANA Z BRAND VOICE SYMULATOREM
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

// 2. DASHBOARD INSPIRACJI
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
                <p style="margin: 0; font-weight: bold;">🚀 Pobieram trendy na KWIECIEŃ 2026...</p>
                <small style="color: #666;">(Przeszukuję sieć pod kątem aktualnych viralów)</small>
            </div>`;

        try {
            const eventRes = await fetch('/api/get_upcoming_events').then(r => r.json());
            
            const [aiInspoRes, tiktokTrendRes] = await Promise.all([
                fetch('/api/generate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        prompt: "Jesteś ekspertem social media Wassyl. Dziś jest 20 kwietnia 2026. Podaj 1 kreatywny, lifestylowy pomysł na post. Skup się na bluzach/spodniach dresowych. ZAKAZ: trendów z 2024/2025 roku. Napisz to w 2 zdaniach.",
                        search: true
                    })
                }).then(r => r.json()),
                fetch('/api/generate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        prompt: "Znajdź 1 NAJŚWIEŻSZY trend modowy na TikToku (stan na kwiecień 2026). Nie podawaj starych trendów. Szukaj czegoś, co pasuje do ubrań basic i streetwear. Opisz krótko.",
                        search: true
                    })
                }).then(r => r.json())
            ]);

            const eventsHtml = eventRes.events && eventRes.events.length > 0 
                ? eventRes.events.map(ev => `<div class="event-card"><strong>${ev.date}</strong><br>${ev.name}</div>`).join('')
                : '<p>Brak wydarzeń w najbliższych dniach.</p>';

            const safeMd = (text) => typeof formatMarkdown === 'function' ? formatMarkdown(text) : text;

            container.innerHTML = `
                <div class="dashboard-wrapper" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div class="dashboard-left-col">
                        <div class="dashboard-block trend-live" style="margin-bottom: 20px;">
                            <h3>🔥 TikTok Trend (LIVE 2026)</h3>
                            <div class="trend-content">${safeMd(tiktokTrendRes.result)}</div>
                            <button class="btn-refresh-mini" onclick="refreshSingleInspiration('trend')">🔄 Szukaj nowszego</button>
                        </div>
                        <div class="dashboard-block">
                            <h3>💡 Szybka Inspiracja</h3>
                            <div class="ai-content">${safeMd(aiInspoRes.result)}</div>
                            <button class="btn-refresh-mini" onclick="refreshSingleInspiration('idea')">🔄 Inny pomysł</button>
                        </div>
                    </div>
                    <div class="dashboard-right-col" style="display: flex; flex-direction: column; justify-content: flex-end;">
                         <div class="dashboard-block events-block" style="margin-top: auto;">
                            <h3>📅 Kalendarz Marketingowy</h3>
                            <div class="event-grid">${eventsHtml}</div>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<div style="color: red; padding: 20px; border: 1px solid red;">Błąd synchronizacji 2026: ${e.message}</div>`;
        }
    }, 200);
}

async function refreshSingleInspiration(type) {
    const block = type === 'idea' ? document.querySelector('.dashboard-block:not(.trend-live):not(.events-block)') : document.querySelector('.trend-live');
    const contentArea = block.querySelector('.ai-content') || block.querySelector('.trend-content');
    contentArea.innerHTML = `<p style="font-size:12px; color:#666;">🔄 Przeszukuję trendy z kwietnia 2026...</p>`;

    const prompt = type === 'idea' 
        ? "Daj inny pomysł na post Wassyl (20.04.2026). Tylko dresy i streetstyle. Absolutny zakaz trendów retro/vintage z lat 2024-2025."
        : "Znajdź INNY trend z TikToka, który narodził się w marcu/kwietniu 2026. Skup się na Gen-Z i ubraniach baggy.";

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt: prompt, search: true })
        }).then(r => r.json());

        const safeMd = (text) => typeof formatMarkdown === 'function' ? formatMarkdown(text) : text;
        contentArea.innerHTML = safeMd(res.result);
    } catch (e) {
        contentArea.innerHTML = "Błąd odświeżania danych.";
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
        // Zabezpieczony prompt z uwzględnieniem miejskiego luzu
        const promptText = (typeof WASSYL_DNA !== 'undefined') 
            ? `${WASSYL_DNA}\nWymień 3 najgorętsze, aktualne trendy fashion na TikToku. Skup się na streetwearze, dresach i basicach, które pasują do naszej marki. Zwróć wynik jako czytelny Markdown, bez poetyckich metafor.`
            : "Wymień 3 najgorętsze trendy fashion na TikToku (Kwiecień 2026). Format: Markdown.";

        console.log("Wysyłam zapytanie o trendy...");
        
        const res = await fetch('/api/generate', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            // Usunięto parametr search: true, aby uniknąć błędu 500
            body: JSON.stringify({prompt: promptText}) 
        });
        
        const data = await res.json(); 
        
        if (!data.result) {
            throw new Error(data.error || "Brak odpowiedzi od AI.");
        }
        
        let cleanResult = data.result.replace(/```markdown/g, '').replace(/```/g, '').trim();
        
        resBox.innerHTML = typeof formatMarkdown === 'function' ? formatMarkdown(cleanResult) : cleanResult; 
        
        if(loader) loader.style.display = 'none'; 
        if(wrapper) wrapper.style.display = 'block';
        console.log("Trendy wygenerowane poprawnie!");
        
    } catch(e) { 
        if(loader) loader.style.display = 'none'; 
        console.error("Szczegóły błędu analizy trendów:", e);
        alert("Błąd analizy trendów: " + e.message + " (Sprawdź konsolę F12)"); 
    }
}

// ZMODYFIKOWANE: Generator Hooków podłączony pod WASSYL DNA
async function generateHooks() {
    const topic = document.getElementById('hook-topic').value; 
    const resBox = document.getElementById('hooks-result'); 
    const loader = document.getElementById('loader-hooks');
    const wrapper = document.getElementById('hooks-wrapper');
    if(loader) loader.style.display = 'block'; 
    if(wrapper) wrapper.style.display = 'none';
    try {
        const extraData = typeof getProductContextText === 'function' ? await getProductContextText('hook-product-ids') : "";
        const combinedTopic = topic + (extraData ? ` (Dodatkowe info o produkcie: ${extraData})` : "");
        
        // Pobieramy prompt centralny z wytycznymi marki
        const promptText = (typeof Prompts !== 'undefined' && Prompts.getHooks) 
            ? Prompts.getHooks(combinedTopic) 
            : `Wygeneruj 10 viralowych hooków o: ${combinedTopic}. Styl Wassyl.`;

        const res = await fetch('/api/generate', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({prompt: promptText}) 
        });
        const data = await res.json(); 
        if(loader) loader.style.display = 'none'; 
        resBox.innerHTML = typeof formatMarkdown === 'function' ? formatMarkdown(data.result) : data.result; 
        if(wrapper) wrapper.style.display = 'block';
    } catch(e) { if(loader) loader.style.display = 'none'; }
}

// ZMODYFIKOWANE: Generator Scenariuszy podłączony pod WASSYL DNA
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
        const combinedTopic = `${topic}. Długość wideo: ${dur}. ${extraData}`;

        // Pobieramy prompt centralny z wytycznymi marki
        const promptText = (typeof Prompts !== 'undefined' && Prompts.getVideoScript) 
            ? Prompts.getVideoScript(combinedTopic) 
            : `Stwórz scenariusz wideo o: ${combinedTopic}. Styl Wassyl. Markdown.`;

        const res = await fetch('/api/generate', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({prompt: promptText}) 
        });
        const data = await res.json(); 
        if(loader) loader.style.display = 'none'; 
        resBox.innerHTML = typeof formatMarkdown === 'function' ? formatMarkdown(data.result) : data.result; 
        if(wrapper) wrapper.style.display = 'block';
    } catch(e) { if(loader) loader.style.display = 'none'; }
}

function repurposeFromBlog() {
    const blogBox = document.getElementById('article-result');
    const blogText = blogBox ? blogBox.innerText : ""; 
    if(!blogText || blogText.length < 50) { alert("Najpierw stwórz artykuł w sekcji BLOG!"); return; }
    document.getElementById('script-topic').value = "Recykling na podstawie artykułu: " + blogText.substring(0, 300); 
    switchSocialTab('sm-scripts');
}

// --- NOWOŚĆ: LOGIKA SYMULATORA GŁOSU MARKI ---
async function simulateBrandVoice() {
    const rawText = document.getElementById('sim-raw-text').value;
    if (!rawText) return alert("Wpisz jakiś tekst do przetworzenia!");
    
    const loader = document.getElementById('loader-sim');
    const wrapper = document.getElementById('sim-wrapper');
    const beforeBox = document.getElementById('sim-before');
    const afterBox = document.getElementById('sim-after');
    
    loader.style.display = 'block';
    wrapper.style.display = 'none';
    
    try {
        beforeBox.innerText = rawText; // Pokaż surowy tekst w lewej kolumnie
        
        // Zabezpieczenie na wypadek, gdyby plik prompts.js nie został załadowany poprawnie
        const promptText = (typeof Prompts !== 'undefined' && Prompts.getBrandSim) 
            ? Prompts.getBrandSim(rawText) 
            : `Zadanie: Transformacja tekstu na styl WASSYL (Miejski luz, streetwear, zero poezji, konkret i vibe). PRZERÓB TEKST: "${rawText}". Zwróć tylko zrewidowany wynik.`;

        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({prompt: promptText})
        });
        const data = await res.json();
        
        afterBox.innerHTML = typeof formatMarkdown === 'function' ? formatMarkdown(data.result) : data.result;
        wrapper.style.display = 'block';
    } catch(e) {
        alert("Błąd symulatora: " + e.message);
    }
    loader.style.display = 'none';
}
