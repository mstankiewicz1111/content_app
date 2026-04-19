function switchTab(tabId) { 
    document.querySelectorAll('#module-blog .tab-content').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('#sidebar-blog button').forEach(el => el.classList.remove('active')); 
    document.getElementById(tabId).classList.add('active'); 
    document.getElementById('btn-' + tabId).classList.add('active'); 
    if(tabId === 'tab2') updateCounter(); 
    if(window.innerWidth <= 768) toggleMobileMenu(); 
}

function syncProductIds() { 
    document.getElementById('pub-html-ids').value = document.getElementById('context-product-ids').value; 
    saveDraft(); 
}

function updateCounter() { 
    const text = document.getElementById('article-result').innerText || ""; 
    const len = text.length; 
    const badge = document.getElementById('char-counter'); 
    badge.innerText = len + " znaków"; 
    badge.classList.remove('counter-good', 'counter-warn'); 
    if (len > 3800 && len < 5500) { badge.classList.add('counter-good'); } 
    else if (len > 0) { badge.classList.add('counter-warn'); } 
}

function handleArticleEdit() { 
    updateCounter(); 
    saveDraft(); 
}

function saveDraft() { 
    const draft = { 
        topic: document.getElementById('topic-input').value, 
        contextIds: document.getElementById('context-product-ids').value, 
        plan: document.getElementById('plan-result').value, 
        article: document.getElementById('article-result').innerText, 
        title: document.getElementById('pub-title').value, 
        lead: document.getElementById('pub-lead').value, 
        recIds: document.getElementById('pub-rec-ids').value, 
        htmlIds: document.getElementById('pub-html-ids').value, 
        htmlCode: document.getElementById('html-result').value, 
        collage: collageBase64 
    }; 
    localStorage.setItem('idosell_draft', JSON.stringify(draft)); 
}

function loadDraft() { 
    const draftStr = localStorage.getItem('idosell_draft'); 
    if(draftStr) { 
        const d = JSON.parse(draftStr); 
        document.getElementById('topic-input').value = d.topic || ''; 
        document.getElementById('context-product-ids').value = d.contextIds || ''; 
        if(d.plan) { document.getElementById('plan-result').value = d.plan; document.getElementById('plan-section').style.display = 'block'; } 
        if(d.article) { document.getElementById('article-result').innerText = d.article; document.getElementById('article-section').style.display = 'block'; updateCounter(); } 
        document.getElementById('pub-title').value = d.title || ''; 
        document.getElementById('pub-lead').value = d.lead || ''; 
        document.getElementById('pub-rec-ids').value = d.recIds || ''; 
        document.getElementById('pub-html-ids').value = d.htmlIds || ''; 
        if(d.htmlCode) { document.getElementById('html-result').value = d.htmlCode; document.getElementById('html-section').style.display = 'block'; } 
        if(d.collage) { collageBase64 = d.collage; document.getElementById('collage-preview').src = d.collage; document.getElementById('collage-preview').style.display = 'block'; } 
    } 
}

function resetDraft() { 
    if(confirm("Zresetować pracę?")) { 
        localStorage.removeItem('idosell_draft'); 
        location.reload(); 
    } 
}

window.onload = loadDraft;

async function generateIdeas(ideaStr) { 
    document.getElementById('loader-1').style.display = 'block'; 
    document.getElementById('ideas-result').innerHTML = ''; 
    
    let prompt_baza = ideaStr ? `Bazuj ściśle na tym koncepcie: "${ideaStr}".` : `Przeanalizuj sezon i zaproponuj tematy.`; 
    const prompt = `${SHOP_CONTEXT} ${scrapedContext}\nJako mistrz SEO pod Google Discover, wymyśl 3 ultra-chwytliwe tematy na wpis blogowy. ${prompt_baza}\nZwróć BEZWZGLĘDNIE jako CZYSTĄ LISTĘ JSON: [{"tytul": "...", "uzasadnienie": "..."}]`; 
    
    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) }); 
        const data = await res.json(); 
        document.getElementById('loader-1').style.display = 'none'; 
        
        const rawText = data.result.trim().split('```json').join('').split('```').join('').trim();
        const parsed = JSON.parse(rawText); 
        let html = ""; 
        
        parsed.forEach(item => { 
            const safeTitle = item.tytul.split("'").join("\\'");
            html += `<div class="box-option">
                        <h4 style="margin-top:0; font-size: 18px;">${item.tytul}</h4>
                        <p style="font-size: 14px; color: #555;">${item.uzasadnienie}</p>
                        <button class="btn-primary" onclick="setTopicAndSwitch('${safeTitle}')">✍️ Przejdź</button>
                     </div>`; 
        }); 
        document.getElementById('ideas-result').innerHTML = html; 
    } catch(e) { 
        document.getElementById('loader-1').style.display = 'none';
        document.getElementById('ideas-result').innerHTML = `<p style="color:red; background:#fee; padding:10px;">Błąd formatu. Sprobuj ponownie.</p>`; 
    } 
}

function setTopicAndSwitch(topic) { 
    document.getElementById('topic-input').value = topic; 
    switchTab('tab2'); 
    saveDraft(); 
}

async function generatePlan() { 
    const topic = document.getElementById('topic-input').value; 
    const guidelines = document.getElementById('guidelines-input').value; 
    if(!topic) { alert("Podaj temat!"); return; } 
    
    document.getElementById('loader-plan').style.display = 'block'; 
    const extraProductData = await getProductContextText('context-product-ids'); 
    const prompt = `${SHOP_CONTEXT} ${scrapedContext}\nSZKIELET artykułu: "${topic}". ${guidelines} ${extraProductData}\nZwróć TYLKO strukturę: H1, Lead, 3x H2.`; 
    
    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) }); 
        const data = await res.json(); 
        document.getElementById('loader-plan').style.display = 'none'; 
        document.getElementById('plan-result').value = data.result.trim(); 
        document.getElementById('plan-section').style.display = 'block'; 
        saveDraft(); 
    } catch(e) { document.getElementById('loader-plan').style.display = 'none'; }
}

async function generateArticleFromPlan() { 
    const planText = document.getElementById('plan-result').value; 
    if(!planText) { alert("Wygeneruj plan!"); return; } 
    
    document.getElementById('loader-2').style.display = 'block'; 
    const extraProductData = await getProductContextText('context-product-ids'); 
    const prompt = `${SHOP_CONTEXT} ${scrapedContext}\nNapisz artykuł na bazie planu: \n${planText} \n${extraProductData}\n4000-5000 znaków. Pisz lifestylowo. Markdown.`; 
    
    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) }); 
        const data = await res.json(); 
        document.getElementById('loader-2').style.display = 'none'; 
        document.getElementById('article-result').innerText = data.result; 
        document.getElementById('article-section').style.display = 'block'; 
        
        const lines = data.result.split('\n'); 
        let t = "", l = ""; 
        for(let line of lines) { 
            if(line.startsWith('# ')) { 
                t = line.split('# ').join('').split('*').join(''); 
                break; 
            } 
        } 
        for(let line of lines) { 
            let cl = line.trim(); 
            if(cl && !cl.startsWith('#') && !cl.startsWith('!')) { 
                l = cl; 
                break; 
            } 
        } 
        document.getElementById('pub-title').value = t; 
        document.getElementById('pub-lead').value = l; 
        updateCounter(); 
        saveDraft(); 
    } catch(e) { document.getElementById('loader-2').style.display = 'none'; }
}

async function quickRevise(instruction) { 
    const curr = document.getElementById('article-result').innerText; 
    if(!curr) return; 
    document.getElementById('loader-2').style.display = 'block'; 
    
    const prompt = `${SHOP_CONTEXT} Popraw tekst: "${instruction}". TEKST: ${curr}`; 
    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) }); 
        const data = await res.json(); 
        document.getElementById('loader-2').style.display = 'none'; 
        document.getElementById('article-result').innerText = data.result; 
        updateCounter(); 
        saveDraft(); 
    } catch(e) { document.getElementById('loader-2').style.display = 'none'; }
}

async function reviseArticle() { 
    const rev = document.getElementById('revision-input').value; 
    if(!rev) return; 
    quickRevise(rev); 
    document.getElementById('revision-input').value = ""; 
}

async function generateCollage() { 
    const ids = document.getElementById('pub-collage-ids').value; 
    if(!ids) { alert("Podaj ID!"); return; } 
    
    document.getElementById('loader-collage').style.display = 'block'; 
    try {
        const resProd = await fetch('/api/idosell/products', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids}) }); 
        const dataProd = await resProd.json(); 
        if(dataProd.products && dataProd.products.length > 0) { 
            const urls = dataProd.products.map(p => p.url_zdjecia); 
            const resCol = await fetch('/api/collage', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({urls: urls}) }); 
            const dataCol = await resCol.json(); 
            if(dataCol.collage) { 
                collageBase64 = dataCol.collage; 
                document.getElementById('collage-preview').src = collageBase64; 
                document.getElementById('collage-preview').style.display = 'block'; 
                saveDraft(); 
            } 
        } else { alert("Nie znaleziono produktów."); } 
    } catch(e) {}
    document.getElementById('loader-collage').style.display = 'none'; 
}

async function generateHtml() { 
    const ids = document.getElementById('pub-html-ids').value; 
    const text = document.getElementById('article-result').innerText; 
    if(!text) return; 
    
    document.getElementById('loader-html').style.display = 'block'; 
    let prods = []; 
    if(ids) { 
        try {
            const resProd = await fetch('/api/idosell/products', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids}) }); 
            const dataProd = await resProd.json(); 
            prods = dataProd.products || []; 
        } catch(e) {}
    } 
    
    const prompt = `Zmień artykuł na HTML IdoSell. ZASADY: Akapity: <p style="text-align: justify;"><span style="font-size: 11pt; font-family: Arial,sans-serif; color: #000000;">. Nagłówki: <h3 style="font-size: 14pt; text-align: justify;"><span style="font-size: 12pt; font-family: Arial,sans-serif; color: #000000; font-weight: bold;">. Używaj klas iai-section. KRYTYCZNE: <img> musi mieć style="width: 45%; height: auto; max-width: 100%;". Produkty: ${JSON.stringify(prods)}. HTML. Tekst: ${text}`; 
    
    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) }); 
        const data = await res.json(); 
        document.getElementById('loader-html').style.display = 'none'; 
        
        const cleanHTML = data.result.trim().split('```html').join('').split('```').join('').trim();
        document.getElementById('html-result').value = cleanHTML; 
        document.getElementById('html-section').style.display = 'block'; 
        saveDraft(); 
    } catch(e) { document.getElementById('loader-html').style.display = 'none'; }
}

async function publishToIdosell() { 
    const title = document.getElementById('pub-title').value; 
    const lead = document.getElementById('pub-lead').value; 
    const htmlCode = document.getElementById('html-result').value; 
    const recIdsStr = document.getElementById('pub-rec-ids').value; 
    
    if(!title || !htmlCode) return; 
    
    const now = new Date(); 
    const formatDaty = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'); 
    
    const payload = { 
        params: { 
            shopId: 1, 
            visible: "n", 
            date: formatDaty, 
            titleLinkType: "fullContentLink", 
            visibleOnSitesList: [{ siteId: "display_on_blog" }, { siteId: "2_main" }], 
            langs: [{ langId: "pol", title: title, shortDescription: lead, longDescription: htmlCode }] 
        } 
    }; 
    
    if(collageBase64) {
        payload.params.pictureData = { pictureBase64: collageBase64.split(",")[1], pictureFormat: "jpg" }; 
    }
    
    if(recIdsStr) { 
        const arr = recIdsStr.split(",").map(x => x.trim()).filter(x => !isNaN(x) && x!==""); 
        if(arr.length > 0) payload.params.products = arr.map(id => ({productId: parseInt(id)})); 
    } 
    
    document.getElementById('loader-publish').style.display = 'block'; 
    try {
        const res = await fetch('/api/idosell/publish', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({payload}) }); 
        const data = await res.json(); 
        document.getElementById('loader-publish').style.display = 'none'; 
        
        if(data.status === 200 && data.response && !data.response.errors) { 
            alert("SUKCES!"); 
            localStorage.removeItem('idosell_draft'); 
            location.reload(); 
        } else {
            alert("BŁĄD!"); 
        }
    } catch(e) {
        document.getElementById('loader-publish').style.display = 'none'; 
        alert("Błąd wysyłki.");
    }
}