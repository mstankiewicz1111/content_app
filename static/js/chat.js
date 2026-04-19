let chatHistory = [];
let chatFileObj = null;
let chatFileType = null;
let chatFilePreviewUrl = null;

function handleChatFileUpload(event) {
    const file = event.target.files[0];
    if(!file) return;
    
    chatFileObj = file;
    chatFileType = file.type;
    chatFilePreviewUrl = URL.createObjectURL(file);
    
    const previewContainer = document.getElementById('chat-image-preview-container');
    previewContainer.innerHTML = ''; 

    const btnHTML = `<button onclick="removeChatFile()" style="position: absolute; top: -10px; right: -10px; background: #dc3545; color: white; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; font-size: 12px; font-weight: bold; line-height: 1; z-index:10;">✖</button>`;

    if (chatFileType.startsWith('video/')) {
        previewContainer.innerHTML = `<video src="${chatFilePreviewUrl}" style="max-height: 100px; border-radius: 5px; border: 1px solid #ddd;" muted></video>` + btnHTML;
    } else {
        previewContainer.innerHTML = `<img src="${chatFilePreviewUrl}" style="max-height: 100px; border-radius: 5px; border: 1px solid #ddd;">` + btnHTML;
    }
    previewContainer.style.display = 'inline-block';
}

function removeChatFile() {
    chatFileObj = null; 
    chatFileType = null; 
    chatFilePreviewUrl = null;
    document.getElementById('chat-image-preview-container').style.display = 'none';
    document.getElementById('chat-file-input').value = '';
}

function clearChat() {
    if(confirm("Czy na pewno chcesz wyczyścić historię rozmowy?")) {
        chatHistory = [];
        document.getElementById('chat-box').innerHTML = '<div style="text-align: center; color: #888; font-size: 13px; margin-bottom: 20px;">Początek nowej rozmowy.</div>';
    }
}

function appendChatBubble(role, text, fileSrc=null, fileType=null, id=null) {
    const box = document.getElementById('chat-box');
    const div = document.createElement('div');
    if(id) div.id = id;
    div.style.marginBottom = "15px"; 
    div.style.display = "flex"; 
    div.style.flexDirection = "column"; 
    div.style.alignItems = role === 'user' ? 'flex-end' : 'flex-start';

    let innerHTML = `<div style="max-width: 85%; padding: 12px 18px; border-radius: 15px; font-size: 15px; line-height: 1.5; ${role === 'user' ? 'background: #000; color: #fff; border-bottom-right-radius: 2px;' : 'background: #f4f9ff; color: #333; border-bottom-left-radius: 2px; border: 1px solid #cce0ff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);'}">`;
    
    if(fileSrc) {
        if(fileType && fileType.startsWith('video/')) {
            innerHTML += `<video src="${fileSrc}" style="max-width: 200px; border-radius: 8px; margin-bottom: 10px; display: block;" controls></video>`;
        } else {
            innerHTML += `<img src="${fileSrc}" style="max-width: 200px; border-radius: 8px; margin-bottom: 10px; display: block;">`;
        }
    }
    if(text) innerHTML += `<div>${text}</div>`;
    innerHTML += `</div>`;
    
    div.innerHTML = innerHTML;
    box.appendChild(div); 
    box.scrollTop = box.scrollHeight;
}

async function sendChatMessage() {
    const inputEl = document.getElementById('chat-input');
    let text = inputEl.value.trim();
    if(!text && !chatFileObj) return;

    appendChatBubble('user', text, chatFilePreviewUrl, chatFileType);

    let backendMessage = text;
    if (chatHistory.length === 0) {
        backendMessage = `KONTEKST MARKI WASSYL: \n${SHOP_CONTEXT}\n---\nPierwsza wiadomość:\n${text}`;
    }

    const formData = new FormData();
    formData.append('message', backendMessage);
    formData.append('history', JSON.stringify(chatHistory));
    if (chatFileObj) formData.append('file', chatFileObj);

    const historyTextToSave = chatHistory.length === 0 ? backendMessage : text;
    inputEl.value = ''; 
    removeChatFile();

    const loaderId = 'loader-' + Date.now();
    appendChatBubble('model', '<span class="loader" style="display:inline-block; margin:0; color:#555;">⏳ Analizuję (wideo potrwa do 30 sekund)...</span>', null, null, loaderId);

    try {
        const res = await fetch('/api/chat', { method: 'POST', body: formData });
        const data = await res.json();
        
        document.getElementById(loaderId).remove();
        
        if(data.error) {
            appendChatBubble('model', `❌ Wystąpił błąd: ${data.error}`);
        } else {
            appendChatBubble('model', formatMarkdown(data.result));
            let userEntry = { role: 'user', text: historyTextToSave };
            if(data.new_file) {
                userEntry.file_uri = data.new_file.file_uri;
                userEntry.mime_type = data.new_file.mime_type;
            }
            chatHistory.push(userEntry);
            chatHistory.push({ role: 'model', text: data.result });
        }
    } catch (e) {
        document.getElementById(loaderId).remove();
        appendChatBubble('model', `❌ Błąd sieci lub serwera: ${e}`);
    }
}