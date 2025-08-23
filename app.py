from flask import Flask, render_template, jsonify
from config import SECRET_KEY

from routes.chat_routes import chat_bp
from routes.chat_management_routes import chat_mgmt_bp
from routes.model_routes import model_bp
from routes.system_routes import system_bp

app = Flask(__name__)
app.secret_key = SECRET_KEY

app.register_blueprint(chat_bp)
app.register_blueprint(chat_mgmt_bp)
app.register_blueprint(model_bp)
app.register_blueprint(system_bp, url_prefix="/system")

@app.route("/")
def home():
    return render_template("index.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

