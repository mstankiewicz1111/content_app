import os
from flask import Flask, render_template

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

if __name__ == '__main__':
    app.run(debug=True, port=5000)

# --- API: STUDIO FOTO (NANO BANANA 2) ---
@app.route('/api/generate_image', methods=['POST'])
def api_generate_image():
    # 1. Sprawdzamy, czy w ogóle przesłano plik
    if 'image' not in request.files:
        return jsonify({"success": False, "error": "Brak zdjęcia. Wgraj plik!"}), 400
        
    image_file = request.files['image']
    prompt_text = request.form.get('prompt')
    
    # 2. Tutaj w przyszłości podepniemy właściwe połączenie z API modelu (Nano Banana 2 / Gemini Flash Image).
    # Na ten moment tworzymy w pełni działającą "zaślepkę", aby upewnić się, 
    # że interfejs w przeglądarce poprawnie reaguje na odpowiedź z serwera.
    
    try:
        # Zamiast generować przez AI, zwracamy testowy obrazek zastępczy po udanym połączeniu
        mock_image_url = "https://via.placeholder.com/800x800.png?text=Sukces!+Backend+podlaczony"
        
        return jsonify({
            "success": True, 
            "image_url": mock_image_url
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
