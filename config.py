import os

SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "supersecretkey")
CHAT_HISTORY_FILE = "chat_history.json"
