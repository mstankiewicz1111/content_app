/**
 * BLOG.JS - WERSJA PANCERNA (Finalny Fix)
 */

function switchTab(tabId) {
    console.log("Przełączam na tab:", tabId);
    document.querySelectorAll('#module-blog .tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#sidebar-blog button').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');
    
    const btn = document.getElementById('btn-' + tabId);
    if (btn) btn.classList.add('active');
}

function syncProductIds() {
    const ids = document.getElementById('context-product-ids').value;
    document.getElementById('pub-rec-ids').value = ids;
    document.getElementById('pub-html-ids').value = ids;
    document.getElementById('pub-collage-ids').value = ids;
}

// 1. GENEROWANIE POMYSŁÓW
async function generateIdeas(userIdea) {
    const resBox = document.getElementById('ideas-result');
    const loader = document.getElementById('loader-1');
    loader.style.display = 'block';
    resBox.innerHTML = '';
    
    const prompt = `Jesteś redaktorką Wassyl (moda damska). Zaproponuj 5 tematów ubrań/stylizacji (ZAKAZ technologii/kuchni) dla: "${userIdea || 'trendy wiosna 2026'}". Zwróć TYLKO JSON: [{"title": "Tytuł", "desc": "Opis"}].`;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ prompt, search: !userIdea, json_mode: true }) });
        const data = await res.json();
        const ideas = JSON.parse(data.result.match(/\[[\s\S]*\]/)[0]);
        
        let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
        ideas.forEach(idea => {
            const enc = encodeURIComponent(idea.title);
            html += `<div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
                <h4 style="margin-top: 0;">${idea.title}</h4>
                <p style="font-size: 13px; color: #666;">${idea.desc || idea.description}</p>
                <button class="btn-primary" onclick="selectBlogIdea('${enc}')" style="margin: 0; background: #000;">✍️ Wybierz temat</button>
            </div>`;
        });
        resBox.innerHTML = html + '</div>';
    } catch (e) { resBox.innerHTML = "Błąd: " + e.message; }
    loader.style.display = 'none';
}

function selectBlogIdea(enc) {
    document.getElementById('topic-input').value = decodeURIComponent(enc);
    switchTab('tab2');
}

// 2. ARTYKUŁ (SAMA TREŚĆ)
async function generatePlan() {
    const topic = document.getElementById('topic-input').value;
    if(!topic) return alert("Podaj temat!");
    document.getElementById('loader-plan').style.display = 'block';
    const prompt = `Stwórz konspekt (4-5 nagłówków). Temat: ${topic}. Nagłówki pisz normalnie (nie każde słowo wielką literą). ZAKAZ komentarzy AI.`;
    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt}) });
        const data = await res.json();
        document.getElementById('plan-result').value = data.result;
        document.getElementById('plan-section').style.display = 'block';
    } catch(e) { alert("Błąd: " + e.message); }
    document.getElementById('loader-plan').style.display = 'none';
}

async function generateArticleFromPlan() {
    const topic = document.getElementById('topic-input').value;
    const plan = document.getElementById('plan-result').value;
    document.getElementById('loader-2').style.display = 'block';
    
    const prompt = `Napisz artykuł modowy (SAMA TREŚĆ, bez tytułu i wstępu). TEMAT: ${topic}. KONSPEKT: ${plan}. 
    WYTYCZNE: 
    1. Nagłówki Markdown (##). ZAKAZ Title Case w nagłówkach. 
    2. Akapity 3-4 zdania. 
    3. ZAKAZ cudzysłowu z gwiazdek. 
    4. ZAKAZ JAKICHKOLWIEK KOMENTARZY AI (np. "Oto tekst"). Zacznij od razu od treści.`;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt}) });
        const data = await res.json();
        let formatted = data.result;
        if (window.marked) formatted = marked.parse(formatted);
        document.getElementById('article-result').innerHTML = formatted;
        document.getElementById('article-section').style.display = 'block';
        updateBlogCharCounter();
    } catch(e) { alert("Błąd: " + e.message); }
    document.getElementById('loader-2').style.display = 'none';
}

function updateBlogCharCounter() {
    const el = document.getElementById('article-result');
    document.getElementById('char-counter').innerText = (el.innerText || "").length + " znaków";
}
function handleArticleEdit() { updateBlogCharCounter(); }

async function reviseArticle() {
    const article = document.getElementById('article-result').innerHTML;
    const instruction = document.getElementById('revision-input').value;
    document.getElementById('loader-2').style.display = 'block';
    const prompt = `Skoryguj tekst: ${article}. INSTRUKCJA: ${instruction}. WYTYCZNE: Zwróć TYLKO czysty Markdown. KATEGORYCZNY ZAKAZ komentarzy AI typu "Jasne, poprawiłem".`;
    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt}) });
        const data = await res.json();
        let formatted = data.result;
        if (window.marked) formatted = marked.parse(formatted);
        document.getElementById('article-result').innerHTML = formatted;
        updateBlogCharCounter();
        document.getElementById('revision-input').value = "";
    } catch(e) { alert("Błąd: " + e.message); }
    document.getElementById('loader-2').style.display = 'none';
}

function quickRevise(inst) { document.getElementById('revision-input').value = inst; reviseArticle(); }

// 3. TYTUŁ I LEAD
async function generateMeta(instruction = "") {
    const article = document.getElementById('article-result').innerText;
    if (article.length < 100) return alert("Napisz najpierw tekst!");
    document.getElementById('meta-section').style.display = 'block';
    const titleInput = document.getElementById('final-title');
    const leadInput = document.getElementById('final-lead');
    titleInput.value = "⏳ Generuję...";
    leadInput.value = "⏳ Tworzę hook...";

    const prompt = `Na podstawie tekstu: ${article.substring(0, 2000)} wymyśl chwytliwy Tytuł i Lead (2-3 zdania). ${instruction}. Zwróć TYLKO JSON: {"title": "...", "lead": "..."}`;
    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt, json_mode: true}) });
        const data = await res.json();
        const result = JSON.parse(data.result.match(/\{[\s\S]*\}/)[0]);
        titleInput.value = result.title;
        leadInput.value = result.lead;
    } catch (e) { alert("Błąd meta: " + e.message); }
}

function tweakMeta(inst) { generateMeta(inst); }

// PRZEJŚCIE DO PUBLIKACJI
function goToPublish() {
    const title = document.getElementById('final-title').value;
    const lead = document.getElementById('final-lead').value;
    
    if (!title || title.includes('⏳')) {
        return alert("Najpierw wygeneruj Tytuł i Lead niebieskim przyciskiem!");
    }
    
    // Kopiowanie danych
    document.getElementById('pub-title').value = title;
    document.getElementById('pub-lead').value = lead;
    
    // Najpierw zmiana zakładki (żeby użytkownik widział reakcję)
    switchTab('tab3');
    
    // Potem generowanie HTML w tle
    generateHtml();
}

// 4. KOLAŻ I HTML
async function generateCollage() {
    const ids = document.getElementById('pub-collage-ids').value;
    if(!ids) return alert("Podaj ID!");
    document.getElementById('loader-collage').style.display = 'block';
    const canvas = document.getElementById('collage-canvas');
    const ctx = canvas.getContext('2d');
    try {
        const res = await fetch('/api/idosell/products', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids}) });
        const data = await res.json();
        const products = (data.results || []).slice(0, 3);
        const imgs = await Promise.all(products.map(p => {
            return new Promise((res, rej) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => res(img);
                img.onerror = rej;
                img.src = p.productImages[0].productImageLargeUrl;
            });
        }));
        ctx.fillStyle = "#fff"; ctx.fillRect(0,0,1200,675);
        const w = 1200 / imgs.length;
        imgs.forEach((img, i) => {
            const scale = Math.max(w/img.width, 675/img.height);
            const dW = img.width * scale, dH = img.height * scale;
            ctx.save(); ctx.beginPath(); ctx.rect(i*w, 0, w, 675); ctx.clip();
            ctx.drawImage(img, (i*w)+(w/2)-(dW/2), 337-(dH/2), dW, dH);
            ctx.restore();
            if(i > 0) { ctx.fillStyle="#fff"; ctx.fillRect(i*w-5, 0, 10, 675); }
        });
        document.getElementById('collage-container').style.display = 'block';
    } catch(e) { alert("Błąd kolażu: " + e.message); }
    document.getElementById('loader-collage').style.display = 'none';
}

async function generateHtml() {
    const article = document.getElementById('article-result').innerHTML;
    const htmlIds = document.getElementById('pub-html-ids').value;
    const loader = document.getElementById('loader-html');
    if(loader) loader.style.display = 'block';
    
    let imgContext = "";
    if(htmlIds && htmlIds.trim() !== "") {
        try {
            const res = await fetch('/api/idosell/products', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids: htmlIds}) });
            const data = await res.json();
            const products = data.results || [];
            imgContext = products.map(p => {
                const url = p.productImages && p.productImages.length > 0 ? p.productImages[0].productImageLargeUrl : "";
                return url ? `- URL: ${url}, Link: https://wassyl.pl/product-pol-${p.productId}.html` : "";
            }).filter(x => x !== "").join('\n');
        } catch(e) { console.error("Błąd pobierania zdjęć do HTML", e); }
    }

    const prompt = `Skonwertuj na HTML wg szablonu Wassyl (2 kolumny Flexbox). TEKST: ${article}. ZDJĘCIA: ${imgContext}. ZAKAZ komentarzy AI. TYLKO czysty kod HTML. Nagłówki normalną wielkością liter.`;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt}) });
        const data = await res.json();
        document.getElementById('html-result').value = data.result.replace(/```html/g, '').replace(/```/g, '').trim();
        document.getElementById('html-section').style.display = 'block';
    } catch(e) { alert("Błąd HTML: " + e.message); }
    if(loader) loader.style.display = 'none';
}

async function publishToIdosell() {
    const title = document.getElementById('pub-title').value;
    const lead = document.getElementById('pub-lead').value;
    const content = document.getElementById('html-result').value;
    document.getElementById('loader-publish').style.display = 'block';
    try {
        const res = await fetch('/api/idosell/publish_blog', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ title, lead, content }) });
        const data = await res.json();
        if(data.success) alert("✅ Sukces! Wpis jest w IdoSell jako szkic.");
        else alert("❌ Błąd: " + data.error);
    } catch(e) { alert("Błąd: " + e.message); }
    document.getElementById('loader-publish').style.display = 'none';
}
