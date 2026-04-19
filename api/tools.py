import os
import io
import base64
import requests
import json
from flask import Blueprint, request, jsonify
from bs4 import BeautifulSoup
from PIL import Image

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    GOOGLE_API_AVAILABLE = True
except ImportError:
    GOOGLE_API_AVAILABLE = False

tools_bp = Blueprint('tools', __name__)

@tools_bp.route('/export_drive', methods=['POST'])
def api_export_drive():
    if not GOOGLE_API_AVAILABLE:
        return jsonify({"error": "Biblioteki Google (google-api-python-client) nie są zainstalowane."}), 500
        
    data = request.json
    title = data.get('title', 'Eksport z AI Wassyl')
    content = data.get('content', '')
    
    creds_json = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    if not creds_json:
        return jsonify({"error": "Brak zmiennej GOOGLE_CREDENTIALS_JSON na platformie."}), 500
        
    try:
        creds_dict = json.loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(
            creds_dict, scopes=['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/documents']
        )
        
        docs_service = build('docs', 'v1', credentials=creds)
        doc = docs_service.documents().create(body={'title': title}).execute()
        document_id = doc.get('documentId')
        
        requests_body = [{'insertText': {'location': {'index': 1},'text': content}}]
        docs_service.documents().batchUpdate(documentId=document_id, body={'requests': requests_body}).execute()
            
        drive_service = build('drive', 'v3', credentials=creds)
        drive_service.permissions().create(fileId=document_id, body={'type': 'anyone', 'role': 'writer'}).execute()
        
        link = f"https://docs.google.com/document/d/{document_id}/edit"
        return jsonify({"success": True, "link": link})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@tools_bp.route('/fetch_url', methods=['POST'])
def api_fetch_url():
    url = request.json.get('url', '')
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        zupa = BeautifulSoup(resp.text, "html.parser")
        for script in zupa(["script", "style"]): script.extract()
        return jsonify({"text": zupa.get_text(separator=" ", strip=True)[:5000]})
    except Exception as e:
        return jsonify({"text": "", "error": str(e)})

@tools_bp.route('/collage', methods=['POST'])
def api_collage():
    data = request.json
    lista_url = data.get('urls', [])
    doc_w = data.get('width', 1200)
    doc_h = data.get('height', 630)

    try:
        obrazy = []
        for u in lista_url:
            res = requests.get(u, stream=True, timeout=10)
            if res.status_code == 200:
                obrazy.append(Image.open(res.raw).convert("RGB"))
        if not obrazy: return jsonify({"error": "Nie udało się pobrać obrazów"})

        kolaz = Image.new("RGB", (doc_w, doc_h), (255, 255, 255))
        szer_poj = doc_w // len(obrazy)

        for i, img in enumerate(obrazy):
            img_ratio = img.width / img.height
            target_ratio = szer_poj / doc_h
            if img_ratio > target_ratio:
                new_h = doc_h
                new_w = int(new_h * img_ratio)
                img = img.resize((new_w, new_h), Image.LANCZOS)
                img = img.crop(((new_w - szer_poj)/2, 0, (new_w + szer_poj)/2, doc_h))
            else:
                new_w = szer_poj
                new_h = int(new_w / img_ratio)
                img = img.resize((new_w, new_h), Image.LANCZOS)
                img = img.crop((0, (new_h - doc_h)/2, szer_poj, (new_h + doc_h)/2))
            kolaz.paste(img, (i * szer_poj, 0))

        buffered = io.BytesIO()
        kolaz.save(buffered, format="JPEG", quality=85)
        b64 = base64.b64encode(buffered.getvalue()).decode()
        return jsonify({"collage": f"data:image/jpeg;base64,{b64}"})
    except Exception as e:
        return jsonify({"error": str(e)})