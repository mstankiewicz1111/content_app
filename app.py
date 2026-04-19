import os
from flask import Flask, render_template

# Import naszych nowych, zmodularyzowanych ścieżek
from api.ai import ai_bp
from api.idosell import idosell_bp
from api.tools import tools_bp

app = Flask(__name__)

# Rejestracja modułów
app.register_blueprint(ai_bp, url_prefix='/api')
app.register_blueprint(idosell_bp, url_prefix='/api/idosell')
app.register_blueprint(tools_bp, url_prefix='/api')

@app.route('/')
def index():
    # Sprawdzamy status konfiguracji sklepu
    domain = os.environ.get("IDOSELL_DOMAIN", "client5056.idosell.com").strip().replace('"', '').replace("'", "")
    api_key = os.environ.get("IDOSELL_API_KEY", "").strip().replace('"', '').replace("'", "")
    status_idosell = bool(domain and api_key)
    
    return render_template('index.html', status_idosell=status_idosell, domena=domain)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
