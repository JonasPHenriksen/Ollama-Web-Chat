import json
import os
from config import CHAT_HISTORY_FILE
import subprocess

def load_all_chat_histories():
    if os.path.exists(CHAT_HISTORY_FILE):
        with open(CHAT_HISTORY_FILE, "r") as f:
            try:
                data = json.load(f)
                if isinstance(data, dict):
                    for key, value in data.items():
                        if isinstance(value, list):
                            data[key] = {"title": "Untitled Chat", "history": value}
                    return data
            except json.JSONDecodeError:
                return {}
    return {}

def save_all_chat_histories(all_histories):
    with open(CHAT_HISTORY_FILE, "w") as f:
        json.dump(all_histories, f, indent=4)

def load_chat_history(user_id):
    all_histories = load_all_chat_histories()
    return all_histories.get(user_id, {"title": "New Chat", "history": []})

def save_chat_history(user_id, chat_data):
    """
    chat_data now can have:
    {
        "title": "Chat title",
        "history": [...],
        "model": "gemma:7b"
    }
    """
    all_histories = load_all_chat_histories()
    all_histories[user_id] = chat_data
    save_all_chat_histories(all_histories)

def generate_chat_title(prompt, model="gemma:4b"):
    try:
        title_prompt = (
            "Based on the following user message, generate a concise and descriptive chat title (under 5 words). "
            "Respond with only the title and nothing else. "
            f"User message: '{prompt}'"
        )
        title_process = subprocess.run(
            ["ollama", "run", model],
            input=title_prompt,
            capture_output=True,
            text=True,
            timeout=10
        )
        if title_process.returncode != 0:
            return "New Chat"
        return title_process.stdout.strip().replace('"', '')[:50]
    except Exception:
        return "New Chat"
