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

# ZAKTUALIZOWANY ENDPOINT AKTUALIZACJI Z OBSŁUGĄ KODU 207
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
    headers = {"X-API-KEY": api_key, "Content-Type": "application/json", "Accept": "application/json"}
    
    payload = {
        "products": [
            {
                "productId": int(prod_id),
                "productDescriptionsLangData": [
                    {
                        "langId": "pol",
                        "productName": new_name,
                        "productLongDescription": new_desc
                    }
                ]
            }
        ]
    }

    try:
        res = requests.put(url, headers=headers, json=payload, timeout=20)
        response_data = res.json()
        
        # Akceptujemy 200, 204 oraz 207 (Multi-Status IdoSell)
        if res.status_code in [200, 204, 207]:
            # Weryfikacja, czy kod 207 nie ukrywa w sobie błędów dla tego konkretnego ID
            errors = []
            for p in response_data.get("products", []):
                if "errors" in p and p["errors"]:
                    errors.append(str(p["errors"]))
            
            if errors:
                return jsonify({"success": False, "error": "IdoSell zwrócił błędy: " + "; ".join(errors)}), 200
                
            return jsonify({"success": True, "response": response_data})
        else:
            return jsonify({"success": False, "error": f"Błąd IdoSell: {res.status_code}", "details": res.text}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
