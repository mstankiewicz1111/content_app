/**
 * BLOG.JS - Wersja Ostateczna (Wszystkie funkcje w jednym pliku)
 */

function switchTab(tabId) {
    document.querySelectorAll('#module-blog .tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#sidebar-blog button').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.getElementById('btn-' + tabId).classList.add('active');
}

function syncProductIds() {
    const ids = document.getElementById('context-product-ids').value;
    document.getElementById('pub-rec-ids').value = ids;
    document.getElementById('pub-html-ids').value = ids;
    document.getElementById('pub-collage-ids').value = ids;
}

// ==========================================
// 1. GENEROWANIE POMYSŁÓW (TAB 1)
// ==========================================
async function generateIdeas(userIdea) {
    const resBox = document.getElementById('ideas-result');
    const loader = document.getElementById('loader-1');
    loader.style.display = 'block';
    resBox.innerHTML = '';
    
    const prompt = userIdea 
        ? `Jesteś redaktorką bloga modowego Wassyl. Zaproponuj 5 chwytliwych tematów na podstawie pomysłu: "${userIdea}". Zwróć WYŁĄCZNIE czysty JSON w formacie tablicy obiektów: [{"title": "Tytuł", "desc": "Krótki opis"}]. Żadnego przywitania.`
        : `Jesteś redaktorką bloga modowego Wassyl. Kwiecień 2026. Poszukaj aktualnych trendów modowych i zaproponuj 5 chwytliwych tematów. Zwróć WYŁĄCZNIE czysty JSON w formacie tablicy obiektów: [{"title": "Tytuł", "desc": "Krótki opis"}].`;

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt: prompt, search: !userIdea, json_mode: true })
        });
        const data = await res.json();
        loader.style.display = 'none';
        
        let rawText = data.result || "";
        let ideas = [];
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            ideas = JSON.parse(jsonMatch[0]);
        } else {
            throw new Error("AI nie wygenerowało poprawnego JSON.");
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
        ideas.forEach(idea => {
            const title = idea.title || "Brak tytułu";
            const encodedTitle = encodeURIComponent(title);
            html += `
            <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
                <h4 style="margin-top: 0; font-size: 16px;">${title}</h4>
                <p style="font-size: 13px; color: #666; margin-bottom: 15px;">${idea.desc || idea.description}</p>
                <button class="btn-primary" onclick="selectBlogIdea('${encodedTitle}')" style="margin: 0; font-size: 12px; background: #000;">✍️ Wybierz ten temat</button>
            </div>`;
        });
        html += '</div>';
        resBox.innerHTML = html;
    } catch (e) {
        loader.style.display = 'none';
        resBox.innerHTML = `<div style="color:red;">Błąd AI: ${e.message}</div>`;
    }
}

function selectBlogIdea(encodedTitle) {
    document.getElementById('topic-input').value = decodeURIComponent(encodedTitle);
    switchTab('tab2');
}

// ==========================================
// 2. KROK 2: KONSPEKT I ARTYKUŁ (SAMA TREŚĆ)
// ==========================================
async function generatePlan() {
    const topic = document.getElementById('topic-input').value;
    if(!topic) return alert("Podaj temat!");
    document.getElementById('loader-plan').style.display = 'block';
    const prompt = `Stwórz chłodny, merytoryczny konspekt artykułu. Temat: ${topic}. 4-5 nagłówków H2. Pod każdym 1-2 zdania wytycznych. ZAKAZ Title Case.`;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) });
        const data = await res.json();
        document.getElementById('loader-plan').style.display = 'none';
        document.getElementById('plan-result').value = data.result;
        document.getElementById('plan-section').style.display = 'block';
    } catch(e) { alert("Błąd: " + e.message); }
}

async function generateArticleFromPlan() {
    const topic = document.getElementById('topic-input').value;
    const plan = document.getElementById('plan-result').value;
    document.getElementById('loader-2').style.display = 'block';
    
    const prompt = `Napisz artykuł (TYLKO treść główną, bez tytułu i wstępu). TEMAT: ${topic}. KONSPEKT: ${plan}. WYTYCZNE: Profesjonalny ton, krótkie akapity (3-4 zdania), ZAKAZ Title Case, ZAKAZ komentarzy AI, ZAKAZ gwiazdek jako cudzysłowu. Cudzysłów to "".`;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) });
        const data = await res.json();
        document.getElementById('loader-2').style.display = 'none';
        let formatted = data.result;
        if (typeof marked !== 'undefined') formatted = marked.parse(formatted);
        document.getElementById('article-result').innerHTML = formatted;
        document.getElementById('article-section').style.display = 'block';
        updateBlogCharCounter();
    } catch(e) { alert("Błąd: " + e.message); }
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
    const prompt = `Skoryguj tekst: ${article}. INSTRUKCJA: ${instruction}. WYTYCZNE: Zwróć TYLKO poprawiony tekst Markdown. Kategoryczny zakaz jakichkolwiek komentarzy AI (np. "Jasne, poprawiłem").`;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) });
        const data = await res.json();
        let formatted = data.result;
        if (typeof marked !== 'undefined') formatted = marked.parse(formatted);
        document.getElementById('article-result').innerHTML = formatted;
        document.getElementById('loader-2').style.display = 'none';
        updateBlogCharCounter();
        document.getElementById('revision-input').value = "";
    } catch(e) { alert("Błąd: " + e.message); }
}

function quickRevise(inst) { document.getElementById('revision-input').value = inst; reviseArticle(); }

// ==========================================
// 3. TYTUŁ I LEAD (GENEROWANE NA KOŃCU)
// ==========================================
async function generateMeta(instruction = "") {
    const article = document.getElementById('article-result').innerText;
    const metaSection = document.getElementById('meta-section');
    metaSection.style.display = 'block';
    const titleInput = document.getElementById('final-title');
    const leadInput = document.getElementById('final-lead');
    
    titleInput.value = "⏳ Generuję...";
    leadInput.value = "⏳ Myślę nad hookiem...";

    const prompt = `Na podstawie tekstu: ${article.substring(0, 2000)} wymyśl chwytliwy Tytuł i Lead (2-3 zdania hooku). ${instruction}. Zwróć TYLKO JSON: {"title": "...", "lead": "..."}`;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt, json_mode: true}) });
        const data = await res.json();
        const result = JSON.parse(data.result.match(/\{[\s\S]*\}/)[0]);
        titleInput.value = result.title;
        leadInput.value = result.lead;
    } catch (e) { alert("Błąd meta: " + e.message); }
}

function tweakMeta(inst) { generateMeta(inst); }

function goToPublish() {
    const title = document.getElementById('final-title').value;
    const lead = document.getElementById('final-lead').value;
    if (!title || title.includes('⏳')) return alert("Wygeneruj najpierw Tytuł i Lead!");
    
    document.getElementById('pub-title').value = title;
    document.getElementById('pub-lead').value = lead;
    switchTab('tab3');
    generateHtml();
}

// ==========================================
// 4. KOLAŻ I HTML (SZABLON WASSYL)
// ==========================================
async function generateCollage() {
    const ids = document.getElementById('pub-collage-ids').value;
    document.getElementById('loader-collage').style.display = 'block';
    const canvas = document.getElementById('collage-canvas');
    const ctx = canvas.getContext('2d');
    
    try {
        const res = await fetch('/api/idosell/products', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids: ids}) });
        const data = await res.json();
        const products = data.results || [];
        const imgs = await Promise.all(products.slice(0,3).map(p => {
            return new Promise((res, rej) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => res(img);
                img.onerror = rej;
                img.src = p.productImages[0].productImageLargeUrl;
            });
        }));

        ctx.fillStyle = "#fff";
        ctx.fillRect(0,0,1200,675);
        const w = 1200 / imgs.length;
        imgs.forEach((img, i) => {
            const scale = Math.max(w/img.width, 675/img.height);
            const dW = img.width * scale;
            const dH = img.height * scale;
            ctx.save(); ctx.beginPath(); ctx.rect(i*w, 0, w, 675); ctx.clip();
            ctx.drawImage(img, (i*w)+(w/2)-(dW/2), 337-(dH/2), dW, dH);
            ctx.restore();
            if(i > 0) { ctx.fillStyle="#fff"; ctx.fillRect(i*w-5, 0, 10, 675); }
        });
        document.getElementById('collage-container').style.display = 'block';
        document.getElementById('loader-collage').style.display = 'none';
    } catch(e) { alert("Błąd kolażu: " + e.message); document.getElementById('loader-collage').style.display = 'none'; }
}

async function generateHtml() {
    const article = document.getElementById('article-result').innerHTML;
    const htmlIds = document.getElementById('pub-html-ids').value;
    document.getElementById('loader-html').style.display = 'block';
    
    let products = [];
    if(htmlIds) {
        const res = await fetch('/api/idosell/products', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids: htmlIds}) });
        const data = await res.json();
        products = data.results || [];
    }

    let imgContext = products.map(p => `- URL: ${p.productImages[0].productImageLargeUrl}, Link: https://wassyl.pl/product-pol-${p.productId}.html`).join('\n');

    const prompt = `Skonwertuj na HTML. TEKST: ${article}. ZDJĘCIA: ${imgContext}. WYTYCZNE: Użyj Flexboxa dla układu 2-kolumnowego (zdjęcie obok tekstu). Zdjęcia 90% szerokości, wyśrodkowane. ZAKAZ śmieciowego kodu docs-internal. Zwróć TYLKO kod HTML.`;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) });
        const data = await res.json();
        document.getElementById('html-result').value = data.result.replace(/```html/g, '').replace(/```/g, '').trim();
        document.getElementById('loader-html').style.display = 'none';
        document.getElementById('html-section').style.display = 'block';
    } catch(e) { alert("Błąd HTML: " + e.message); }
}

async function publishToIdosell() {
    const title = document.getElementById('pub-title').value;
    const lead = document.getElementById('pub-lead').value;
    const content = document.getElementById('html-result').value;
    
    document.getElementById('loader-publish').style.display = 'block';
    try {
        const res = await fetch('/api/idosell/publish_blog', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ title, lead, content })
        });
        const data = await res.json();
        document.getElementById('loader-publish').style.display = 'none';
        if(data.success) alert("✅ Sukces! Wpis jest w IdoSell jako szkic.");
        else alert("❌ Błąd: " + data.error);
    } catch(e) { alert("Błąd: " + e.message); }
}
