import os
import json
import time
import tempfile
import re
import random
import xml.etree.ElementTree as ET
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

# --- PROMPT SYSTEMOWY MIRANDY ---
MIRANDA_SYSTEM_PROMPT = """
Jesteś Miranda, Dyrektor Kreatywna marki modowej WASSYL (streetwear, Gen Z, Millenialsi). 
Twoim zadaniem jest ocena pomysłów i wsparcie w e-commerce.

Twój profil i zasady:
1. Ton głosu: Bezpośrednia, bardzo wymagająca, profesjonalna, czasem odrobinę cyniczna (jak Miranda Priestly, ale w realiach nowoczesnego e-commerce). Jesteś piekielnie inteligentna i znasz się na rzeczy. Mówisz krótko, konkretnie i bez owijania w bawełnę.
2. Chłodna aprobata (ZAMIAST słodkiego entuzjazmu): Jesteś sprawiedliwa, ale nie bywasz wylewna. Nigdy nie używaj wykrzykników z zachwytu ani słów typu: "Fantastycznie!", "Wspaniale!", "Cieszę się!". Jeśli pomysł jest dobry, pochwal go w swoim chłodnym stylu, np.: "Zaskakująco sensowne", "Nie jest to najgorszy pomysł, jaki dziś usłyszałam", "Ma to potencjał, nie zepsujmy tego", "Dobrze, zróbmy to".
3. Krytyka i Analiza Ryzyka: Oceniasz pomysły surowo, ale obiektywnie. Jeśli pomysł jest słaby, wypunktuj jego luki bez litości (logistyka, koszty, brak spójności z marką). Jeśli pomysł jest DOBRY, zamiast szukać dziury w całym, wskaż 1-2 ryzyka biznesowe, na które zespół musi uważać podczas wdrożenia.
4. Konstruktywne ulepszanie: Nie sztuką jest tylko krytykować. Jeśli pomysł jest zły, krótko zaproponuj tańszą/lepszą alternatywę. Jeśli pomysł jest dobry, dorzuć od siebie jeden ekspercki "twist", który podniesie konwersję (np. sprytne wykorzystanie User Generated Content, optymalizacja pod algorytmy TikToka, cross-selling).
"""

if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)
    # Zwykły model (zostawiamy go, żeby nie psuć endpointu /generate)
    model = genai.GenerativeModel("gemini-2.5-flash") 
    
    # NOWOŚĆ: Model z wgraną osobowością Mirandy
    miranda_model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=MIRANDA_SYSTEM_PROMPT
    )

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

        chat = miranda_model.start_chat(history=formatted_history)
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


# =====================================================================
# NOWOŚĆ: INTELIGENTNY CROSS-SELLING (SHOP THE LOOK)
# =====================================================================
@ai_bp.route('/cross_sell_proposals', methods=['POST'])
def api_cross_sell_proposals():
    data = request.json
    base_id = str(data.get('base_product_id', '')).strip()
    exclude_ids = [str(x) for x in data.get('exclude_ids', [])]

    # Pobieramy link do XML tak samo, jak robiłeś to w idosell.py!
    XML_FEED_URL = os.environ.get("WASSYL_XML_FEED", "https://wassyl.pl/data/export/feed10015_1b9e5511234776450ad2740f.xml").strip()

    try:
        # 1. Pobieranie i parsowanie pliku XML
        response = requests.get(XML_FEED_URL, timeout=15)
        if response.status_code != 200:
            return jsonify({"success": False, "error": f"Błąd pobierania XML ze sklepu (kod: {response.status_code})"})
            
        root = ET.fromstring(response.content)

        all_products = []
        base_product = None
        namespaces = {'g': 'http://base.google.com/ns/1.0'} 

        # 2. Przeszukiwanie bazy
        for item in root.findall('.//item'):
            # Wyciąganie ID
            p_id_node = item.find('g:id', namespaces)
            if p_id_node is None:
                p_id_node = item.find('id')
            p_id = p_id_node.text if p_id_node is not None else ""

            # Wyciąganie nazwy
            title_node = item.find('g:title', namespaces)
            if title_node is None:
                title_node = item.find('title')
            title = title_node.text if title_node is not None else ""

            # Wyciąganie zdjęcia
            image_node = item.find('g:image_link', namespaces)
            image_url = image_node.text if image_node is not None else ""

            # Wykluczenie "k01" (zgodnie z Twoimi wytycznymi)
            if "k01" in title.lower():
                continue

            prod_data = {"id": p_id.strip(), "name": title.strip(), "image_url": image_url}

            # Szukamy naszego produktu bazowego
            if p_id.strip() == base_id:
                base_product = prod_data
            # Zbieramy pozostałe (omijając te, które już odrzuciliśmy/zaakceptowaliśmy na froncie)
            elif p_id.strip() not in exclude_ids and p_id.strip():
                all_products.append(prod_data)

        if not base_product:
            return jsonify({"success": False, "error": f"Nie znaleziono produktu o ID {base_id} w pliku XML. Upewnij się, że nie zawiera dopisku 'k01' i jest aktywny w feedzie."})

        # 3. Zasilanie AI danymi
        # Dajemy modelowi pulę np. 600 losowych produktów do analizy
        random.shuffle(all_products)
        candidates = all_products[:600] 
        candidates_text = "\n".join([f"ID: {p['id']} | Nazwa: {p['name']}" for p in candidates])

        # 4. Prompt z Twoimi złotymi regułami
        prompt = f"""
        Jesteś ekspertem ds. Visual Merchandisingu i cross-sellingu w sklepie modowym WASSYL.
        Produkt bazowy dodany właśnie przez klientkę do koszyka to: 
        Nazwa: "{base_product['name']}" (ID: {base_product['id']})

        Twoim zadaniem jest wybranie z poniższej listy kandydatów MAKSYMALNIE 8 idealnie pasujących produktów.
        Musisz wywnioskować z nazwy bazowej jej KATEGORIĘ (np. bluza, sukienka, komplet) oraz KOLOR, a następnie
        bezwzględnie zastosować się do poniższych reguł doboru:

        REGUŁY DOBORU:
        - Jeśli Bluza: szukaj spodni w tym samym kolorze (2 szt.), spodni czarnych (1 szt.), szortów w tym samym kolorze (2 szt.), szortów czarnych (1 szt.), bluzki białej (1 szt.), bluzki czarnej (1 szt.).
        - Jeśli Komplet bluzka + spodnie: szukaj szortów w tym samym kolorze (2 szt.), bluzy w tym samym kolorze (2 szt.), bluzy czarnej (1 szt.), bluzy szarej (1 szt.), bluzki białej (1 szt.), bluzki czarnej (1 szt.).
        - Jeśli Komplet bluza + spodnie: szukaj szortów w tym samym kolorze (2 szt.), szortów czarnych (1 szt.), bluzki białej (1 szt.), bluzki czarnej (1 szt.), bluzy czarnej (1 szt.), bluzy szarej (1 szt.), spodni czarnych (1 szt.).
        - Jeśli Bluzka, T-shirt lub Top: szukaj szortów w tym samym kolorze (2 szt.), szortów czarnych (1 szt.), spódnicy w tym samym kolorze (1 szt.), spódnicy czarnej (2 szt.), spodni w tym samym kolorze (2 szt.), spodni czarnych (1 szt.), bluzy czarnej (1 szt.).
        - Jeśli Sukienka: szukaj bluzki białej (1 szt.), bluzki czarnej (1 szt.), bluzy w tym samym kolorze (2 szt.), bluzy czarnej (1 szt.), spódnicy w tym samym kolorze (1 szt.), spódnicy czarnej (2 szt.), kurtki dowolnej (1 szt.), płaszcza dowolnego (1 szt.), marynarki dowolnej (1 szt.).
        - Jeśli Spodnie: szukaj bluzki białej (1 szt.), bluzki czarnej (1 szt.), bluzki w tym samym kolorze (2 szt.), bluzy w tym samym kolorze (2 szt.), bluzy czarnej (1 szt.), bluzy szarej (1 szt.), szortów w tym samym kolorze (1 szt.), szortów czarnych (1 szt.), kurtki dowolnej (1 szt.), płaszcza dowolnego (1 szt.).
        - Jeśli Szorty: szukaj bluzki białej (1 szt.), bluzki czarnej (1 szt.), bluzki w tym samym kolorze (2 szt.), bluzy w tym samym kolorze (2 szt.), bluzy czarnej (1 szt.), bluzy szarej (1 szt.), spodni w tym samym kolorze (1 szt.), spodni czarnych (1 szt.), szortów czarnych (1 szt.).
        - Jeśli Spódnica: szukaj bluzki białej (1 szt.), bluzki czarnej (1 szt.), bluzki w tym samym kolorze (2 szt.), bluzy w tym samym kolorze (2 szt.), bluzy czarnej (1 szt.), bluzy szarej (1 szt.), kurtki dowolnej (1 szt.), płaszcza dowolnego (1 szt.), marynarki dowolnej (1 szt.).
        - Jeśli Kurtka, Płaszcz lub Marynarka: szukaj bluzki białej (1 szt.), bluzki czarnej (1 szt.), bluzy czarnej (1 szt.), bluzy szarej (1 szt.), spodni w tym samym kolorze (2 szt.), spodni czarnych (1 szt.), spodni szarych (1 szt.).

        Oto kandydaci dostępni w magazynie:
        {candidates_text}

        ZWRÓĆ WYŁĄCZNIE CZYSTY KOD JSON (tablicę ID wybranych produktów). Żadnego markdowna, żadnych komentarzy.
        Przykład poprawnej odpowiedzi:
        ["1122", "3344", "5566"]
        """

        # Używamy standardowego modelu (bo chcemy czystego JSONa, a nie rozmowy z Mirandą)
        ai_response = model.generate_content(prompt, request_options={"timeout": 120})
        
        # Oczyszczanie wyniku i konwersja na listę JSON
        raw_json = ai_response.text.replace('```json', '').replace('```', '').strip()
        selected_ids = json.loads(raw_json)

        # Dopasowanie wybranych przez AI ID do ich pełnych obiektów ze zdjęciem
        proposals = [p for p in all_products if p['id'] in selected_ids]

        return jsonify({
            "success": True,
            "base_product_name": base_product['name'],
            "proposals": proposals
        })

    except json.JSONDecodeError:
        return jsonify({"success": False, "error": "AI nie zwróciło poprawnego formatu JSON z listą ID."})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)})
