import os
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


# --- API: STUDIO FOTO (NANO BANANA 2) ---
@app.route('/api/generate_image', methods=['POST'])
def api_generate_image():
    try:
        # 1. Sprawdzamy, czy przeglądarka w ogóle przesłała plik
        if 'image' not in request.files:
            return jsonify({"success": False, "error": "Brak zdjęcia. Wgraj plik!"}), 400
            
        image_file = request.files['image']
        prompt_text = request.form.get('prompt')
        
        # 2. NAJWAŻNIEJSZA ZMIANA: Wczytujemy plik!
        # Wymuszamy na serwerze "odebranie paczki" do końca. 
        # Bez tego serwer zamknąłby połączenie za wcześnie.
        image_data = image_file.read()
        
        # Zamiast generować przez AI, zwracamy testowy obrazek zastępczy po udanym pobraniu
        mock_image_url = "https://via.placeholder.com/800x800.png?text=Sukces!+Plik+odebrany"
        
        return jsonify({
            "success": True, 
            "image_url": mock_image_url
        })
        
    except Exception as e:
        # Jeśli cokolwiek pójdzie nie tak (np. plik będzie uszkodzony), bezpiecznie zwracamy błąd
        return jsonify({"success": False, "error": str(e)}), 500
