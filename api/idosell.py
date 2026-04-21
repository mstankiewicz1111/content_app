import os
import requests
from flask import Blueprint, request, jsonify

idosell_bp = Blueprint('idosell', __name__)

def get_idosell_config():
    domain = os.environ.get("IDOSELL_DOMAIN", "client5056.idosell.com").strip().replace('"', '').replace("'", "")
    api_key = os.environ.get("IDOSELL_API_KEY", "").strip().replace('"', '').replace("'", "")
    return domain, api_key

@idosell_bp.route('/products', methods=['POST'])
def api_idosell_products():
    domain, api_key = get_idosell_config()
    if not domain or not api_key:
        return jsonify({"error": "Brak konfiguracji API IdoSell w Render."}), 400
    
    ids_str = request.json.get('ids', '')
    lista_id = [x.strip() for x in ids_str.split(",") if x.strip().isdigit()]
    if not lista_id: return jsonify({"products": []})

    url = f"https://{domain}/api/admin/v7/products/products"
    headers = {"X-API-KEY": api_key, "Accept": "application/json"}
    params = {"productIds": ",".join(lista_id)}

    try:
        res = requests.get(url, headers=headers, params=params, timeout=15)
        if res.status_code != 200:
            return jsonify({"error": f"Błąd IdoSell {res.status_code}", "details": res.text}), 500

        dane = res.json()
        if "results" in dane:
            return jsonify({"results": dane["results"]})
            
        return jsonify({"products": []})
    except Exception as e:
        return jsonify({"error": "Błąd wewnętrzny Pythona", "details": str(e)}), 500

@idosell_bp.route('/publish', methods=['POST'])
def api_publish():
    domain, api_key = get_idosell_config()
    payload = request.json.get("payload")
    url = f"https://{domain}/api/admin/v7/entries/entries"
    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
    
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=30)
        try:
            return jsonify({"status": res.status_code, "response": res.json()})
        except Exception:
            return jsonify({"status": res.status_code, "response": {"raw_error": res.text}})
    except Exception as e:
        return jsonify({"error": "Błąd wewnętrzny Pythona", "details": str(e)}), 500

# ZAKTUALIZOWANY ENDPOINT - Zastosowano poprawny Payload wyśledzony przez Ciebie
@idosell_bp.route('/update_product', methods=['POST'])
def api_update_product():
    domain, api_key = get_idosell_config()
    if not domain or not api_key:
        return jsonify({"success": False, "error": "Brak konfiguracji API"}), 400

    data = request.json
    prod_id = data.get("id")
    new_name = data.get("name")
    new_desc = data.get("long_description")

    if not prod_id or not new_name or not new_desc:
        return jsonify({"success": False, "error": "Brakujące dane do aktualizacji"}), 400

    url = f"https://{domain}/api/admin/v7/products/products"
    headers = {
        "X-API-KEY": api_key, 
        "Content-Type": "application/json", 
        "Accept": "application/json"
    }
    
    # STRUKTURA "params" Z TWOJEGO TESTU
    payload = {
        "params": {
            "products": [
                {
                    "productId": int(prod_id),
                    "productLongDescriptions": {
                        "productLongDescriptionsLangData": [
                            {
                                "langId": "pol",
                                "productLongDescription": new_desc
                            }
                        ]
                    },
                    "productNames": {
                        "productNamesLangData": [
                            {
                                "langId": "pol",
                                "productName": new_name
                            }
                        ]
                    }
                }
            ]
        }
    }

    try:
        res = requests.put(url, headers=headers, json=payload, timeout=20)
        
        try:
            response_data = res.json()
        except:
            response_data = {"raw_text": res.text}

        if res.status_code in [200, 204, 207]:
            # Sprawdzenie w poszukiwaniu ukrytych błędów wewnątrz paczki
            if "products" in response_data:
                for p in response_data["products"]:
                    if "errors" in p and p["errors"]:
                        return jsonify({"success": False, "error": f"Błąd zapisu w IdoSell: {p['errors']}"}), 200
            
            return jsonify({"success": True, "response": response_data})
        else:
            return jsonify({"success": False, "error": f"Błąd HTTP {res.status_code}", "details": response_data}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

import xml.etree.ElementTree as ET

# 1. ENDPOINT: AUTO-DOBÓR PRODUKTÓW Z XML
@idosell_bp.route('/auto_products', methods=['POST'])
def api_auto_products():
    data = request.json
    topic = data.get("topic", "")
    
    # TUTAJ WKLEJ LINK DO SWOJEGO FEEDU XML (np. Google Shopping XML z IdoSell)
    xml_url = os.environ.get("WASSYL_XML_FEED", "https://wassyl.pl/Twoj_Feed_XML.xml") 
    
    try:
        # Pobieramy feed XML
        res = requests.get(xml_url, timeout=15)
        if res.status_code != 200:
            return jsonify({"error": "Nie udało się pobrać pliku XML"}), 500
            
        root = ET.fromstring(res.content)
        products_pool = []
        
        # Przykładowe parsowanie standardowego feedu (dostosuj tagi do swojego XML)
        # Zakładamy strukturę <item> -> <g:id> oraz <title>
        namespace = {'g': 'http://base.google.com/ns/1.0'}
        for item in root.findall('.//item')[:100]: # Bierzemy pierwsze 100 (np. nowości)
            item_id = item.find('g:id', namespace)
            title = item.find('title')
            
            # Fallback jeśli brak namespace'a
            if item_id is None: item_id = item.find('id')
            
            if item_id is not None and title is not None:
                products_pool.append(f"ID: {item_id.text}, Nazwa: {title.text}")
                
        return jsonify({"products": products_pool})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 2. ZAKTUALIZOWANY ENDPOINT PUBLIKACJI BLOGA
@idosell_bp.route('/publish_blog', methods=['POST'])
def api_publish_blog():
    domain, api_key = get_idosell_config()
    data = request.json
    
    # Format wymagany przez API IdoSell dla wpisów blogowych (entries)
    payload = {
        "entries": [
            {
                "blogId": 1, # Upewnij się, że to poprawne ID Twojego bloga w IdoSell
                "entryTitles": {"pol": data.get("title", "Nowy wpis")},
                "entryShortDescriptions": {"pol": data.get("lead", "")},
                "entryLongDescriptions": {"pol": data.get("content", "")},
                "entryIsActive": "n" # Publikujemy jako szkic/nieaktywne
            }
        ]
    }
    
    url = f"https://{domain}/api/admin/v7/entries/entries"
    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
    
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=30)
        response_data = res.json()
        
        if res.status_code in [200, 204, 207]:
            return jsonify({"success": True, "response": response_data})
        else:
            return jsonify({"success": False, "error": f"Odrzucono: {res.status_code}", "details": response_data}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
