import os
import io
import base64
import time
import re
import requests
import json
import tempfile
from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
from bs4 import BeautifulSoup
from PIL import Image

# Importy dla Google Drive
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    GOOGLE_API_AVAILABLE = True
except ImportError:
    GOOGLE_API_AVAILABLE = False

app = Flask(__name__)

# --- KONFIGURACJA ZMIENNYCH ŚRODOWISKOWYCH ---
surowy_klucz_gemini = os.environ.get("GEMINI_API_KEY", "")
GEMINI_KEY = re.sub(r'[^a-zA-Z0-9_\-]', '', surowy_klucz_gemini)

IDOSELL_DOMAIN = os.environ.get("IDOSELL_DOMAIN", "client5056.idosell.com").strip().replace('"', '').replace("'", "")
IDOSELL_KEY = os.environ.get("IDOSELL_API_KEY", "").strip().replace('"', '').replace("'", "")

if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)
    model = genai.GenerativeModel("gemini-2.5-flash")

# --- FUNKCJE POMOCNICZE ---
def generuj_tekst_ai(prompt, search=False):
    if not GEMINI_KEY: return "Błąd: Brak klucza API Gemini na serwerze."
    active_model = model
    
    if search:
        try:
            try:
                active_model = genai.GenerativeModel(model_name="gemini-2.5-flash", tools=[{"google_search": {}}])
            except:
                active_model = genai.GenerativeModel(model_name="gemini-2.5-flash")
        except Exception as e:
            return f"Błąd włączania wyszukiwarki. Szczegóły: {str(e)}"

    for proba in range(3):
        try:
            response = active_model.generate_content(prompt, request_options={"timeout": 120})
            return response.text
        except Exception as e:
            error_msg = str(e).lower()
            if "429" in error_msg or "quota" in error_msg or "504" in error_msg or "503" in error_msg or "timeout" in error_msg:
                if proba < 2:
                    time.sleep(15)
                    continue
            return f"Błąd API Gemini: {str(e)}"
    return "Błąd: Przekroczono limit prób API Gemini."

# --- ENDPOINTY API ---
@app.route('/')
def index():
    status_idosell = bool(IDOSELL_DOMAIN and IDOSELL_KEY)
    return render_template('index.html', status_idosell=status_idosell, domena=IDOSELL_DOMAIN)

@app.route('/api/generate', methods=['POST'])
def api_generate():
    data = request.json
    prompt = data.get('prompt', '')
    search_mode = data.get('search', False)
    wynik = generuj_tekst_ai(prompt, search=search_mode)
    return jsonify({"result": wynik})

# --- POPRAWIONY CZAT Z OBSŁUGĄ WIDEO I ZDJĘĆ ---
@app.route('/api/chat', methods=['POST'])
def api_chat():
    if not GEMINI_KEY: return jsonify({"error": "Brak klucza API Gemini na serwerze."}), 500

    # Odbieranie danych z formularza (FormData)
    message = request.form.get('message', '')
    history_json = request.form.get('history', '[]')
    
    try:
        # 1. Odtwarzanie historii czatu (z uwzględnieniem poprzednio przesłanych plików)
        history = json.loads(history_json)
        formatted_history = []
        for h in history:
            parts = []
            if 'file_uri' in h and 'mime_type' in h:
                parts.append({
                    "file_data": {
                        "mime_type": h['mime_type'],
                        "file_uri": h['file_uri']
                    }
                })
            if h.get('text'):
                parts.append({"text": h['text']})
            formatted_history.append({"role": h["role"], "parts": parts})

        chat = model.start_chat(history=formatted_history)
        contents = [message] if message else []
        
        # 2. Obsługa nowego pliku (Zdjęcie lub Wideo)
        uploaded_genai_file = None
        if 'file' in request.files:
            file = request.files['file']
            if file.filename != '':
                # Zapisujemy plik tymczasowo na serwerze
                temp_path = os.path.join(tempfile.gettempdir(), file.filename)
                file.save(temp_path)
                
                # Wysyłamy plik bezpiecznie do API Gemini
                uploaded_genai_file = genai.upload_file(path=temp_path)
                
                # BARDZO WAŻNE: Jeśli to wideo, musimy poczekać aż Google je przetworzy
                if uploaded_genai_file.mime_type.startswith('video/'):
                    while uploaded_genai_file.state.name == 'PROCESSING':
                        time.sleep(2)
                        uploaded_genai_file = genai.get_file(uploaded_genai_file.name)
                    if uploaded_genai_file.state.name == 'FAILED':
                        os.remove(temp_path)
                        return jsonify({"error": "Błąd przetwarzania wideo na serwerach Google."}), 500
                        
                contents.append(uploaded_genai_file)
                # Usuwamy plik tymczasowy z serwera
                os.remove(temp_path)

        # 3. Wysłanie zapytania do czatu
        response = chat.send_message(contents)
        
        # 4. Zwracamy URI pliku do frontendu, by przeglądarka zapamiętała go w historii rozmowy
        new_file_info = None
        if uploaded_genai_file:
            new_file_info = {
                "file_uri": uploaded_genai_file.uri,
                "mime_type": uploaded_genai_file.mime_type
            }
            
        return jsonify({"result": response.text, "new_file": new_file_info})
    except Exception as e:
        print(f"[DIAGNOSTYKA] Wyjątek w czacie: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/export_drive', methods=['POST'])
def api_export_drive():
    if not GOOGLE_API_AVAILABLE:
        return jsonify({"error": "Biblioteki Google (google-api-python-client) nie są zainstalowane na serwerze."}), 500
        
    data = request.json
    title = data.get('title', 'Eksport z AI Wassyl')
    content = data.get('content', '')
    
    creds_json = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    if not creds_json:
        return jsonify({"error": "Brak zmiennej GOOGLE_CREDENTIALS_JSON na platformie Render."}), 500
        
    try:
        creds_dict = json.loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(
            creds_dict, scopes=['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/documents']
        )
        
        docs_service = build('docs', 'v1', credentials=creds)
        doc = docs_service.documents().create(body={'title': title}).execute()
        document_id = doc.get('documentId')
        
        requests_body = [{'insertText': {'location': {'index': 1},'text': content}}]
        docs_service.documents().batchUpdate(documentId=document_id, body={'requests': requests_body}).execute()
            
        drive_service = build('drive', 'v3', credentials=creds)
        drive_service.permissions().create(fileId=document_id, body={'type': 'anyone', 'role': 'writer'}).execute()
        
        link = f"https://docs.google.com/document/d/{document_id}/edit"
        return jsonify({"success": True, "link": link})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/fetch_url', methods=['POST'])
def api_fetch_url():
    url = request.json.get('url', '')
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        zupa = BeautifulSoup(resp.text, "html.parser")
        for script in zupa(["script", "style"]): script.extract()
        return jsonify({"text": zupa.get_text(separator=" ", strip=True)[:5000]})
    except Exception as e:
        return jsonify({"text": "", "error": str(e)})

@app.route('/api/idosell/products', methods=['POST'])
def api_idosell_products():
    if not IDOSELL_DOMAIN or not IDOSELL_KEY:
        return jsonify({"error": "Brak konfiguracji API IdoSell w Render."}), 400
    
    ids_str = request.json.get('ids', '')
    lista_id = [x.strip() for x in ids_str.split(",") if x.strip().isdigit()]
    if not lista_id: return jsonify({"products": []})

    url = f"https://{IDOSELL_DOMAIN}/api/admin/v7/products/products"
    headers = {"X-API-KEY": IDOSELL_KEY, "Accept": "application/json"}
    params = {"productIds": ",".join(lista_id)}

    try:
        res = requests.get(url, headers=headers, params=params, timeout=15)
        if res.status_code != 200:
            return jsonify({"error": f"Błąd IdoSell {res.status_code}", "details": res.text}), 500

        dane = res.json()
        produkty = []
        for prod in dane.get("results", []):
            pid = prod.get("productId")
            nazwa = "Ubranie marki Wassyl"
            for opis in prod.get("productDescriptionsLangData", []):
                if opis.get("langId") == "pol":
                    nazwa = opis.get("productName", "")
                    break

            zdjecia = prod.get("productImages", [])
            url_zdjecia = ""
            if zdjecia:
                url_zdjecia = zdjecia[0].get("productImageLargeUrl", "")
                if url_zdjecia.startswith("//"): url_zdjecia = "https:" + url_zdjecia
            
            urls_data = prod.get("productUrl", {}).get("productUrlsLangData", [])
            url_produktu = urls_data[0].get("url", "") if urls_data else f"https://wassyl.pl/product-pol-{pid}.html"
            
            if url_zdjecia:
                produkty.append({"id": str(pid), "nazwa": nazwa, "url_produktu": url_produktu, "url_zdjecia": url_zdjecia})
        
        return jsonify({"products": produkty})
    except Exception as e:
        return jsonify({"error": "Błąd wewnętrzny Pythona", "details": str(e)}), 500

@app.route('/api/collage', methods=['POST'])
def api_collage():
    data = request.json
    lista_url = data.get('urls', [])
    doc_w = data.get('width', 1200)
    doc_h = data.get('height', 630)

    try:
        obrazy = []
        for u in lista_url:
            res = requests.get(u, stream=True, timeout=10)
            if res.status_code == 200:
                obrazy.append(Image.open(res.raw).convert("RGB"))
        if not obrazy: return jsonify({"error": "Nie udało się pobrać obrazów"})

        kolaz = Image.new("RGB", (doc_w, doc_h), (255, 255, 255))
        szer_poj = doc_w // len(obrazy)

        for i, img in enumerate(obrazy):
            img_ratio = img.width / img.height
            target_ratio = szer_poj / doc_h
            if img_ratio > target_ratio:
                new_h = doc_h
                new_w = int(new_h * img_ratio)
                img = img.resize((new_w, new_h), Image.LANCZOS)
                img = img.crop(((new_w - szer_poj)/2, 0, (new_w + szer_poj)/2, doc_h))
            else:
                new_w = szer_poj
                new_h = int(new_w / img_ratio)
                img = img.resize((new_w, new_h), Image.LANCZOS)
                img = img.crop((0, (new_h - doc_h)/2, szer_poj, (new_h + doc_h)/2))
            kolaz.paste(img, (i * szer_poj, 0))

        buffered = io.BytesIO()
        kolaz.save(buffered, format="JPEG", quality=85)
        b64 = base64.b64encode(buffered.getvalue()).decode()
        return jsonify({"collage": f"data:image/jpeg;base64,{b64}"})
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route('/api/idosell/publish', methods=['POST'])
def api_publish():
    payload = request.json.get("payload")
    url = f"https://{IDOSELL_DOMAIN}/api/admin/v7/entries/entries"
    headers = {"X-API-KEY": IDOSELL_KEY, "Content-Type": "application/json"}
    
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=30)
        try:
            return jsonify({"status": res.status_code, "response": res.json()})
        except Exception:
            return jsonify({"status": res.status_code, "response": {"raw_error": res.text}})
            
    except Exception as e:
        return jsonify({"error": "Błąd wewnętrzny Pythona", "details": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
