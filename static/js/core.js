const SHOP_CONTEXT = `
Jesteś ekspertem od content marketingu dla marki WASSYL (ubrania na co dzień: bluzy, dresy, sukienki).
Grupa docelowa: Gen Z i Millenialsi. Styl: edgy, luz, "vibe". Zakaz: słowa premium/luksus, adresy, miasta.
Zawsze pisz lifestylowo (spacer z psem, kawa, uczelnia).
`;

let scrapedContext = "";
let collageBase64 = "";

function openModule(module) {
    document.getElementById('view-home').style.display = 'none';
    document.getElementById('view-app').style.display = 'flex';
    document.querySelectorAll('.module-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.module-sidebar').forEach(el => el.style.display = 'none');
    
    if(module === 'blog') { 
        document.getElementById('module-blog').classList.add('active'); 
        document.getElementById('sidebar-blog').style.display = 'block'; 
        switchTab('tab1'); 
    } else if(module === 'social') { 
        document.getElementById('module-social').classList.add('active'); 
        document.getElementById('sidebar-social').style.display = 'block'; 
        switchSocialTab('sm-trend'); 
    } else if(module === 'chat') { 
        document.getElementById('module-chat').classList.add('active'); 
        document.getElementById('sidebar-chat').style.display = 'block'; 
    }
}

function goHome() {
    document.getElementById('view-app').style.display = 'none';
    document.getElementById('view-home').style.display = 'flex';
    if(window.innerWidth <= 768) { 
        document.getElementById('app-sidebar').classList.remove('open'); 
        document.getElementById('sidebar-overlay').classList.remove('active'); 
    }
}

function toggleMobileMenu() {
    document.getElementById('app-sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
}

// Zabezpieczony w 100% parser Markdown oparty na bezpiecznych obiektach RegExp
function formatMarkdown(text) {
    if(!text) return "";
    
    const h4Reg = new RegExp('^### (.*$)', 'gim');
    const h3Reg = new RegExp('^## (.*$)', 'gim');
    const h2Reg = new RegExp('^# (.*$)', 'gim');
    const boldReg = new RegExp('\\*\\*(.*?)\\*\\*', 'gim');
    const italicReg = new RegExp('\\*(.*?)\\*', 'gim');
    const linkReg = new RegExp('\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s]+)\\)', 'g');
    
    return text
        .replace(h4Reg, '<h4 style="margin-top:20px; margin-bottom:5px; font-size:16px; color:#333;">$1</h4>')
        .replace(h3Reg, '<h3 style="margin-top:25px; margin-bottom:10px; font-size:18px; color:#111;">$1</h3>')
        .replace(h2Reg, '<h2 style="margin-top:30px; margin-bottom:10px; font-size:22px; color:#000;">$1</h2>')
        .replace(boldReg, '<strong>$1</strong>')
        .replace(italicReg, '<em>$1</em>')
        .replace(linkReg, '<a href="$2" target="_blank" style="color: #0066cc;">$1</a>');
}

async function exportToDrive(elementId, titlePrefix, btnElement) {
    const contentHTML = document.getElementById(elementId).innerHTML;
    
    const hReg = new RegExp('<h[2-4][^>]*>', 'g');
    const hCloseReg = new RegExp('<\\/h[2-4]>', 'g');
    const brReg = new RegExp('<br>', 'gi');
    const pCloseReg = new RegExp('<\\/p>', 'gi');
    const tagsReg = new RegExp('<[^>]+>', 'g');

    const cleanText = contentHTML
        .replace(hReg, '\n\n')
        .replace(hCloseReg, '\n')
        .replace(brReg, '\n')
        .replace(pCloseReg, '\n\n')
        .replace(tagsReg, '')
        .trim();

    if(!cleanText) { alert("Brak treści do eksportu!"); return; }
    
    const originalText = btnElement.innerText;
    btnElement.innerText = "⏳ Zapisuję w Google Drive...";
    btnElement.disabled = true;
    
    try {
        const res = await fetch('/api/export_drive', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({title: titlePrefix + " - Wassyl AI", content: cleanText}) 
        });
        const data = await res.json();
        
        if(data.success) { 
            btnElement.innerHTML = `✅ Gotowe! <a href="${data.link}" target="_blank" style="color:white; text-decoration:underline;">Otwórz Dokument</a>`; 
        } else { 
            alert("Błąd: " + data.error); 
            btnElement.innerText = originalText; 
            btnElement.disabled = false; 
        }
    } catch(e) { 
        alert("Błąd sieci: " + e); 
        btnElement.innerText = originalText; 
        btnElement.disabled = false; 
    }
}

async function fetchUrlContext() { 
    const url = document.getElementById('store-url').value; 
    if(!url) return; 
    try {
        const res = await fetch('/api/fetch_url', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({url}) 
        }); 
        const data = await res.json(); 
        if(data.text) { 
            scrapedContext = "DODATKOWY KONTEKST: " + data.text; 
            document.getElementById('url-status').innerText = "Kontekst pobrany!"; 
        } 
    } catch(e) {}
}

async function getProductContextText(inputId) { 
    const ids = document.getElementById(inputId).value; 
    if(!ids) return ""; 
    try { 
        const resProd = await fetch('/api/idosell/products', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ids}) 
        }); 
        const dataProd = await resProd.json(); 
        if(dataProd.products && dataProd.products.length > 0) { 
            return "\nUWZGLĘDNIJ:\n" + dataProd.products.map(p => `- "${p.nazwa}"`).join('\n'); 
        } 
    } catch (e) {} 
    return ""; 
}
