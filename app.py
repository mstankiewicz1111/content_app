import os
from flask import Flask, render_template, request, jsonify
import traceback
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


# --- API: STUDIO FOTO (NANO BANANA 2) ---
@app.route('/api/generate_image', methods=['POST'])
def api_generate_image():
    print(">>> [BACKEND] Otrzymano żądanie do /api/generate_image")
    try:
        print(f">>> [BACKEND] Nagłówki (Headers): {request.headers.get('Content-Type')}")
        
        # 1. Sprawdzamy, czy przesłano plik
        if 'image' not in request.files:
            print(">>> [BACKEND] Błąd: Brak pliku 'image' w paczce (request.files jest puste)")
            return jsonify({"success": False, "error": "Brak zdjęcia. Wgraj plik!"}), 400
            
        image_file = request.files['image']
        prompt_text = request.form.get('prompt')
        
        print(f">>> [BACKEND] Otrzymano plik. Nazwa: {image_file.filename}")
        print(f">>> [BACKEND] Długość prompta: {len(prompt_text) if prompt_text else 0} znaków")
        
        # 2. Próbujemy wczytać plik do pamięci
        print(">>> [BACKEND] Rozpoczynam wczytywanie pliku do pamięci serwera...")
        image_data = image_file.read()
        print(f">>> [BACKEND] Sukces! Wczytano {len(image_data)} bajtów.")
        
        mock_image_url = "https://via.placeholder.com/800x800.png?text=Sukces!+Backend+podlaczony"
        
        print(">>> [BACKEND] Zwracam odpowiedź JSON do przeglądarki.")
        return jsonify({
            "success": True, 
            "image_url": mock_image_url
        })
        
    except Exception as e:
        print(f">>> [BACKEND] KRYTYCZNY BŁĄD W PYTHONIE: {str(e)}")
        traceback.print_exc()  # Wypisze na konsoli serwera bardzo dokładny ślad błędu
        return jsonify({"success": False, "error": str(e)}), 500
