/**
 * BLOG.JS - Silnik Techniczny (Logika, API, Interfejs)
 * PROMPTY ZOSTAŁY PRZENIESIONE DO pliku prompts.js
 */

// 1. ZARZĄDZANIE INTERFEJSEM
function switchTab(tabId) {
    console.log("Przełączam na zakładkę:", tabId);
    try {
        document.querySelectorAll('#module-blog .tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('#sidebar-blog button').forEach(el => el.classList.remove('active'));
        
        const target = document.getElementById(tabId);
        if (target) target.classList.add('active');
        
        const btn = document.getElementById('btn-' + tabId);
        if (btn) btn.classList.add('active');
    } catch (e) {
        console.error("Błąd w switchTab:", e);
    }
}

function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
}

function syncProductIds() {
    const ids = getVal('context-product-ids');
    document.getElementById('pub-rec-ids').value = ids;
    document.getElementById('pub-html-ids').value = ids;
    document.getElementById('pub-collage-ids').value = ids;
}

// 2. GENEROWANIE POMYSŁÓW (KROK 1)
async function generateIdeas(userIdea) {
    const resBox = document.getElementById('ideas-result');
    const loader = document.getElementById('loader-1');
    loader.style.display = 'block';
    resBox.innerHTML = '';
    
    // Pobieramy prompt z pliku prompts.js
    const prompt = Prompts.getIdeas(userIdea);

    try {
        const res = await fetch('/api/generate', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ prompt, search: !userIdea, json_mode: true }) 
        });
        const data = await res.json();
        
        let rawText = data.result || "";
        let ideas = [];
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
            ideas = JSON.parse(jsonMatch[0]);
        } else {
            throw new Error("AI nie zwróciło poprawnego formatu JSON.");
        }
        
        let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
        ideas.forEach(idea => {
            const title = idea.title || "Bez tytułu";
            const desc = idea.desc || idea.description || "Brak opisu";
            const enc = encodeURIComponent(title);
            html += `
            <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <h4 style="margin-top: 0; color: #000; font-size: 16px;">${title}</h4>
                <p style="font-size: 13px; color: #666; margin-bottom: 15px;">${desc}</p>
                <button class="btn-primary" onclick="selectBlogIdea('${enc}')" style="margin: 0; font-size: 12px; padding: 6px 12px; background: #000;">✍️ Wybierz ten temat</button>
            </div>`;
        });
        resBox.innerHTML = html + '</div>';
    } catch (e) { 
        console.error(e);
        resBox.innerHTML = `<div style="color:red; padding:10px;">Błąd: ${e.message}</div>`; 
    }
    loader.style.display = 'none';
}

function selectBlogIdea(enc) {
    document.getElementById('topic-input').value = decodeURIComponent(enc);
    switchTab('tab2');
}

// 3. TWORZENIE TREŚCI (KROK 2)
async function generatePlan() {
    const topic = getVal('topic-input');
    const productIds = getVal('context-product-ids');
    if(!topic) return alert("Najpierw wybierz lub wpisz temat!");
    
    document.getElementById('loader-plan').style.display = 'block';
    const productContext = productIds ? `Uwzględnij te produkty (ID: ${productIds}).` : "";
    const prompt = Prompts.getPlan(topic, productContext);

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt}) });
        const data = await res.json();
        document.getElementById('plan-result').value = data.result;
        document.getElementById('plan-section').style.display = 'block';
    } catch(e) { alert("Błąd planu: " + e.message); }
    document.getElementById('loader-plan').style.display = 'none';
}

async function generateArticleFromPlan() {
    const topic = getVal('topic-input');
    const plan = getVal('plan-result');
    if(!plan) return alert("Najpierw wygeneruj konspekt!");
    
    document.getElementById('loader-2').style.display = 'block';
    const prompt = Prompts.getArticle(topic, plan);

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt}) });
        const data = await res.json();
        let formatted = data.result;
        
        if (window.marked) formatted = marked.parse(formatted);
        
        document.getElementById('article-result').innerHTML = formatted;
        document.getElementById('article-section').style.display = 'block';
        updateBlogCharCounter();
    } catch(e) { alert("Błąd artykułu: " + e.message); }
    document.getElementById('loader-2').style.display = 'none';
}

function updateBlogCharCounter() {
    const el = document.getElementById('article-result');
    if(el) document.getElementById('char-counter').innerText = el.innerText.length + " znaków";
}

async function reviseArticle() {
    const article = document.getElementById('article-result').innerHTML;
    const instruction = getVal('revision-input');
    if(!instruction) return alert("Wpisz, co chcesz poprawić!");

    document.getElementById('loader-2').style.display = 'block';
    const prompt = Prompts.getRevision(article, instruction);
    
    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt}) });
        const data = await res.json();
        let formatted = data.result;
        if (window.marked) formatted = marked.parse(formatted);
        
        document.getElementById('article-result').innerHTML = formatted;
        updateBlogCharCounter();
        document.getElementById('revision-input').value = "";
    } catch(e) { alert("Błąd poprawki: " + e.message); }
    document.getElementById('loader-2').style.display = 'none';
}

function quickRevise(inst) { document.getElementById('revision-input').value = inst; reviseArticle(); }

// 4. TYTUŁ I LEAD (KROK 3 - przed publikacją)
async function generateMeta(instruction = "") {
    const article = document.getElementById('article-result').innerText;
    if (article.length < 100) return alert("Napisz najpierw artykuł!");
    
    document.getElementById('meta-section').style.display = 'block';
    const titleInput = document.getElementById('final-title');
    const leadInput = document.getElementById('final-lead');
    
    titleInput.value = "⏳ Generuję tytuł...";
    leadInput.value = "⏳ Myślę nad wstępem...";

    const prompt = Prompts.getMeta(article.substring(0, 2500), instruction);

    try {
        const res = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt, json_mode: true}) });
        const data = await res.json();
        const jsonMatch = data.result.match(/\{[\s\S]*\}/);
        const result = JSON.parse(jsonMatch[0]);
        
        titleInput.value = result.title || "";
        leadInput.value = result.lead || "";
    } catch (e) { alert("Błąd generowania meta: " + e.message); }
}

function tweakMeta(inst) { generateMeta(inst); }

// 5. PRZEJŚCIE DO PUBLIKACJI (Zabezpieczone)
function goToPublish() {
    console.log("Uruchamiam transfer danych do publikacji...");
    const title = getVal('final-title');
    const lead = getVal('final-lead');
    
    if (!title || title.includes('⏳')) {
        return alert("Najpierw wygeneruj Tytuł i Lead niebieskim przyciskiem!");
    }
    
    // Transfer danych do pól Kroku 4
    if(document.getElementById('pub-title')) document.getElementById('pub-title').value = title;
    if(document.getElementById('pub-lead')) document.getElementById('pub-lead').value = lead;
    
    // Zmiana zakładki
    switchTab('tab3');
    
    // Automatyczne wywołanie konwersji na HTML
    generateHtml();
}

// 6. KOLAŻ
async function generateCollage() {
    const ids = getVal('pub-collage-ids');
    if(!ids) return alert("Podaj ID produktów do kolażu!");
    
    document.getElementById('loader-collage').style.display = 'block';
    const canvas = document.getElementById('collage-canvas');
    const ctx = canvas.getContext('2d');
    
    try {
        const res = await fetch('/api/idosell/products', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids}) });
        const data = await res.json();
        const products = (data.results || []).slice(0, 3);
        
        if (products.length === 0) {
            document.getElementById('loader-collage').style.display = 'none';
            return alert("Nie znaleziono produktów o podanych ID w IdoSell.");
        }

        const imgs = await Promise.all(products.map(p => {
            return new Promise((resolve, reject) => {
                // Bezpieczne sprawdzanie, czy produkt ma w ogóle zdjęcia
                const url = (p.productImages && p.productImages.length > 0) 
                    ? (p.productImages[0].productImageLargeUrl || p.productImages[0].productImageMediumUrl) 
                    : null;
                
                if (!url) return reject(new Error(`Produkt ID ${p.productId || p.id} nie ma przypisanych zdjęć.`));

                const img = new Image();
                img.crossOrigin = "Anonymous"; // Próba 1: Idealna (pozwala na bezproblemowy zapis prawym klawiszem)
                img.onload = () => resolve(img);
                img.onerror = () => {
                    console.warn("CORS zablokował zdjęcie, próbuję trybu fallback dla URL:", url);
                    // Próba 2: Fallback bez weryfikacji (omija blokadę, ale może wymagać screena do zapisu)
                    const imgFallback = new Image();
                    imgFallback.onload = () => resolve(imgFallback);
                    imgFallback.onerror = () => reject(new Error(`Przeglądarka trwale zablokowała pobranie zdjęcia: ${url}`));
                    imgFallback.src = url;
                };
                img.src = url;
            });
        }));

        // Renderowanie płótna
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, 1200, 675);
        const w = 1200 / imgs.length;
        
        imgs.forEach((img, i) => {
            const scale = Math.max(w / img.width, 675 / img.height);
            const dW = img.width * scale, dH = img.height * scale;
            ctx.save(); 
            ctx.beginPath(); 
            ctx.rect(i * w, 0, w, 675); 
            ctx.clip();
            ctx.drawImage(img, (i * w) + (w / 2) - (dW / 2), 337.5 - (dH / 2), dW, dH);
            ctx.restore();
            
            // Pionowy separator
            if(i > 0) { 
                ctx.fillStyle = "#fff"; 
                ctx.fillRect(i * w - 5, 0, 10, 675); 
            }
        });
        
        document.getElementById('collage-container').style.display = 'block';
    } catch(e) { 
        console.error(e);
        alert("Błąd kolażu: " + e.message); 
    }
    document.getElementById('loader-collage').style.display = 'none';
}

// 7. WYSYŁKA DO IDOSELL
async function publishToIdosell() {
    const title = getVal('pub-title');
    const lead = getVal('pub-lead');
    const content = getVal('html-result');
    const productIds = getVal('pub-html-ids'); // Pobieramy ID produktów do podpięcia pod wpis
    
    if(!title || !content) return alert("Uzupełnij tytuł i wygeneruj kod HTML!");
    
    document.getElementById('loader-publish').style.display = 'block';
    
    // Usuwamy stary komunikat o sukcesie (jeśli klikamy ponownie)
    const oldMsg = document.getElementById('publish-success-message');
    if (oldMsg) oldMsg.remove();
    
    try {
        const res = await fetch('/api/idosell/publish_blog', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ title, lead, content, productIds }) 
        });
        
        const data = await res.json();
        
        if(data.success) {
            let successHtml = `<strong>🎉 Sukces! Wpis został zapisany jako SZKIC.</strong>`;
            
            // Jeśli backend zwrócił ID wpisu, generujemy klikalny link
            if (data.entryId) {
                const blogLink = `https://wassyl.pl/-blog-pol-${data.entryId}.html`;
                successHtml += `<br><br>Numer wpisu: <b>${data.entryId}</b>`;
                successHtml += `<br><a href="${blogLink}" target="_blank" style="display: inline-block; margin-top: 10px; color: #0066cc; text-decoration: underline; font-weight: bold;">🔗 Zobacz wpis w sklepie (kliknij)</a>`;
            }

            // Tworzymy zielony kontener z sukcesem i linkiem
            const successContainer = document.createElement('div');
            successContainer.id = 'publish-success-message';
            successContainer.style.cssText = 'margin-top: 20px; padding: 15px; background-color: #d4edda; color: #155724; border-radius: 5px; border: 1px solid #c3e6cb; font-size: 14px;';
            successContainer.innerHTML = successHtml;
            
            // Doklejamy komunikat na samym dole formularza publikacji
            document.getElementById('tab3').appendChild(successContainer);
            
            // Powiadomienie natychmiastowe dla użytkownika
            alert(data.entryId ? `✅ Wpis pomyślnie dodany! ID: ${data.entryId}` : `✅ Wpis dodany!`);
            
        } else {
            alert("❌ Błąd IdoSell: " + (data.error || "Nieznany błąd"));
        }
    } catch(e) { 
        alert("Błąd połączenia: " + e.message); 
    }
    
    document.getElementById('loader-publish').style.display = 'none';
}
