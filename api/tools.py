import os
import io
import base64
import requests
import json
from flask import Blueprint, request, jsonify
from bs4 import BeautifulSoup
from PIL import Image
from datetime import datetime, timedelta

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    GOOGLE_API_AVAILABLE = True
except ImportError:
    GOOGLE_API_AVAILABLE = False

tools_bp = Blueprint('tools', __name__)

# Pełna baza wydarzeń z kalendarza marketingowego 2026
MARKETING_CALENDAR_2026 = [
    # Kwiecień
    {"date": "2026-04-01", "name": "Prima Aprilis"},
    {"date": "2026-04-02", "name": "Dzień Świadomości Autyzmu"},
    {"date": "2026-04-03", "name": "Dzień Tęczy"},
    {"date": "2026-04-04", "name": "Dzień Marchewki"},
    {"date": "2026-04-05", "name": "Wielkanoc"},
    {"date": "2026-04-06", "name": "Lany Poniedziałek"},
    {"date": "2026-04-07", "name": "Światowy Dzień Zdrowia"},
    {"date": "2026-04-08", "name": "Dzień Miłośników Zoo"},
    {"date": "2026-04-09", "name": "Dzień Gołębia i Jednorożców"},
    {"date": "2026-04-11", "name": "Dzień Radia"},
    {"date": "2026-04-12", "name": "Dzień Czekolady"},
    {"date": "2026-04-13", "name": "Dzień Pamięci Ofiar Zbrodni Katyńskiej"},
    {"date": "2026-04-14", "name": "Dzień Delfina"},
    {"date": "2026-04-15", "name": "Światowy Dzień Trzeźwości"},
    {"date": "2026-04-16", "name": "Dzień Sapera"},
    {"date": "2026-04-17", "name": "Światowy Dzień Kostki Rubika"},
    {"date": "2026-04-18", "name": "Europejski Dzień Praw Pacjenta"},
    {"date": "2026-04-19", "name": "Dzień Czosnku i Dzień Rowerowy"},
    {"date": "2026-04-20", "name": "Dzień Marihuany"},
    {"date": "2026-04-21", "name": "Dzień Kreatywności"},
    {"date": "2026-04-22", "name": "Dzień Ziemi"},
    {"date": "2026-04-23", "name": "Światowy Dzień Książki"},
    {"date": "2026-04-24", "name": "Dzień Solidarności Młodzieży"},
    {"date": "2026-04-25", "name": "Dzień Sekretarki, DNA i Pingwinów"},
    {"date": "2026-04-26", "name": "Światowy Dzień Własności Intelektualnej"},
    {"date": "2026-04-27", "name": "Dzień Grafika"},
    {"date": "2026-04-28", "name": "Dzień Sera Camembert"},
    {"date": "2026-04-29", "name": "Międzynarodowy Dzień Tańca"},
    {"date": "2026-04-30", "name": "Dzień Uczciwości"},
    # Maj
    {"date": "2026-05-01", "name": "Święto Pracy"},
    {"date": "2026-05-02", "name": "Dzień Flagi"},
    {"date": "2026-05-03", "name": "Święto Konstytucji 3 Maja"},
    {"date": "2026-05-04", "name": "Dzień Strażaka"},
    {"date": "2026-05-05", "name": "Dzień Bez Makijażu"},
    {"date": "2026-05-06", "name": "Międzynarodowy Dzień bez Diety"},
    {"date": "2026-05-07", "name": "Światowy Dzień Haseł"},
    {"date": "2026-05-08", "name": "Dzień Bibliotekarza"},
    {"date": "2026-05-09", "name": "Dzień Unii Europejskiej"},
    {"date": "2026-05-10", "name": "Dzień Zołzy"},
    {"date": "2026-05-11", "name": "Dzień bez Śmiecenia"},
    {"date": "2026-05-12", "name": "Dzień Pielęgniarek"},
    {"date": "2026-05-13", "name": "Międzynarodowy Dzień Hummusu"},
    {"date": "2026-05-14", "name": "Dzień Farmaceuty"},
    {"date": "2026-05-15", "name": "Międzynarodowy Dzień Rodziny"},
    {"date": "2026-05-16", "name": "Święto Straży Granicznej"},
    {"date": "2026-05-17", "name": "Światowy Dzień Pieczenia"},
    {"date": "2026-05-18", "name": "Dzień Muzeów"},
    {"date": "2026-05-19", "name": "Światowy Dzień FairPlay"},
    {"date": "2026-05-20", "name": "Światowy Dzień Pszczół"},
    {"date": "2026-05-21", "name": "Dzień Dialogu i Rozwoju"},
    {"date": "2026-05-22", "name": "Dzień Pac-Mana"},
    {"date": "2026-05-23", "name": "Dzień Żółwia"},
    {"date": "2026-05-24", "name": "Dzień Braci"},
    {"date": "2026-05-25", "name": "Światowy Dzień Piłki Nożnej"},
    {"date": "2026-05-26", "name": "Dzień Matki"},
    {"date": "2026-05-27", "name": "Dzień Samorządu Terytorialnego"},
    {"date": "2026-05-28", "name": "Dzień Amnesty International"},
    {"date": "2026-05-29", "name": "Europejski Dzień Sąsiada"},
    {"date": "2026-05-30", "name": "Światowy Dzień Ziemniaka"},
    {"date": "2026-05-31", "name": "Dzień Bez Papierosa"},
    # Czerwiec
    {"date": "2026-06-01", "name": "Dzień Dziecka"},
    {"date": "2026-06-02", "name": "Dzień Bez Krawata"},
    {"date": "2026-06-03", "name": "Światowy Dzień Roweru"},
    {"date": "2026-06-04", "name": "Dzień Wolności i Praw Obywatelskich"},
    {"date": "2026-06-05", "name": "Światowy Dzień Ochrony Środowiska"},
    {"date": "2026-06-06", "name": "Dzień Jojo"},
    {"date": "2026-06-07", "name": "Dzień Seksu"},
    {"date": "2026-06-08", "name": "Dzień Oceanów"},
    {"date": "2026-06-09", "name": "Dzień Kaczora Donalda"},
    {"date": "2026-06-10", "name": "Międzynarodowy Dzień Elektryka"},
    {"date": "2026-06-11", "name": "Międzynarodowy Dzień Zabawy"},
    {"date": "2026-06-12", "name": "Międzynarodowy Dzień Falafela"},
    {"date": "2026-06-13", "name": "Dzień Równości"},
    {"date": "2026-06-14", "name": "Światowy Dzień Krwiodawcy"},
    {"date": "2026-06-15", "name": "Dzień Wiatru"},
    {"date": "2026-06-16", "name": "Dzień Dziecka Afrykańskiego"},
    {"date": "2026-06-17", "name": "Dzień Czołgisty"},
    {"date": "2026-06-18", "name": "Międzynarodowy Dzień Sushi"},
    {"date": "2026-06-20", "name": "Święto muzyki"},
    {"date": "2026-06-21", "name": "Pierwszy Dzień Lata"},
    {"date": "2026-06-22", "name": "Dzień Garbusa"},
    {"date": "2026-06-23", "name": "Dzień Ojca"},
    {"date": "2026-06-24", "name": "Dzień Przytulania"},
    {"date": "2026-06-25", "name": "Dzień Smerfa"},
    {"date": "2026-06-27", "name": "Dzień Szwagra"},
    {"date": "2026-06-28", "name": "Święto Marynarki Wojennej"},
    {"date": "2026-06-29", "name": "Dzień Ratownika WOPR"},
    {"date": "2026-06-30", "name": "Dzień Asteroid"},
    # Lipiec
    {"date": "2026-07-01", "name": "Dzień Psa"},
    {"date": "2026-07-02", "name": "Międzynarodowy Dzień Ufa"},
    {"date": "2026-07-03", "name": "Dzień Papryczki Chilli"},
    {"date": "2026-07-04", "name": "Dzień Niepodległości w USA"},
    {"date": "2026-07-05", "name": "Dzień Bikini"},
    {"date": "2026-07-06", "name": "Dzień Całowania"},
    {"date": "2026-07-07", "name": "Światowy Dzień Czekolady"},
    {"date": "2026-07-09", "name": "Dzień Bez Stanika"},
    {"date": "2026-07-10", "name": "Dzień Nikoli Tesli"},
    {"date": "2026-07-11", "name": "Światowy Dzień Kebaba"},
    {"date": "2026-07-12", "name": "Dzień Męczeństwa Wsi Polskiej"},
    {"date": "2026-07-13", "name": "Dzień Frytek"},
    {"date": "2026-07-14", "name": "Rewolucja Francuska"},
    {"date": "2026-07-15", "name": "Dzień Bez Telefonu Komórkowego"},
    {"date": "2026-07-16", "name": "Światowy Dzień Węża"},
    {"date": "2026-07-17", "name": "Dzień Emoji"},
    {"date": "2026-07-18", "name": "Światowy Dzień Słuchania"},
    {"date": "2026-07-19", "name": "Dzień Czerwonego Kapturka"},
    {"date": "2026-07-20", "name": "Dzień Szachów"},
    {"date": "2026-07-21", "name": "Międzynarodowy Dzień Szachów"},
    {"date": "2026-07-22", "name": "Światowy Dzień Mózgu"},
    {"date": "2026-07-23", "name": "Dzień Włóczykija"},
    {"date": "2026-07-24", "name": "Dzień Policjanta"},
    {"date": "2026-07-25", "name": "Dzień Bezpiecznego Kierowcy"},
    {"date": "2026-07-27", "name": "Dzień Samotnych"},
    {"date": "2026-07-28", "name": "Światowy Dzień WZW"},
    {"date": "2026-07-29", "name": "Światowy Dzień Tygrysa"},
    {"date": "2026-07-30", "name": "Międzynarodowy Dzień Przyjaźni"},
    {"date": "2026-07-31", "name": "Dzień Skarbowości"},
    # Sierpień
    {"date": "2026-08-01", "name": "Rocznica Powstania Warszawskiego"},
    {"date": "2026-08-02", "name": "Dzień Pamięci o Zagładzie Romów"},
    {"date": "2026-08-03", "name": "Dzień Arbuza"},
    {"date": "2026-08-05", "name": "Dzień Bielizny"},
    {"date": "2026-08-06", "name": "Dzień Świeżego Oddechu"},
    {"date": "2026-08-07", "name": "Dzień Pracownika Opieki nad Osobami Starszymi"},
    {"date": "2026-08-08", "name": "Międzynarodowy Dzień Kota"},
    {"date": "2026-08-09", "name": "Dzień Miłośników Książek"},
    {"date": "2026-08-10", "name": "Dzień Przewodników i Ratowników Górskich"},
    {"date": "2026-08-11", "name": "Dzień Konserwatora Zabytków"},
    {"date": "2026-08-12", "name": "Dzień Młodzieży"},
    {"date": "2026-08-13", "name": "Dzień Osób Leworęcznych"},
    {"date": "2026-08-14", "name": "Dzień Energetyka"},
    {"date": "2026-08-15", "name": "Wniebowzięcie NMP / Wojsko Polskie"},
    {"date": "2026-08-16", "name": "Dzień Synowej"},
    {"date": "2026-08-17", "name": "Dzień Pozytywnie Zakręconych"},
    {"date": "2026-08-18", "name": "Dzień Ciasta Lodowego"},
    {"date": "2026-08-19", "name": "Światowy Dzień Fotografii"},
    {"date": "2026-08-20", "name": "Dzień Komara"},
    {"date": "2026-08-21", "name": "Światowy Dzień Optymisty"},
    {"date": "2026-08-22", "name": "Dzień Mleka Roślinnego"},
    {"date": "2026-08-23", "name": "Dzień Pamięci Ofiar Nazizmu i Stalinizmu"},
    {"date": "2026-08-24", "name": "Dzień Windowsa"},
    {"date": "2026-08-25", "name": "Dzień Zupy Błyskawicznej"},
    {"date": "2026-08-26", "name": "Międzynarodowy Dzień Psa"},
    {"date": "2026-08-27", "name": "Dzień Tira"},
    {"date": "2026-08-28", "name": "Dzień Lotnictwa"},
    {"date": "2026-08-29", "name": "Dzień Strażnika Gminnego i Miejskiego"},
    {"date": "2026-08-30", "name": "Dzień Taksówkarza"},
    {"date": "2026-08-31", "name": "Dzień Blogów"},
    # Wrzesień
    {"date": "2026-09-01", "name": "Początek roku szkolnego"},
    {"date": "2026-09-02", "name": "Dzień Dużego Rozmiaru"},
    {"date": "2026-09-03", "name": "Dzień Wieżowców"},
    {"date": "2026-09-04", "name": "Światowy Dzień Zdrowia Seksualnego"},
    {"date": "2026-09-05", "name": "Narodowe Czytanie"},
    {"date": "2026-09-06", "name": "Dzień Walki z Prokrastynacją"},
    {"date": "2026-09-07", "name": "Międzynarodowy Dzień Czystego Powietrza"},
    {"date": "2026-09-08", "name": "Dzień Dobrych Wiadomości"},
    {"date": "2026-09-09", "name": "Dzień Urody"},
    {"date": "2026-09-10", "name": "Światowy Dzień Zapobiegania Samobójstwom"},
    {"date": "2026-09-12", "name": "Dzień Brukarza"},
    {"date": "2026-09-13", "name": "Dzień Programisty"},
    {"date": "2026-09-14", "name": "Dzień Walki z Wypaleniem Zawodowym"},
    {"date": "2026-09-15", "name": "Dzień Kropki (kreatywności)"},
    {"date": "2026-09-16", "name": "Dzień Maszynisty"},
    {"date": "2026-09-17", "name": "Dzień Sybiraka"},
    {"date": "2026-09-18", "name": "Dzień Pierwszej Miłości"},
    {"date": "2026-09-19", "name": "Światowy Dzień Kierownika"},
    {"date": "2026-09-20", "name": "Ogólnopolski Dzień Przedszkolaka"},
    {"date": "2026-09-21", "name": "Dzień Pokoju"},
    {"date": "2026-09-22", "name": "Światowy Dzień Bez Samochodu"},
    {"date": "2026-09-23", "name": "Początek Jesieni"},
    {"date": "2026-09-24", "name": "Dzień Stylistów Rzęs"},
    {"date": "2026-09-25", "name": "Dzień Budowlańca"},
    {"date": "2026-09-26", "name": "Europejski Dzień Języków"},
    {"date": "2026-09-27", "name": "Światowy Dzień Turystyki"},
    {"date": "2026-09-28", "name": "Światowy Dzień Wścieklizny"},
    {"date": "2026-09-29", "name": "Dzień Kawy"},
    {"date": "2026-09-30", "name": "Dzień Chłopaka"},
    # Październik
    {"date": "2026-10-01", "name": "Międzynarodowy Dzień Wege"},
    {"date": "2026-10-02", "name": "Międzynarodowy Dzień Bez Przemocy"},
    {"date": "2026-10-03", "name": "Dzień Uśmiechu"},
    {"date": "2026-10-04", "name": "Dzień Zwierząt"},
    {"date": "2026-10-05", "name": "Światowy Dzień Nauczyciela"},
    {"date": "2026-10-06", "name": "Dzień Borsuka"},
    {"date": "2026-10-07", "name": "Dzień Wanny"},
    {"date": "2026-10-08", "name": "Światowy Dzień Ośmiornicy"},
    {"date": "2026-10-09", "name": "Międzynarodowy Dzień Pisania Listów"},
    {"date": "2026-10-10", "name": "Dzień Zdrowia Psychicznego"},
    {"date": "2026-10-11", "name": "Dzień Dziewczyny"},
    {"date": "2026-10-12", "name": "Dzień Bezpiecznego Komputera"},
    {"date": "2026-10-13", "name": "Dzień Dawcy Szpiku"},
    {"date": "2026-10-14", "name": "Dzień Nauczyciela"},
    {"date": "2026-10-15", "name": "Europejski Dzień Walki z Rakiem Piersi"},
    {"date": "2026-10-16", "name": "Dzień Chleba"},
    {"date": "2026-10-17", "name": "Dzień Arkusza Kalkulacyjnego"},
    {"date": "2026-10-18", "name": "Dzień Poczty Polskiej"},
    {"date": "2026-10-20", "name": "Dzień Statystyki"},
    {"date": "2026-10-21", "name": "Dzień Bez Skarpetek"},
    {"date": "2026-10-22", "name": "Dzień CAPS LOCKA"},
    {"date": "2026-10-24", "name": "Dzień Narodów Zjednoczonych"},
    {"date": "2026-10-25", "name": "Dzień Makaronu"},
    {"date": "2026-10-26", "name": "Światowy Dzień Donacji i Transplantacji"},
    {"date": "2026-10-27", "name": "Światowy Dzień Dziedzicwa Audiowizualnego"},
    {"date": "2026-10-28", "name": "Światowy Dzień Animacji"},
    {"date": "2026-10-29", "name": "Dzień Internetu"},
    {"date": "2026-10-30", "name": "Dzień Spódnicy"},
    {"date": "2026-10-31", "name": "Halloween"},
    # Listopad
    {"date": "2026-11-01", "name": "Wszystkich Świętych"},
    {"date": "2026-11-02", "name": "Zaduszki"},
    {"date": "2026-11-03", "name": "Dzień Myśliwych"},
    {"date": "2026-11-04", "name": "Dzień Taniego Wina"},
    {"date": "2026-11-05", "name": "Dzień Postaci z Bajek"},
    {"date": "2026-11-06", "name": "Dzień Saksofonu"},
    {"date": "2026-11-07", "name": "Dzień Kotleta Schabowego"},
    {"date": "2026-11-08", "name": "Europejski Dzień Zdrowego Jedzenia i Gotowania"},
    {"date": "2026-11-09", "name": "Europejski Dzień Wynalazcy"},
    {"date": "2026-11-10", "name": "Dzień Jeża"},
    {"date": "2026-11-11", "name": "Święto Niepodległości"},
    {"date": "2026-11-12", "name": "Światowy Dzień Drwala"},
    {"date": "2026-11-13", "name": "Dzień Dobroci"},
    {"date": "2026-11-14", "name": "Światowy Dzień Cukrzycy"},
    {"date": "2026-11-15", "name": "Dzień Slipek"},
    {"date": "2026-11-16", "name": "Dzień Tolerancji"},
    {"date": "2026-11-17", "name": "Dzień Studenta"},
    {"date": "2026-11-18", "name": "Dzień Myszki Miki"},
    {"date": "2026-11-19", "name": "Dzień Mężczyzn"},
    {"date": "2026-11-20", "name": "Światowy Dzień Filozofii"},
    {"date": "2026-11-21", "name": "Dzień Życzliwości"},
    {"date": "2026-11-22", "name": "Dzień Kredki"},
    {"date": "2026-11-23", "name": "Dzień Fibonacciego"},
    {"date": "2026-11-24", "name": "Katarzynki"},
    {"date": "2026-11-25", "name": "Dzień Pluszowego Misia"},
    {"date": "2026-11-26", "name": "Dzień Ciasta"},
    {"date": "2026-11-27", "name": "Black Friday"},
    {"date": "2026-11-28", "name": "Dzień Pocałunku"},
    {"date": "2026-11-29", "name": "Andrzejki"},
    {"date": "2026-11-30", "name": "Andrzejki"},
    # Grudzień
    {"date": "2026-12-01", "name": "Światowy Dzień AIDS"},
    {"date": "2026-12-02", "name": "Dzień Placków"},
    {"date": "2026-12-03", "name": "Międzynarodowy Dzień Osób Niepełnosprawnych"},
    {"date": "2026-12-04", "name": "Barbórka"},
    {"date": "2026-12-05", "name": "Dzień Wolontariusza"},
    {"date": "2026-12-06", "name": "Mikołajki"},
    {"date": "2026-12-07", "name": "Międzynarodowy Dzień Lotnictwa Cywilnego"},
    {"date": "2026-12-08", "name": "Dzień Kupca"},
    {"date": "2026-12-10", "name": "Dzień Praw Człowieka"},
    {"date": "2026-12-11", "name": "Międzynarodowy Dzień Tanga"},
    {"date": "2026-12-12", "name": "Dzień Guzika"},
    {"date": "2026-12-13", "name": "Dzień Księgarza"},
    {"date": "2026-12-14", "name": "Dzień Małpy"},
    {"date": "2026-12-15", "name": "Dzień Herbaty"},
    {"date": "2026-12-17", "name": "Dzień Bez Przekleństw"},
    {"date": "2026-12-18", "name": "Międzynarodowy Dzień Migrantów"},
    {"date": "2026-12-20", "name": "Dzień Ryby"},
    {"date": "2026-12-21", "name": "Początek zimy"},
    {"date": "2026-12-24", "name": "Wigilia"},
    {"date": "2026-12-25", "name": "Boże Narodzenie"},
    {"date": "2026-12-26", "name": "Boże Narodzenie"},
    {"date": "2026-12-27", "name": "Dzień Keksa"},
    {"date": "2026-12-28", "name": "Międzynarodowy Dzień Pocałunku"},
    {"date": "2026-12-30", "name": "Dzień Serka Wiejskiego"},
    {"date": "2026-12-31", "name": "Sylwester"}
]

@tools_bp.route('/get_upcoming_events', methods=['GET'])
def get_upcoming_events():
    """Zwraca wydarzenia z kalendarza na najbliższe 5 dni."""
    today = datetime.now()
    end_date = today + timedelta(days=5)
    
    # Format daty w kalendarzu to RRRR-MM-DD
    upcoming = [
        event for event in MARKETING_CALENDAR_2026 
        if today.strftime('%Y-%m-%d') <= event['date'] <= end_date.strftime('%Y-%m-%d')
    ]
    
    return jsonify({"events": upcoming, "today": today.strftime('%Y-%m-%d')})

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
