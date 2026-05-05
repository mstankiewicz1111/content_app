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


# --- API: STUDIO FOTO (PRAWDZIWE POŁĄCZENIE Z GEMINI) ---
@app.route('/api/generate_image', methods=['POST'])
def api_generate_image():
    print(">>> [BACKEND] Otrzymano żądanie do /api/generate_image")
    try:
        # 1. Sprawdzenie i odbiór pliku
        if 'image' not in request.files:
            return jsonify({"success": False, "error": "Brak zdjęcia. Wgraj plik!"}), 400
            
        image_file = request.files['image']
        prompt_text = request.form.get('prompt')
        
        # Pobieramy format pliku (np. image/jpeg lub image/png), co jest wymagane przez Gemini
        mime_type = image_file.mimetype or "image/jpeg"
        
        # 2. Konwersja zdjęcia do formatu Base64 (ciąg znaków tekstowych)
        image_data = image_file.read()
        base64_image = base64.b64encode(image_data).decode('utf-8')
        print(">>> [BACKEND] Zdjęcie poprawnie zakodowane do Base64.")
        
        # 3. POBRANIE KLUCZA Z SERWERA RENDER
        # Zmienna "GEMINI_API_KEY" jest bezpiecznie zaszyta w panelu Render
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return jsonify({"success": False, "error": "Brak klucza GEMINI_API_KEY na serwerze!"}), 500

        # 4. ADRES URL (ENDPOINT) DO GEMINI
        # Zgodnie z dokumentacją korzystamy z modelu "gemini-3-flash-image"
        # Klucz API dodajemy na końcu adresu za pomocą "?key="
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-image:generateContent?key={api_key}"
        
        headers = {
            "Content-Type": "application/json"
        }
        
        # 5. BUDOWA PACZKI DANYCH (PAYLOAD)
        # Tworzymy strukturę wymaganą przez Gemini. Przekazujemy zarówno tekst, jak i obraz.
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt_text},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": base64_image
                            }
                        }
                    ]
                }
            ]
        }
        
        print(">>> [BACKEND] Wysyłam żądanie do sztucznej inteligencji. Czekam na odpowiedź...")
        
        # 6. WYSŁANIE ZAPYTANIA
        # Program zatrzyma się tutaj na kilka/kilkanaście sekund, czekając aż AI wygeneruje obraz
        response = requests.post(api_url, headers=headers, json=payload)
        response_data = response.json()
        
        # Jeśli API zwróci błąd (np. zły klucz lub blokada bezpieczeństwa)
        if response.status_code != 200:
            error_message = response_data.get("error", {}).get("message", "Nieznany błąd API")
            print(f">>> [BACKEND] Błąd API Gemini: {error_message}")
            return jsonify({"success": False, "error": f"Błąd Gemini: {error_message}"}), 500
            
        print(">>> [BACKEND] Sukces! Otrzymano odpowiedź z API.")
        
        # 7. WYDOBYCIE ZDJĘCIA Z ODPOWIEDZI
        # Modele graficzne często zwracają wynik jako tekstowy kod Base64 nowego zdjęcia.
        # Odczytujemy ten kod z odpowiedzi JSON. (Dokładna ścieżka zależy od specyfikacji API, 
        # tu korzystamy ze standardowego zwrotu części 'inline_data' lub 'text').
        try:
            # Próbujemy wyciągnąć zakodowany obraz wygenerowany przez AI
            generated_base64 = response_data['candidates'][0]['content']['parts'][0]['text'] 
            # UWAGA: Jeśli model zwraca dane w polu 'inline_data', użyjemy innej ścieżki.
            
            # Tworzymy specjalny URL typu "data:image...", który przeglądarka potrafi 
            # zinterpretować i wyświetlić bezpośrednio jako zdjęcie.
            final_image_url = f"data:image/jpeg;base64,{generated_base64.strip()}"
            
        except (KeyError, IndexError) as e:
            # Gdyby format odpowiedzi był nietypowy, logujemy błąd.
            print(f">>> [BACKEND] Błąd przetwarzania struktury odpowiedzi Gemini: {e}")
            return jsonify({"success": False, "error": "AI nie zwróciło poprawnego formatu obrazu."}), 500

        # Wysyłamy finalny adres obrazka do przeglądarki!
        return jsonify({
            "success": True, 
            "image_url": final_image_url
        })
        
    except Exception as e:
        print(f">>> [BACKEND] KRYTYCZNY BŁĄD W PYTHONIE: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
