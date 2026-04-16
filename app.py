import os
import io
import base64
import time
import requests
from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
from bs4 import BeautifulSoup
from PIL import Image

app = Flask(__name__)

# --- KONFIGURACJA ZMIENNYCH ŚRODOWISKOWYCH ---
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "").strip().replace('"', '').replace("'", "")
IDOSELL_DOMAIN = os.environ.get("IDOSELL_DOMAIN", "wassyl.pl").strip().replace('"', '').replace("'", "")
IDOSELL_KEY = os.environ.get("IDOSELL_API_KEY", "").strip().replace('"', '').replace("'", "")

if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)
    model = genai.GenerativeModel("gemini-2.5-flash")

# --- FUNKCJE POMOCNICZE ---
def generuj_tekst_ai(prompt):
    if not GEMINI_KEY: return "Błąd: Brak klucza API Gemini na serwerze."
    for proba in range(3):
        try:
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            if "429" in str(e) or "Quota" in str(e):
                if proba < 2:
                    time.sleep(30)
                    continue
            return f"Błąd API Gemini: {str(e)}"
    return "Błąd: Przekroczono limit prób API Gemini."

# --- ENDPOINTY API (Dla Frontendu) ---

@app.route('/')
def index():
    # Sprawdzamy status kluczy, by przekazać je do frontu
    status_idosell = bool(IDOSELL_DOMAIN and IDOSELL_KEY)
    return render_template('index.html', status_idosell=status_idosell, domena=IDOSELL_DOMAIN)

@app.route('/api/generate', methods=['POST'])
def api_generate():
    data = request.json
    prompt = data.get('prompt', '')
    wynik = generuj_tekst_ai(prompt)
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
        tekst = zupa.get_text(separator=" ", strip=True)[:5000]
        return jsonify({"text": tekst})
    except Exception as e:
        return jsonify({"text": "", "error": str(e)})

@app.route('/api/idosell/products', methods=['POST'])
def api_idosell_products():
    if not IDOSELL_DOMAIN or not IDOSELL_KEY:
        return jsonify({"error": "Brak konfiguracji API IdoSell"}), 400
    
    ids_str = request.json.get('ids', '')
    lista_id = [x.strip() for x in ids_str.split(",") if x.strip().isdigit()]
    if not lista_id: return jsonify({"products": []})

    url = f"https://{IDOSELL_DOMAIN}/api/admin/v7/products/products"
    headers = {"X-API-KEY": IDOSELL_KEY, "Accept": "application/json"}
    params = [("productIds", pid) for pid in lista_id]

    produkty = []
    try:
        res = requests.get(url, headers=headers, params=params, timeout=15)
        if res.status_code == 200:
            for prod in res.json().get("Results", []):
                pid = prod.get("productId")
                zdjecia = prod.get("productImages", [])
                url_zdjecia = ""
                if zdjecia:
                    url_zdjecia = zdjecia[0].get("productImageLargeUrl", "")
                    if url_zdjecia.startswith("//"): url_zdjecia = "https:" + url_zdjecia
                
                urls_data = prod.get("productUrl", {}).get("productUrlsLangData", [])
                url_produktu = urls_data[0].get("url", "") if urls_data else f"https://{IDOSELL_DOMAIN}/product-pol-{pid}.html"
                
                if url_zdjecia:
                    produkty.append({"id": str(pid), "url_produktu": url_produktu, "url_zdjecia": url_zdjecia})
        return jsonify({"products": produkty})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
        return jsonify({"status": res.status_code, "response": res.json()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
