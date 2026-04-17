import os
import io
import base64
import time
import re
import requests
import json
from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
from bs4 import BeautifulSoup
from PIL import Image

app = Flask(__name__)

# --- KONFIGURACJA ZMIENNYCH ŚRODOWISKOWYCH ---
surowy_klucz_gemini = os.environ.get("GEMINI_API_KEY", "")
GEMINI_KEY = re.sub(r'[^a-zA-Z0-9_\-]', '', surowy_klucz_gemini)

IDOSELL_DOMAIN = os.environ.get("IDOSELL_DOMAIN", "client5056.idosell.com").strip().replace('"', '').replace("'", "")
IDOSELL_KEY = os.environ.get("IDOSELL_API_KEY", "").strip().replace('"', '').replace("'", "")

if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)
    # Model standardowy do tekstów
    model = genai.GenerativeModel("gemini-2.5-flash")
    
    # POPRAWKA: Prawidłowy sposób włączenia Google Search w Pythonie (bez słownika)
    model_search = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        tools="google_search_retrieval"
    )

# --- FUNKCJE POMOCNICZE ---
# NOWOŚĆ: Dodano parametr search=False
def generuj_tekst_ai(prompt, search=False):
    if not GEMINI_KEY: return "Błąd: Brak klucza API Gemini na serwerze."
    
    # Wybór modelu w zależności od tego, czy żądamy wyszukiwania
    active_model = model_search if search else model
    
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
    # NOWOŚĆ: Odczytujemy, czy front prosi o użycie wyszukiwarki
    search_mode = data.get('search', False)
    wynik = generuj_tekst_ai(prompt, search=search_mode)
    return jsonify({"result": wynik})

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

    print(f"[DIAGNOSTYKA] Pobieranie produktów. URL: {url}, Params: {params}")

    try:
        res = requests.get(url, headers=headers, params=params, timeout=15)
        print(f"[DIAGNOSTYKA] Kod odpowiedzi IdoSell (Produkty): {res.status_code}")
        
        if res.status_code != 200:
            print(f"[DIAGNOSTYKA] Błąd IdoSell: {res.text}")
            return jsonify({"error": f"Błąd IdoSell {res.status_code}", "details": res.text}), 500

        dane = res.json()
        produkty = []
        for prod in dane.get("results", []):
            pid = prod.get("productId")
            
            # Pobieranie polskiej nazwy
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
        
        print(f"[DIAGNOSTYKA] Znaleziono produktów: {len(produkty)}")
        return jsonify({"products": produkty})
    
    except Exception as e:
        print(f"[DIAGNOSTYKA] Wyjątek Python (Produkty): {str(e)}")
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
    
    print(f"[DIAGNOSTYKA] Wysyłka wpisu. URL: {url}")
    
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=30)
        print(f"[DIAGNOSTYKA] Kod odpowiedzi IdoSell (Publish): {res.status_code}")
        
        try:
            return jsonify({"status": res.status_code, "response": res.json()})
        except Exception:
            return jsonify({"status": res.status_code, "response": {"raw_error": res.text}})
            
    except Exception as e:
        print(f"[DIAGNOSTYKA] Wyjątek Python (Publish): {str(e)}")
        return jsonify({"error": "Błąd wewnętrzny Pythona", "details": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
