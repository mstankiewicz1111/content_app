/**
 * BLOG.JS - WERSJA NAPRAWCZA (Spójna i zweryfikowana)
 */

function switchTab(tabId) {
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

// 1. GENEROWANIE POMYSŁÓW (TAB 1)
async function generateIdeas(userIdea) {
    const resBox = document.getElementById('ideas-result');
    const loader = document.getElementById('loader-1');
    loader.style.display = 'block';
    resBox.innerHTML = '';
    
    // Zaktualizowane, bardzo rygorystyczne prompty
    const prompt = userIdea 
        ? `Jesteś redaktorką polskiego sklepu z modą damską Wassyl (streetwear, casual). Zaproponuj 5 tematów wpisów na podstawie pomysłu: "${userIdea}". Tematy MUSZĄ dotyczyć wyłącznie ubrań i stylizacji. Zwróć TYLKO JSON: [{"title": "Tytuł", "desc": "Opis"}].`
        : `Jesteś redaktorką polskiego sklepu z modą damską Wassyl. Mamy wiosnę 2026 roku. Zaproponuj 5 chwytliwych tematów na wpisy blogowe. 
        KRYTYCZNE WYTYCZNE: 
        1. Skup się WYŁĄCZNIE na odzieży damskiej, stylizacjach, streetwearze, basicach, sukienkach i dresach. 
        2. KATEGORYCZNY ZAKAZ tematów o technologii, kulinariach, podróżach, kosmetykach i lifestyle'u. Tylko ciuchy!
        Zwróć TYLKO JSON: [{"title": "Tytuł", "desc": "Opis"}].`;

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ prompt: prompt, search: !userIdea, json_mode: true })
        });
        const data = await res.json();
        
        const jsonMatch = data.result.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error("AI nie zwróciło tablicy JSON.");
        const ideas = JSON.parse(jsonMatch[0]);
        
        let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
        ideas.forEach(idea => {
            const enc = encodeURIComponent(idea.title);
            html += `
            <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
                <h4 style="margin-top: 0;">${idea.title}</h4>
                <p style="font-size: 13px; color: #666;">${idea.desc || idea.description}</p>
                <button class="btn-primary" onclick="selectBlogIdea('${enc}')" style="margin: 0; background: #000;">✍️ Wybierz temat</button>
            </div>`;
        });
        resBox.innerHTML = html + '</div>';
    } catch (e) { 
        resBox.innerHTML = "Błąd: " + e.message; 
    }
    loader.style.display = 'none';
}

// 2. KROK 2: KONSPEKT I ARTYKUŁ
async function generatePlan() {
    const topic = document.getElementById('topic-input').value;
    if(!topic) return alert("Podaj temat!");
    document.getElementById('loader-plan').style.display = 'block';
    const prompt = `Stwórz techniczny konspekt artykułu (4-5 nagłówków H2). Temat: ${topic}. Pod każdym nagłówkiem napisz 2 zdania wytycznych informacyjnych. ZAKAZ Title Case w nagłówkach.`;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) });
        const data = await res.json();
        document.getElementById('plan-result').value = data.result;
        document.getElementById('plan-section').style.display = 'block';
    } catch(e) { alert("Błąd: " + e.message); }
    document.getElementById('loader-plan').style.display = 'none';
}

async function generateArticleFromPlan() {
    const topic = document.getElementById('topic-input').value;
    const plan = document.getElementById('plan-result').value;
    const loader = document.getElementById('loader-2');
    loader.style.display = 'block';
    
    const prompt = `
Napisz artykuł modowy (SAMA TREŚĆ).
TEMAT: ${topic}
KONSPEKT: ${plan}

WYTYCZNE:
1. Używaj nagłówków Markdown (##) dla każdej sekcji z konspektu.
2. ZAKAZ Title Case w nagłówkach.
3. Akapity: 3-4 zdania. Storytelling, zero slangu.
4. ZAKAZ jakichkolwiek komentarzy AI na początku i końcu.
5. ZAKAZ generowania tytułu i wstępu (zrobimy to w kolejnym kroku).
    `;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) });
        const data = await res.json();
        let formatted = data.result;
        if (window.marked) formatted = marked.parse(formatted);
        document.getElementById('article-result').innerHTML = formatted;
        document.getElementById('article-section').style.display = 'block';
        updateBlogCharCounter();
    } catch(e) { alert("Błąd: " + e.message); }
    loader.style.display = 'none';
}

function updateBlogCharCounter() {
    const el = document.getElementById('article-result');
    document.getElementById('char-counter').innerText = (el.innerText || "").length + " znaków";
}
function handleArticleEdit() { updateBlogCharCounter(); }

// 3. REWIZJA (BEZ KOMENTARZY AI)
async function reviseArticle() {
    const article = document.getElementById('article-result').innerHTML;
    const instruction = document.getElementById('revision-input').value;
    if(!instruction) return alert("Podaj instrukcję!");
    
    const loader = document.getElementById('loader-2');
    loader.style.display = 'block';
    
    const prompt = `Skoryguj tekst: ${article}. INSTRUKCJA: ${instruction}. WYTYCZNE: Zwróć TYLKO poprawiony tekst Markdown z nagłówkami ##. Kategoryczny zakaz komentarzy AI.`;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) });
        const data = await res.json();
        let formatted = data.result;
        if (window.marked) formatted = marked.parse(formatted);
        document.getElementById('article-result').innerHTML = formatted;
        updateBlogCharCounter();
        document.getElementById('revision-input').value = "";
    } catch(e) { alert("Błąd: " + e.message); }
    loader.style.display = 'none';
}

function quickRevise(inst) { document.getElementById('revision-input').value = inst; reviseArticle(); }

// 4. GENEROWANIE TYTUŁU I LEADU (PO NAPISANIU TEKSTU)
async function generateMeta(instruction = "") {
    const article = document.getElementById('article-result').innerText;
    if (article.length < 100) return alert("Napisz najpierw tekst artykułu!");
    
    document.getElementById('meta-section').style.display = 'block';
    const titleInput = document.getElementById('final-title');
    const leadInput = document.getElementById('final-lead');
    
    titleInput.value = "⏳ Generuję...";
    leadInput.value = "⏳ Myślę nad zaczepnym wstępem...";

    const prompt = `Na podstawie artykułu: ${article.substring(0, 2500)} wymyśl chwytliwy Tytuł i Lead (2-3 zdania). ${instruction}. Zwróć TYLKO JSON: {"title": "...", "lead": "..."}`;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt, json_mode: true}) });
        const data = await res.json();
        const match = data.result.match(/\{[\s\S]*\}/);
        const result = JSON.parse(match[0]);
        titleInput.value = result.title;
        leadInput.value = result.lead;
    } catch (e) { alert("Błąd: " + e.message); }
}

function tweakMeta(inst) { generateMeta(inst); }

// PRZEJŚCIE DO PUBLIKACJI (NAPRAWIONE)
function goToPublish() {
    const title = document.getElementById('final-title').value;
    const lead = document.getElementById('final-lead').value;
    
    if (!title || title.includes('⏳')) {
        return alert("Kliknij najpierw niebieski przycisk 'Generuj Tytuł i Lead'!");
    }
    
    // Kopiujemy dane do pól formularza publikacji
    document.getElementById('pub-title').value = title;
    document.getElementById('pub-lead').value = lead;
    
    switchTab('tab3');
    generateHtml(); // Automatyczne generowanie HTML po przejściu
}

// 5. KOLAŻ I HTML (SZABLON WASSYL)
async function generateCollage() {
    const ids = document.getElementById('pub-collage-ids').value;
    if(!ids) return alert("Podaj ID!");
    document.getElementById('loader-collage').style.display = 'block';
    
    const canvas = document.getElementById('collage-canvas');
    const ctx = canvas.getContext('2d');
    
    try {
        const res = await fetch('/api/idosell/products', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids: ids}) });
        const data = await res.json();
        const products = (data.results || []).slice(0, 3);
        
        const imgs = await Promise.all(products.map(p => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = p.productImages[0].productImageLargeUrl;
            });
        }));

        // Rysowanie 1200x675
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
    } catch(e) { alert("Błąd kolażu: " + e.message); }
    document.getElementById('loader-collage').style.display = 'none';
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

    const prompt = `
Przekonwertuj na czysty HTML.
TEKST: ${article}
ZDJĘCIA: ${imgContext}

WYTYCZNE:
1. Buduj układ 2-kolumnowy (Flexbox) wg szablonu: <div style="display: flex; flex-wrap: wrap; margin-bottom: 30px;"><div style="flex: 1 1 0%; padding: 10px;">TEKST</div><div style="flex: 1 1 0%; padding: 10px;">ZDJĘCIE 90% szerokości</div></div>.
2. Przeplataj tekst ze zdjęciami.
3. ZAKAZ śmieciowego kodu docs-internal. Zwróć TYLKO kod HTML.
    `;

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: prompt}) });
        const data = await res.json();
        document.getElementById('html-result').value = data.result.replace(/```html/g, '').replace(/```/g, '').trim();
        document.getElementById('html-section').style.display = 'block';
    } catch(e) { alert("Błąd HTML: " + e.message); }
    document.getElementById('loader-html').style.display = 'none';
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
        if(data.success) alert("✅ Sukces! Wpis jest w IdoSell jako szkic.");
        else alert("❌ Błąd: " + (data.error || "Sprawdź ID bloga"));
    } catch(e) { alert("Błąd: " + e.message); }
    document.getElementById('loader-publish').style.display = 'none';
}
