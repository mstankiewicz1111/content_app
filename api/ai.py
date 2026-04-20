import os
import json
import time
import tempfile
import re
from flask import Blueprint, request, jsonify
import google.generativeai as genai
from PIL import Image
import io
import base64
import requests

ai_bp = Blueprint('ai', __name__)

# Konfiguracja klucza Gemini
surowy_klucz_gemini = os.environ.get("GEMINI_API_KEY", "")
GEMINI_KEY = re.sub(r'[^a-zA-Z0-9_\-]', '', surowy_klucz_gemini)

if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)
    model = genai.GenerativeModel("gemini-2.5-flash")

@ai_bp.route('/generate', methods=['POST'])
def api_generate():
    if not GEMINI_KEY: return jsonify({"result": "Błąd: Brak klucza API Gemini."})
    
    data = request.json
    prompt = data.get('prompt', '')
    search_mode = data.get('search', False)
    
    # NOWOŚĆ: Odbieramy URL zdjęcia z JS
    image_url = data.get('image_url', None) 
    
    active_model = model
    if search_mode:
        try:
            try:
                active_model = genai.GenerativeModel(model_name="gemini-2.5-flash", tools=[{"google_search": {}}])
            except:
                active_model = genai.GenerativeModel(model_name="gemini-2.5-flash")
        except Exception as e:
            return jsonify({"result": f"Błąd włączania wyszukiwarki: {str(e)}"})

    # NOWOŚĆ: Tworzymy listę (ładunek), do której trafi i tekst, i ewentualnie zdjęcie
    contents = [prompt]
    
    if image_url:
        try:
            # Pobieramy zdjęcie ze sklepu IdoSell
            img_res = requests.get(image_url, timeout=10)
            if img_res.status_code == 200:
                mime_type = img_res.headers.get('Content-Type', 'image/jpeg')
                # Doklejamy binarne dane obrazu do ładunku dla Gemini
                contents.append({
                    "mime_type": mime_type,
                    "data": img_res.content
                })
        except Exception as e:
            print(f"Ostrzeżenie: Nie udało się pobrać zdjęcia do analizy ({str(e)})")
            # W przypadku błędu Gemini i tak wygeneruje opis na podstawie samego tekstu

    for proba in range(3):
        try:
            # Przekazujemy listę 'contents' zamiast samego stringa 'prompt'
            response = active_model.generate_content(contents, request_options={"timeout": 120})
            return jsonify({"result": response.text})
        except Exception as e:
            error_msg = str(e).lower()
            if "429" in error_msg or "quota" in error_msg or "504" in error_msg or "503" in error_msg or "timeout" in error_msg:
                if proba < 2:
                    time.sleep(15)
                    continue
            return jsonify({"result": f"Błąd API Gemini: {str(e)}"})
            
    return jsonify({"result": "Błąd: Przekroczono limit prób API Gemini."})

@ai_bp.route('/chat', methods=['POST'])
def api_chat():
    if not GEMINI_KEY: return jsonify({"error": "Brak klucza API Gemini."}), 500

    message = request.form.get('message', '')
    history_json = request.form.get('history', '[]')
    
    try:
        history = json.loads(history_json)
        formatted_history = []
        for h in history:
            parts = []
            if 'file_uri' in h and 'mime_type' in h:
                parts.append({"file_data": {"mime_type": h['mime_type'], "file_uri": h['file_uri']}})
            if h.get('text'):
                parts.append({"text": h['text']})
            formatted_history.append({"role": h["role"], "parts": parts})

        chat = model.start_chat(history=formatted_history)
        contents = [message] if message else []
        
        uploaded_genai_file = None
        if 'file' in request.files:
            file = request.files['file']
            if file.filename != '':
                temp_path = os.path.join(tempfile.gettempdir(), file.filename)
                file.save(temp_path)
                try:
                    uploaded_genai_file = genai.upload_file(path=temp_path)
                    if uploaded_genai_file.mime_type.startswith('video/'):
                        while uploaded_genai_file.state.name == 'PROCESSING':
                            time.sleep(2)
                            uploaded_genai_file = genai.get_file(uploaded_genai_file.name)
                        if uploaded_genai_file.state.name == 'FAILED':
                            os.remove(temp_path)
                            return jsonify({"error": "Błąd przetwarzania wideo na serwerach Google."}), 500
                    contents.append(uploaded_genai_file)
                except AttributeError:
                    os.remove(temp_path)
                    return jsonify({"error": "Serwer korzysta ze starej wersji biblioteki Google (potrzebne google-generativeai>=0.8.0)."}), 500
                except Exception as upload_err:
                    os.remove(temp_path)
                    return jsonify({"error": f"Nie udało się przesłać pliku do Google: {str(upload_err)}"}), 500
                os.remove(temp_path)

        response = chat.send_message(contents)
        
        new_file_info = None
        if uploaded_genai_file:
            new_file_info = {"file_uri": uploaded_genai_file.uri, "mime_type": uploaded_genai_file.mime_type}
            
        return jsonify({"result": response.text, "new_file": new_file_info})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
