import streamlit as st
import google.generativeai as genai
import requests
import json
import os
import io
import base64
import time
from bs4 import BeautifulSoup
from PIL import Image

# --- KONFIGURACJA API GEMINI ---
# Dodajemy .strip(), aby usunąć białe znaki i spacje
KLUCZ_API = os.environ.get("GEMINI_API_KEY", "").strip()
if not KLUCZ_API:
    st.error("🚨 Brak klucza API Gemini! Ustaw zmienną środowiskową GEMINI_API_KEY w Render.")
    st.stop()

# Zabezpieczenie przed cudzysłowami, jeśli wklejono je w Renderze
KLUCZ_API = KLUCZ_API.replace('"', '').replace("'", "")

genai.configure(api_key=KLUCZ_API)
model = genai.GenerativeModel("gemini-2.5-flash")

# --- ZMIENNE ŚRODOWISKOWE IDOSELL ---
IDOSELL_DOMAIN = os.environ.get("IDOSELL_DOMAIN", "").strip()
IDOSELL_API_KEY = os.environ.get("IDOSELL_API_KEY", "").strip()

# --- SYSTEM WERSJI ROBOCZYCH (DRAFTS) ---
DRAFT_FILE = "draft_wpisu.json"


def load_draft():
    if os.path.exists(DRAFT_FILE):
        try:
            with open(DRAFT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_draft():
    dane = {
        "wybrany_temat": st.session_state.get("wybrany_temat", ""),
        "aktualny_wpis": st.session_state.get("aktualny_wpis", ""),
        "gotowy_html": st.session_state.get("gotowy_html", ""),
        "kolaz_b64": st.session_state.get("kolaz_b64", ""),
        "zakladka": st.session_state.get("zakladka", "1. Tematy na podstawie trendów"),
    }
    with open(DRAFT_FILE, "w", encoding="utf-8") as f:
        json.dump(dane, f, ensure_ascii=False)


def clear_draft():
    if os.path.exists(DRAFT_FILE):
        os.remove(DRAFT_FILE)
    st.session_state.wybrany_temat = ""
    st.session_state.aktualny_wpis = ""
    st.session_state.gotowy_html = ""
    st.session_state.kolaz_b64 = ""
    st.session_state.zakladka = "1. Tematy na podstawie trendów"


# --- FUNKCJE POMOCNICZE ---

def generuj_tekst_ai(prompt):
    """Inteligentna funkcja łącząca się z API z automatycznym ponawianiem przy błędzie 429."""
    for proba in range(3):
        try:
            return model.generate_content(prompt)
        except Exception as e:
            if "429" in str(e) or "Quota" in str(e):
                if proba < 2:
                    st.warning(
                        f"⏳ Chwilowy limit API Gemini. Aplikacja czeka 30 sekund i spróbuje ponownie... (Próba {proba + 1}/3)"
                    )
                    time.sleep(30)
                    continue
            raise e


def pobierz_tekst_ze_strony(url):
    try:
        naglowki = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        odpowiedz = requests.get(url, headers=naglowki, timeout=10)
        odpowiedz.raise_for_status()
        zupa = BeautifulSoup(odpowiedz.text, "html.parser")
        for script in zupa(["script", "style"]):
            script.extract()
        return zupa.get_text(separator=" ", strip=True)[:5000]
    except Exception:
        return ""


def wyczysc_json(tekst):
    tekst = tekst.strip()
    znacznik = chr(96) * 3
    if tekst.startswith(znacznik + "json"):
        tekst = tekst[7:]
    elif tekst.startswith(znacznik):
        tekst = tekst[3:]
    if tekst.endswith(znacznik):
        tekst = tekst[:-3]
    return tekst.strip()


def przejdz_do_realizacji(wybrany_temat):
    st.session_state.wybrany_temat = wybrany_temat
    st.session_state.zakladka = "3. Stwórz wpis"
    save_draft()


def przejdz_do_idosell():
    st.session_state.zakladka = "4. Publikacja IdoSell"
    save_draft()


def wyciagnij_tytul_i_lead(wpis_markdown):
    tytul = ""
    lead = ""
    if not wpis_markdown:
        return tytul, lead

    linie = wpis_markdown.split("\n")

    for linia in linie:
        if linia.startswith("# "):
            tytul = linia.replace("# ", "").replace("*", "").strip()
            break

    for linia in linie:
        czysta_linia = linia.strip()
        if czysta_linia and not czysta_linia.startswith("#") and not czysta_linia.startswith("!"):
            lead = czysta_linia
            break

    return tytul, lead


def pobierz_dane_produktow_idosell(lista_id_str):
    """Pobiera dane produktów z API IdoSell."""
    produkty = []

    if not IDOSELL_DOMAIN or not IDOSELL_API_KEY:
        st.error("Brak skonfigurowanych zmiennych środowiskowych IdoSell.")
        return produkty

    lista_id = [x.strip() for x in lista_id_str.split(",") if x.strip().isdigit()]
    if not lista_id:
        return produkty

    url = f"https://{IDOSELL_DOMAIN}/api/admin/v7/products/products"
    headers = {
        "X-API-KEY": IDOSELL_API_KEY,
        "Accept": "application/json",
    }
    params = [("productIds", pid) for pid in lista_id]

    try:
        response = requests.get(url, headers=headers, params=params, timeout=15)
        if response.status_code == 200:
            dane = response.json()
            wyniki = dane.get("Results", [])
            for prod in wyniki:
                pid = prod.get("productId")

                zdjecia = prod.get("productImages", [])
                url_zdjecia = ""
                if zdjecia:
                    url_zdjecia = zdjecia[0].get("productImageLargeUrl", "")
                    if url_zdjecia.startswith("//"):
                        url_zdjecia = "https:" + url_zdjecia

                url_produktu = ""
                urls_data = prod.get("productUrl", {}).get("productUrlsLangData", [])
                if urls_data:
                    url_produktu = urls_data[0].get("url", "")
                else:
                    url_produktu = f"https://{IDOSELL_DOMAIN}/product-pol-{pid}.html"

                if url_zdjecia:
                    produkty.append(
                        {
                            "id": str(pid),
                            "url_produktu": url_produktu,
                            "url_zdjecia": url_zdjecia,
                        }
                    )
        else:
            st.error(f"Błąd API IdoSell podczas pobierania zdjęć: {response.status_code}")
    except Exception as e:
        st.error(f"Błąd połączenia z IdoSell: {e}")

    return produkty


def generuj_kolaz_b64(lista_url, docelowa_szerokosc=1200, docelowa_wysokosc=630):
    try:
        obrazy = []
        for url in lista_url:
            if not url:
                continue
            response = requests.get(url, stream=True, timeout=20)
            if response.status_code == 200:
                img = Image.open(response.raw).convert("RGB")
                obrazy.append(img)

        if not obrazy:
            return None

        liczba_obrazow = len(obrazy)
        szerokosc_pojedyncza = docelowa_szerokosc // liczba_obrazow
        kolaz = Image.new("RGB", (docelowa_szerokosc, docelowa_wysokosc), (255, 255, 255))

        for i, img in enumerate(obrazy):
            img_ratio = img.width / img.height
            target_ratio = szerokosc_pojedyncza / docelowa_wysokosc

            if img_ratio > target_ratio:
                nowa_wysokosc = docelowa_wysokosc
                nowa_szerokosc = int(nowa_wysokosc * img_ratio)
                img = img.resize((nowa_szerokosc, nowa_wysokosc), Image.LANCZOS)
                left = (nowa_szerokosc - szerokosc_pojedyncza) / 2
                img = img.crop((left, 0, left + szerokosc_pojedyncza, docelowa_wysokosc))
            else:
                nowa_szerokosc = szerokosc_pojedyncza
                nowa_wysokosc = int(nowa_szerokosc / img_ratio)
                img = img.resize((nowa_szerokosc, nowa_wysokosc), Image.LANCZOS)
                top = (nowa_wysokosc - docelowa_wysokosc) / 2
                img = img.crop((0, top, szerokosc_pojedyncza, top + docelowa_wysokosc))

            kolaz.paste(img, (i * szerokosc_pojedyncza, 0))

        buffered = io.BytesIO()
        kolaz.save(buffered, format="JPEG", quality=85)
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return f"data:image/jpeg;base64,{img_str}"
    except Exception as e:
        st.error(f"Błąd podczas generowania kolażu: {e}")
        return None


def wyslij_do_idosell_api(payload):
    url = f"https://{IDOSELL_DOMAIN}/api/admin/v7/entries/entries"
    headers = {
        "X-API-KEY": IDOSELL_API_KEY,
        "Content-Type": "application/json",
    }
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        try:
            return response.json(), response.status_code
        except Exception:
            return {"error": response.text}, response.status_code
    except Exception as e:
        return {"error": str(e)}, 500


# --- KONFIGURACJA GŁÓWNA ---
KONTEKST_SKLEPU = """
Jesteś ekspertem SEO i copywriterem dla polskiej marki odzieżowej (siedziba i szwalnia we Wrocławiu).
Specyfika sklepu: odzież casualowa i basic (bawełna, wiskoza), wysoka jakość, konkurencyjna cena.
Grupa docelowa: Gen Z i późni Millenialsi (15-30 lat). Zawsze pisz w języku polskim.
"""

WZOR_HTML_IDOSELL = """
<div style="display: flex; flex-direction: column;" class="iai-section-html-wrapper">
<div style="display: flex;" class="iai-section-photo_and_text">
<div style="flex: 1 1 0%;" class="iai-section-photo-half"><a href="URL_PRODUKTU"><img style="max-width: 100%; display: block; margin-left: auto; margin-right: auto;" src="URL_ZDJECIA" border="0" width="90%"></a></div>
<div style="flex: 1 1 0%;" class="iai-section-text-half">
<h3 style="font-size: 14pt; text-align: justify;"><span style="font-size: 12pt; font-family: Arial,sans-serif; color: #000000; font-weight: bold;">TUTAJ NAGŁÓWEK</span></h3>
<p style="text-align: justify;"><span style="font-size: 11pt; font-family: Arial,sans-serif; color: #000000;">TUTAJ TEKST AKAPITU</span></p>
</div>
</div>
<div style="flex-direction: column;" class="iai-section-text">
<p style="text-align: justify;"><span style="font-size: 11pt; font-family: Arial,sans-serif; color: #000000;">TUTAJ KOLEJNY TEKST BEZ ZDJĘCIA</span></p>
</div>
</div>
"""

# --- UI ---
st.set_page_config(page_title="Asystent Content Marketingu", page_icon="📝", layout="wide")

st.markdown(
    """
<style>
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;600;700&family=Outfit:wght@400;500;600;700;800&display=swap');

    html, body, [class*="css"], .stMarkdown p, .stText, span, label, input, textarea, div[role="radiogroup"] {
        font-family: 'Manrope', sans-serif !important;
    }

    h1, h2, h3, h4, h5, h6, .st-emotion-cache-10trblm h1, .stMarkdown h1, .stMarkdown h2, .stMarkdown h3 {
        font-family: 'Outfit', sans-serif !important;
    }

    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}

    div.stButton > button:first-child {
        border-radius: 3px !important;
        background-color: #000000 !important;
        color: #ffffff !important;
        border: 1px solid #000000 !important;
        font-family: 'Manrope', sans-serif !important;
        font-weight: 600 !important;
        transition: all 0.3s ease !important;
    }

    div.stButton > button:first-child:hover {
        background-color: #333333 !important;
        color: #ffffff !important;
        border-color: #333333 !important;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }

    div.stSuccess {
        border-radius: 8px;
        border-left: 5px solid #28a745;
    }

    div.stInfo {
        border-radius: 8px;
        border-left: 5px solid #17a2b8;
    }
</style>
""",
    unsafe_allow_html=True,
)

st.markdown(
    """
    <div style="display: flex; justify-content: center; padding-top: 10px; padding-bottom: 20px;">
        <img src="https://wassyl.pl/data/gfx/mask/pol/logo_1_big.svg" width="220" alt="Wassyl Logo">
    </div>
    """,
    unsafe_allow_html=True,
)

# --- STAN APLIKACJI ---
draft_data = load_draft()

if "zakladka" not in st.session_state:
    st.session_state.zakladka = draft_data.get("zakladka", "1. Tematy na podstawie trendów")
if "wybrany_temat" not in st.session_state:
    st.session_state.wybrany_temat = draft_data.get("wybrany_temat", "")
if "aktualny_wpis" not in st.session_state:
    st.session_state.aktualny_wpis = draft_data.get("aktualny_wpis", "")
if "gotowy_html" not in st.session_state:
    st.session_state.gotowy_html = draft_data.get("gotowy_html", "")
if "kolaz_b64" not in st.session_state:
    st.session_state.kolaz_b64 = draft_data.get("kolaz_b64", "")

st.markdown(
    "<h1 style='text-align: center; margin-bottom: 30px;'>Asystent Content Marketingu</h1>",
    unsafe_allow_html=True,
)

# --- SIDEBAR ---
with st.sidebar:
    st.header("Wybierz tryb pracy:")
    opcje_menu = (
        "1. Tematy na podstawie trendów",
        "2. Tematy na podstawie danych",
        "3. Stwórz wpis",
        "4. Publikacja IdoSell",
    )
    opcja = st.radio("Dostępne funkcje:", opcje_menu, key="zakladka")

    st.markdown("---")
    st.subheader("⚙️ Status API IdoSell")
    if IDOSELL_DOMAIN and IDOSELL_API_KEY:
        st.success(f"Połączono z: {IDOSELL_DOMAIN}")
    else:
        st.error("Brak zmiennych środowiskowych. Dodaj IDOSELL_DOMAIN i IDOSELL_API_KEY.")

    st.markdown("---")
    st.subheader("🌍 Analiza strony na żywo")
    url_sklepu = st.text_input("Wklej link (np. do bestsellerów/nowości):")

    st.markdown("---")
    if st.button("🗑️ Wyczyść wersję roboczą (Reset)", type="secondary"):
        clear_draft()
        st.rerun()

dodatkowy_kontekst = ""
if url_sklepu:
    with st.spinner("Czytam podaną stronę..."):
        tekst_strony = pobierz_tekst_ze_strony(url_sklepu)
        if tekst_strony:
            dodatkowy_kontekst = f"\nDane ze strony: {tekst_strony}\n"

# === ZAKŁADKI 1 i 2 ===
if opcja in ["1. Tematy na podstawie trendów", "2. Tematy na podstawie danych"]:
    if opcja == "1. Tematy na podstawie trendów":
        st.header("📈 Tematy pod Google Discover (Trendy)")
        prompt_baza = "Skup się na aktualnym sezonie i rynkowych trendach."
        przycisk_text = "Zaproponuj 3 nowe tematy"
        dane_wejsciowe = ""
    else:
        st.header("💡 Propozycje z Twojego pomysłu")
        dane_wejsciowe = st.text_input("Wpisz swój pomysł (np. 'wiskoza na lato'):")
        prompt_baza = (
            f"Bazuj na następującym pomyśle/haśle: {dane_wejsciowe}."
            if dane_wejsciowe
            else ""
        )
        przycisk_text = "Generuj tematy"

    if st.button(przycisk_text):
        if opcja == "2. Tematy na podstawie danych" and not dane_wejsciowe:
            st.warning("Najpierw wpisz pomysł!")
        else:
            with st.spinner("Pracuję nad tematami..."):
                zapytanie = f"""
{KONTEKST_SKLEPU} {dodatkowy_kontekst}
Zadanie: Zaproponuj 3 chwytliwe tematy na wpis blogowy pod Google Discover. {prompt_baza}
WYMÓG KRYTYCZNY: Zwróć wynik BEZWZGLĘDNIE jako listę JSON.
Format:
[
  {{"tytul": "Twój chwytliwy tytuł 1", "uzasadnienie": "Krótkie wyjaśnienie dlaczego zadziała"}},
  {{"tytul": "Twój chwytliwy tytuł 2", "uzasadnienie": "Krótkie wyjaśnienie dlaczego zadziała"}}
]
"""
                try:
                    odpowiedz = generuj_tekst_ai(zapytanie)
                    surowy_json = wyczysc_json(odpowiedz.text)
                    tematy = json.loads(surowy_json)

                    st.success("Oto moje propozycje:")
                    for t in tematy:
                        with st.container():
                            st.markdown(f"### 📌 {t['tytul']}")
                            st.write(f"**Dlaczego to zadziała:** {t['uzasadnienie']}")
                            st.button(
                                "✨ Przejdź do realizacji",
                                key=f"btn_{t['tytul']}",
                                on_click=przejdz_do_realizacji,
                                args=(t["tytul"],),
                            )
                            st.markdown("---")
                except Exception as e:
                    st.error(f"Błąd przetwarzania. Szczegóły: {e}")

# === ZAKŁADKA 3 ===
elif opcja == "3. Stwórz wpis":
    st.header("✍️ Kreator wpisów na bloga")
    st.info("Wszystko, co tu wygenerujesz, jest automatycznie zapisywane w wersji roboczej.")

    temat_wpisu = st.text_input("Wybrany temat artykułu:", value=st.session_state.wybrany_temat)
    wytyczne_dodatkowe = st.text_area("Twoje dodatkowe wytyczne (opcjonalnie):")

    if st.button("🚀 Wygeneruj pierwszą wersję wpisu"):
        if temat_wpisu:
            st.session_state.wybrany_temat = temat_wpisu
            save_draft()
            with st.spinner("Tworzę artykuł (ok. 4000-5000 znaków)..."):
                prompt_artykul = f"""
{KONTEKST_SKLEPU} {dodatkowy_kontekst}
Zadanie: Napisz wpis na bloga na temat: "{temat_wpisu}".
Wytyczne użytkownika: {wytyczne_dodatkowe}

KRYTERIA:
1. Tytuł (H1): Zoptymalizowany pod Discover, wzbudzający ciekawość.
2. Lead (Zajawka): Dowcipny, edgy i przykuwający uwagę Gen Z / Millenialsów. Maksymalnie 300 znaków.
3. Struktura: Minimum 3 rozbudowane śródtytuły (H2).
4. E-E-A-T: Pokaż doświadczenie szwalni we Wrocławiu i wiedzę o materiałach.
5. Długość i Styl: Celuj w 4000-5000 znaków ze spacjami. Maksimum 6000 znaków. Pisz zwięźle.
Format: Markdown.
"""
                try:
                    odpowiedz = generuj_tekst_ai(prompt_artykul)
                    st.session_state.aktualny_wpis = odpowiedz.text
                    save_draft()
                except Exception as e:
                    st.error(f"Błąd: {e}")
        else:
            st.warning("Najpierw podaj temat!")

    if st.session_state.aktualny_wpis:
        st.markdown("### 📝 Twój Artykuł:")
        with st.container(border=True):
            st.markdown(st.session_state.aktualny_wpis)
            st.info(f"📊 Długość tekstu: około **{len(st.session_state.aktualny_wpis)} znaków**.")

        st.markdown("### 🛠️ Co robimy dalej?")
        uwagi = st.text_input("Masz uwagi? Wpisz je tutaj:")

        kolumna1, kolumna2 = st.columns(2)

        with kolumna1:
            if st.button("🔄 Nanieś poprawki"):
                if uwagi:
                    with st.spinner("Aplikuję Twoje poprawki..."):
                        prompt_poprawa = f"""
{KONTEKST_SKLEPU}
Zadanie: Przebuduj ten tekst zgodnie z uwagami użytkownika: "{uwagi}".
Lead nie może przekraczać 300 znaków. Cały tekst: 4000-5000 znaków, maks. 6000.
Oto aktualny tekst:
{st.session_state.aktualny_wpis}
"""
                        try:
                            nowa_odpowiedz = generuj_tekst_ai(prompt_poprawa)
                            st.session_state.aktualny_wpis = nowa_odpowiedz.text
                            save_draft()
                            st.rerun()
                        except Exception as e:
                            st.error(f"Błąd poprawek: {e}")
                else:
                    st.warning("Wpisz uwagi.")

        with kolumna2:
            st.button("✅ Przejdź do formatowania IdoSell", on_click=przejdz_do_idosell)

# === ZAKŁADKA 4 ===
elif opcja == "4. Publikacja IdoSell":
    st.header("⚙️ Formularz Publikacji (IdoSell API)")

    if not st.session_state.aktualny_wpis:
        st.warning("Najpierw stwórz wpis w zakładce nr 3!")
    else:
        domyslny_tytul, domyslny_lead = wyciagnij_tytul_i_lead(st.session_state.aktualny_wpis)

        col_form1, col_form2 = st.columns([2, 1])

        with col_form1:
            st.subheader("1. Podstawowe metadane")
            form_tytul = st.text_input("Nazwa wpisu (Tytuł):", value=domyslny_tytul)
            form_lead = st.text_area("Zajawka tekstu (Lead):", value=domyslny_lead, height=100)

            st.subheader("2. Powiązania produktowe")
            form_produkty_polecane = st.text_input(
                "ID produktów polecanych (oddzielone przecinkami):",
                placeholder="np. 16216, 16254",
            )
            form_produkty_html = st.text_input(
                "ID produktów do grafik w treści HTML:",
                placeholder="np. 16216, 16357",
            )

        with col_form2:
            st.subheader("3. Główna grafika (Kolaż)")
            form_produkty_kolaz = st.text_input("ID produktów na kolaż:", placeholder="np. 16216, 16254")

            col_wymiar1, col_wymiar2 = st.columns(2)
            with col_wymiar1:
                kolaz_szerokosc = st.number_input("Szerokość (px)", value=1200, step=10)
            with col_wymiar2:
                kolaz_wysokosc = st.number_input("Wysokość (px)", value=630, step=10)

            if st.button("🖼️ Generuj Kolaż"):
                if form_produkty_kolaz:
                    with st.spinner("Pobieram zdjęcia przez API IdoSell i tworzę kolaż..."):
                        produkty_do_kolazu = pobierz_dane_produktow_idosell(form_produkty_kolaz)
                        if produkty_do_kolazu:
                            lista_url = [p["url_zdjecia"] for p in produkty_do_kolazu]
                            b64_kolaz = generuj_kolaz_b64(
                                lista_url, kolaz_szerokosc, kolaz_wysokosc
                            )
                            if b64_kolaz:
                                st.session_state.kolaz_b64 = b64_kolaz
                                save_draft()
                                st.success("Kolaż gotowy i zapisany w szkicu!")
                        else:
                            st.warning("Nie udało się pobrać żadnych zdjęć. Sprawdź poprawność ID.")
                else:
                    st.warning("Podaj ID produktów.")

            if st.session_state.kolaz_b64:
                st.image(st.session_state.kolaz_b64, caption="Zapisany kolaż z serwera IdoSell")

        st.markdown("---")
        st.subheader("4. Generowanie Treści HTML i Publikacja")

        if st.button("✨ Konwertuj tekst na kod IdoSell HTML"):
            with st.spinner("Pobieram dane produktów i formatuję kod..."):
                produkty_html = []
                if form_produkty_html:
                    produkty_html = pobierz_dane_produktow_idosell(form_produkty_html)

                dane_produktow_str = json.dumps(produkty_html, ensure_ascii=False)

                prompt_html = f"""
Zadanie: Przekształć poniższy artykuł na czysty kod HTML zgodny z IdoSell.
Wzór:
{WZOR_HTML_IDOSELL}

Produkty do wplecenia w tekst jako zdjęcia obok akapitów:
{dane_produktow_str}

ZASADY:
- Zwróć TYLKO czysty kod HTML.
- Każdy akapit w <p style="...">.
- Każdy nagłówek w <h3 style="...">.

Artykuł:
{st.session_state.aktualny_wpis}
"""
                try:
                    odpowiedz_html = generuj_tekst_ai(prompt_html)
                    czysty_html = wyczysc_json(odpowiedz_html.text)
                    if czysty_html.startswith("html"):
                        czysty_html = czysty_html[4:].strip()

                    st.session_state.gotowy_html = czysty_html
                    save_draft()
                    st.success("✅ Kod HTML wygenerowany i zapisany w szkicu!")
                except Exception as e:
                    st.error(f"Błąd konwersji: {e}")

        if st.session_state.gotowy_html:
            with st.expander("👁️ Podgląd wygenerowanego kodu HTML"):
                st.components.v1.html(st.session_state.gotowy_html, height=400, scrolling=True)

            st.markdown("### 🚀 Wysyłka do sklepu (wymaga kluczy IdoSell)")
            if st.button("🚀 WYŚLIJ WPIS DO IDOSELL", type="primary"):
                if not IDOSELL_DOMAIN or not IDOSELL_API_KEY:
                    st.error("Ustaw zmienne środowiskowe IDOSELL_DOMAIN i IDOSELL_API_KEY przed wysyłką.")
                else:
                    with st.spinner("Trwa wysyłka do API IdoSell..."):
                        payload = {
                            "params": {
                                "shopId": 1,
                                "visible": "n",
                                "langs": [
                                    {
                                        "langId": "pol",
                                        "title": form_tytul,
                                        "shortDescription": form_lead,
                                        "longDescription": st.session_state.gotowy_html,
                                    }
                                ],
                            }
                        }

                        if st.session_state.kolaz_b64:
                            baza64_czysta = st.session_state.kolaz_b64.split(",")[1]
                            payload["params"]["pictureData"] = {
                                "pictureBase64": baza64_czysta,
                                "pictureFormat": "jpg",
                            }

                        if form_produkty_polecane:
                            id_tab = [
                                int(x.strip())
                                for x in form_produkty_polecane.split(",")
                                if x.strip().isdigit()
                            ]
                            if id_tab:
                                payload["params"]["products"] = [{"productId": pid} for pid in id_tab]

                        api_odpowiedz, api_kod = wyslij_do_idosell_api(payload)

                        if api_kod == 200:
                            entry_id = api_odpowiedz.get("result", {}).get("entryId", "Brak ID")
                            st.success(
                                f"🎉 Wpis został pomyślnie utworzony w panelu IdoSell! ID wpisu: {entry_id}"
                            )
                            st.balloons()
                            clear_draft()
                        else:
                            st.error(f"❌ Błąd wysyłki (Kod {api_kod}): {api_odpowiedz}")
