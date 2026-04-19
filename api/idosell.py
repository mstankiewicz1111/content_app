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
        produkty = []
        for prod in dane.get("results", []):
            pid = prod.get("productId")
            nazwa = "Ubranie marki Wassyl"
            for opis in prod.get("productDescriptionsLangData", []):
                if opis.get("langId") == "pol":
                    nazwa = opis.get("productName", "")
                    break

            zdjecia = prod.get("productImages", [])
            url_zdjecia = ""
            if zdjecia:
                url_zdjecia = zdjecia[0].get("productImageLargeUrl", "")
                if url_zdjecia.startswith("//"): url_zdjecia = "https:" + url_zdjecia
            
            urls_data = prod.get("productUrl", {}).get("productUrlsLangData", [])
            url_produktu = urls_data[0].get("url", "") if urls_data else f"https://wassyl.pl/product-pol-{pid}.html"
            
            if url_zdjecia:
                produkty.append({"id": str(pid), "nazwa": nazwa, "url_produktu": url_produktu, "url_zdjecia": url_zdjecia})
        
        return jsonify({"products": produkty})
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