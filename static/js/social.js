function switchSocialTab(tabId) { 
    document.querySelectorAll('#module-social .tab-content').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('#sidebar-social button').forEach(el => el.classList.remove('active')); 
    document.getElementById(tabId).classList.add('active'); 
    document.getElementById('btn-' + tabId).classList.add('active'); 
    if(window.innerWidth <= 768) toggleMobileMenu(); 
}

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