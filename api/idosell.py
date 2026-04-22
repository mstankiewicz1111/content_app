import os
import requests
import random
import xml.etree.ElementTree as ET
from datetime import datetime
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


@idosell_bp.route('/publish_blog', methods=['POST'])
def api_publish_blog():
    domain, api_key = get_idosell_config()
    data = request.json
    
    title = data.get("title", "Nowy wpis")
    lead = data.get("lead", "")
    content = data.get("content", "")
    product_ids_str = data.get("productIds", "")

    # Mapowanie produktów z inputu na format IdoSell
    products_list = []
    if product_ids_str:
        for pid in product_ids_str.split(","):
            pid = pid.strip()
            if pid.isdigit():
                products_list.append({"productId": int(pid)})

    # Poprawny payload dla IdoSell z Twoją poprawką
    payload = {
        "params": {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "visible": "n",
            "visibleOnSitesList": [
                {"siteId": "display_on_blog"} # <--- TWÓJ FIX
            ],
            "langs": [
                {
                    "langId": "pol",
                    "title": title,
                    "shortDescription": lead,
                    "longDescription": content
                }
            ],
            "titleLinkType": "fullContentLink",
            "shopId": 1
        }
    }
    
    # Dodajemy produkty do payloadu, jeśli użytkownik jakieś podał
    if products_list:
        payload["params"]["products"] = products_list
    
    url = f"https://{domain}/api/admin/v7/entries/entries"
    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
    
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=30)
        response_data = res.json()
        
        # Sukces, próbujemy wyciągnąć entryId
        if res.status_code in [200, 201]:
            entry_id = None
            if "result" in response_data and "entryId" in response_data["result"]:
                entry_id = response_data["result"]["entryId"]
                
            return jsonify({
                "success": True, 
                "response": response_data,
                "entryId": entry_id
            })
        else:
            return jsonify({"success": False, "error": f"Odrzucono: {res.status_code}", "details": response_data}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@idosell_bp.route('/auto_products', methods=['POST'])
def api_auto_products():
    data = request.json
    
    # ⚠️ TUTAJ WKLEJ SWÓJ PRAWDZIWY LINK DO XML (Pomiędzy cudzysłowy)
    xml_url = os.environ.get("WASSYL_XML_FEED", "https://wassyl.pl/data/export/feed10015_1b9e5511234776450ad2740f.xml").strip() 
    
    if "TUTAJ_WKLEJ" in xml_url or not xml_url.startswith("http"):
        return jsonify({"success": False, "error": "Brak poprawnego linku do pliku XML w kodzie Pythona."}), 500
    
    try:
        # Zwiększamy timeout do 25 sekund dla ciężkich plików XML
        res = requests.get(xml_url, timeout=25)
        if res.status_code != 200:
            return jsonify({"success": False, "error": f"Serwer IdoSell odrzucił pobieranie pliku XML (Kod: {res.status_code})"}), 500
            
        # Bezpieczne parsowanie (żeby zapobiec wywalaniu błędu 500 przez Flask)
        try:
            root = ET.fromstring(res.content)
        except Exception as parse_err:
            return jsonify({"success": False, "error": "Pobrano plik, ale nie jest to poprawny format XML."}), 500
            
        extracted_ids = []
        
        # STRATEGIA 1: Format IdoSell / Ceneo (<o id="123">)
        for offer in root.findall('.//o'):
            offer_id = offer.get('id')
            if offer_id and offer_id.isdigit():
                extracted_ids.append(offer_id)
                
        # STRATEGIA 2: Format Google Shopping (<item><g:id>123</g:id>)
        if not extracted_ids:
            namespace = {'g': 'http://base.google.com/ns/1.0'}
            for item in root.findall('.//item'):
                item_id = item.find('g:id', namespace)
                if item_id is None: 
                    item_id = item.find('id') # Fallback
                if item_id is not None and item_id.text and item_id.text.isdigit():
                    extracted_ids.append(item_id.text.strip())
        
        # STRATEGIA 3: Format Facebook Catalog / Zwykły (<item><id>123</id>)
        if not extracted_ids:
            for item in root.findall('.//item'):
                item_id = item.find('id')
                if item_id is not None and item_id.text and item_id.text.isdigit():
                    extracted_ids.append(item_id.text.strip())

        # Usuwamy duplikaty (jeśli XML ma kilka wariantów tego samego ID)
        extracted_ids = list(set(extracted_ids))
        
        if not extracted_ids:
            return jsonify({"success": False, "error": "Pobrano XML, ale nie odnaleziono w nim tagów z numerami ID."}), 500

        # Wyciągamy np. 150 najnowszych produktów z feedu (żeby blog nie losował starych)
        pool = extracted_ids[:150]
        
        # Wybieramy z nich 3 losowe
        selected_ids = random.sample(pool, min(3, len(pool)))
                
        return jsonify({"success": True, "ids": ", ".join(selected_ids)})
        
    except requests.exceptions.Timeout:
        return jsonify({"success": False, "error": "Upłynął limit czasu (25s). Plik XML jest zbyt duży."}), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"Krytyczny błąd: {str(e)}"}), 500
