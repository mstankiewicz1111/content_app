import os
import base64
import requests
import traceback

from flask import Flask, render_template, request, jsonify

# Import naszych nowych, zmodularyzowanych ścieżek
from api.ai import ai_bp
from api.idosell import idosell_bp
from api.tools import tools_bp

app = Flask(__name__)

# Rejestracja modułów
app.register_blueprint(ai_bp, url_prefix='/api')
app.register_blueprint(idosell_bp, url_prefix='/api/idosell')
app.register_blueprint(tools_bp, url_prefix='/api')

@app.route('/')
def index():
    # Sprawdzamy status konfiguracji sklepu
    domain = os.environ.get("IDOSELL_DOMAIN", "client5056.idosell.com").strip().replace('"', '').replace("'", "")
    api_key = os.environ.get("IDOSELL_API_KEY", "").strip().replace('"', '').replace("'", "")
    status_idosell = bool(domain and api_key)
    
    return render_template('index.html', status_idosell=status_idosell, domena=domain)


# --- API: STUDIO FOTO (PRAWDZIWE POŁĄCZENIE Z AI) ---
@app.route('/api/generate_image', methods=['POST'])
def api_generate_image():
    print(">>> [BACKEND] Otrzymano żądanie do /api/generate_image")
    try:
        # 1. Sprawdzenie i odbiór pliku
        if 'image' not in request.files:
            return jsonify({"success": False, "error": "Brak zdjęcia. Wgraj plik!"}), 400
            
        image_file = request.files['image']
        prompt_text = request.form.get('prompt')
        
        # 2. Wczytanie i konwersja zdjęcia do formatu Base64 (wymagane przez większość API AI)
        image_data = image_file.read()
        base64_image = base64.b64encode(image_data).decode('utf-8')
        print(">>> [BACKEND] Zdjęcie poprawnie zakodowane do Base64.")
        
        # 3. WYSYŁKA DO PRAWDZIWEGO API AI
        # UWAGA: Poniższy blok to standardowy szablon. Musisz wpisać tu swój klucz API
        # oraz adres (endpoint) dostawcy, z którego usług korzystasz.
        
        api_key = os.environ.get("AI_IMAGE_API_KEY", "TUTAJ_WKLEJ_SWOJ_KLUCZ")
        api_url = "TUTAJ_ADRES_API_DOSTAWCY" # np. adres API Google Gemini / Vertex AI
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "prompt": prompt_text,
            "image_base64": base64_image
            # Format payloadu zależy ściśle od dokumentacji wybranego modelu AI!
        }
        
        print(">>> [BACKEND] Wysyłam żądanie do sztucznej inteligencji. Proszę czekać...")
        
        # ODKOMENTUJ PONIŻSZE LINIE, GDY WPISZESZ POPRAWNE DANE API:
        # response = requests.post(api_url, headers=headers, json=payload)
        # response_data = response.json()
        # final_image_url = response_data.get('url_do_wygenerowanego_zdjecia')
        
        # Na czas testów kodu nadal zwracamy logo, dopóki nie wpiszesz kluczy:
        final_image_url = "https://wassyl.pl/data/gfx/mask/pol/logo_1_big.svg"
        
        print(">>> [BACKEND] Sukces! Otrzymano odpowiedź z API.")
        return jsonify({
            "success": True, 
            "image_url": final_image_url
        })
        
    except Exception as e:
        print(f">>> [BACKEND] KRYTYCZNY BŁĄD W PYTHONIE: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
