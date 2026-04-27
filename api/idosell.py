import os
import requests
import random
import re
import xml.etree.ElementTree as ET
from datetime import datetime
import base64
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
    image_base64 = data.get("imageBase64", None) # <--- Odbieramy zdjęcie

    # Mapowanie produktów z inputu na format IdoSell
    products_list = []
    if product_ids_str:
        for pid in product_ids_str.split(","):
            pid = pid.strip()
            if pid.isdigit():
                products_list.append({"productId": int(pid)})

    # Poprawny payload dla IdoSell
    payload = {
        "params": {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "visible": "n",
            "visibleOnSitesList": [
                {"siteId": "display_on_blog"} 
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
    
    # Dodajemy produkty do payloadu
    if products_list:
        payload["params"]["products"] = products_list

    # --- NOWOŚĆ: Dodajemy zdjęcie jako miniaturę wpisu ---
    if image_base64:
        payload["params"]["pictureData"] = {
            "pictureBase64": image_base64,
            "pictureFormat": "jpg"
        }
    
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
    topic = data.get("topic", "")
    
    # ⚠️ TUTAJ WKLEJ SWÓJ PRAWDZIWY LINK DO XML
    xml_url = os.environ.get("WASSYL_XML_FEED", "https://wassyl.pl/data/export/feed10015_1b9e5511234776450ad2740f.xml").strip() 
    
    if "TUTAJ_WKLEJ" in xml_url or not xml_url.startswith("http"):
        return jsonify({"success": False, "error": "Brak poprawnego linku do pliku XML."}), 500
    
    try:
        res = requests.get(xml_url, timeout=25)
        if res.status_code != 200:
            return jsonify({"success": False, "error": f"Odrzucono pobieranie XML (Kod: {res.status_code})"}), 500
            
        try:
            root = ET.fromstring(res.content)
        except Exception:
            return jsonify({"success": False, "error": "Pobrano plik, ale to nie jest poprawny format XML."}), 500
            
        products = []
        
        # STRATEGIA 1: Format IdoSell / Ceneo (<o id="123"><name>...</name>)
        for offer in root.findall('.//o'):
            offer_id = offer.get('id')
            name_tag = offer.find('name')
            if offer_id and offer_id.isdigit() and name_tag is not None and name_tag.text:
                products.append({'id': offer_id, 'name': name_tag.text.lower()})
                
        # STRATEGIA 2: Format Google Shopping / Standard (<item><g:id> lub <id>)
        if not products:
            namespace = {'g': 'http://base.google.com/ns/1.0'}
            for item in root.findall('.//item'):
                item_id = item.find('g:id', namespace)
                if item_id is None: item_id = item.find('id')
                
                title_tag = item.find('g:title', namespace)
                if title_tag is None: title_tag = item.find('title')
                
                if item_id is not None and title_tag is not None and item_id.text and item_id.text.isdigit() and title_tag.text:
                    products.append({'id': item_id.text.strip(), 'name': title_tag.text.lower()})

        if not products:
            return jsonify({"success": False, "error": "Brak produktów w pliku XML."}), 500

        # --- INTELIGENTNE DOPASOWANIE DO TEMATU ---
        # Czyścimy temat ze znaków interpunkcyjnych i bierzemy słowa dłuższe niż 3 litery (omijamy "na", "do", "z")
        topic_clean = re.sub(r'[^\w\s]', '', topic.lower())
        topic_words = [w for w in topic_clean.split() if len(w) > 3]
        
        matched_ids = []
        if topic_words:
            for p in products:
                # Jeśli którekolwiek słowo z tematu pojawia się w nazwie produktu
                if any(word in p['name'] for word in topic_words):
                    matched_ids.append(p['id'])
                    
        # Usuwamy duplikaty zachowując kolejność
        matched_ids = list(dict.fromkeys(matched_ids))
        
        # Podejmujemy decyzję, co zwrócić
        if len(matched_ids) >= 3:
            selected_ids = random.sample(matched_ids, 3)
            info = "Znaleziono pasujące produkty!"
        elif len(matched_ids) > 0:
            selected_ids = matched_ids
            info = "Znaleziono kilka pasujących produktów."
        else:
            # Fallback: Losujemy 3 z 150 najnowszych/pierwszych w XML
            pool = [p['id'] for p in products][:150]
            selected_ids = random.sample(pool, min(3, len(pool)))
            info = "Wylosowano z najnowszych (brak ścisłego dopasowania do tematu)."
                
        return jsonify({
            "success": True, 
            "ids": ", ".join(selected_ids),
            "message": info
        })
        
    except requests.exceptions.Timeout:
        return jsonify({"success": False, "error": "Upłynął limit czasu (25s)."}), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"Krytyczny błąd: {str(e)}"}), 500

@idosell_bp.route('/proxy_image', methods=['POST'])
def proxy_image():
    url = request.json.get('url')
    if not url:
        return jsonify({"success": False, "error": "Brak URL zdjęcia"}), 400
        
    try:
        # Python pobiera zdjęcie z IdoSell (serwer do serwera - brak blokad CORS)
        res = requests.get(url, timeout=15)
        if res.status_code == 200:
            # Konwertujemy obraz na czysty tekst Base64
            b64 = base64.b64encode(res.content).decode('utf-8')
            return jsonify({"success": True, "base64": b64})
        else:
            return jsonify({"success": False, "error": f"Błąd pobierania: {res.status_code}"}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# --- AKTUALIZACJA PRODUKTÓW W IDOSELL ---
@idosell_bp.route('/update_product', methods=['POST'])
def api_update_product():
    domain, api_key = get_idosell_config()
    data = request.json
    
    product_id = data.get("id")
    new_name = data.get("name")
    new_desc = data.get("long_description")
    
    if not product_id:
        return jsonify({"success": False, "error": "Brak ID produktu"}), 400
        
    # Payload odwzorowany DOKŁADNIE 1:1 z poprawnie działającego cURL-a
    payload = {
        "params": {
            "products": [
                {
                    "productId": int(product_id),
                    "productNames": {
                        "productNamesLangData": [
                            {
                                "langId": "pol",
                                "productName": new_name
                            }
                        ]
                    },
                    "productLongDescriptions": {
                        "productLongDescriptionsLangData": [
                            {
                                "langId": "pol",
                                "productLongDescription": new_desc
                            }
                        ]
                    }
                }
            ]
        }
    }
    
    url = f"https://{domain}/api/admin/v7/products/products"
    
    # Dodajemy nagłówek Accept zgodnie z Twoim wzorcem
    headers = {
        "X-API-KEY": api_key, 
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    try:
        res = requests.put(url, headers=headers, json=payload, timeout=30)
        response_data = res.json()
        
        if res.status_code in [200, 201]:
            return jsonify({"success": True})
            
        elif res.status_code == 207:
            error_msg = "Odrzucono zmiany w produkcie (Multi-Status 207)."
            try:
                # Próbujemy wyłuskać dokładny powód błędu z odpowiedzi
                results = response_data.get("results", [])
                if results and "errors" in results[0]:
                    error_msg = results[0]["errors"][0].get("faultString", str(results[0]["errors"]))
            except Exception:
                pass
            return jsonify({"success": False, "error": f"207 -> {error_msg}"})
            
        else:
            return jsonify({"success": False, "error": f"KOD {res.status_code}"})
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

# --- ANALIZATOR PRODUKTÓW (SEO AUDYT) ---
@idosell_bp.route('/analyze', methods=['POST'])
def api_analyze_products():
    domain, api_key = get_idosell_config()
    page = request.json.get('page', 0)
    
    url = f"https://{domain}/api/admin/v7/products/products"
    headers = {"X-API-KEY": api_key, "Accept": "application/json"}
    
    # Pobieramy po 50 produktów na stronę, by nie przeciążyć serwera
    params = {
        "resultsLimit": 50,
        "resultsPage": page
    }
    
    try:
        res = requests.get(url, headers=headers, params=params, timeout=30)
        if res.status_code != 200:
            return jsonify({"success": False, "error": f"API Error: {res.status_code}"})
            
        data = res.json()
        products = data.get("results", [])
        
        matches = []
        for p in products:
            # 1. Filtrujemy po stanie magazynowym (> 0)
            stock = 0
            for size in p.get("productSizes", []):
                # Zliczamy stock ze wszystkich rozmiarów
                stock += float(size.get("stockQuantity", 0))
            if stock <= 0:
                continue
                
            # 2. Wyciągamy polskie dane
            pol_data = next((d for d in p.get("productDescriptionsLangData", []) if d.get("langId") == "pol"), None)
            if not pol_data:
                continue
                
            name = pol_data.get("productName", "")
            
            # 3. Wykluczamy dopisek "k01" (niezależnie od wielkości liter)
            if "k01" in name.lower():
                continue
                
            # 4. Opis poniżej 1000 znaków
            desc = pol_data.get("productLongDescription", "")
            if len(desc) >= 1000:
                continue
                
            matches.append({
                "id": p.get("productId"),
                "name": name,
                "desc_len": len(desc),
                "stock": stock
            })
            
        # Informujemy frontend, czy są jeszcze kolejne strony do przeskanowania
        has_more = len(products) == 50
        return jsonify({"success": True, "matches": matches, "has_more": has_more})
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})
