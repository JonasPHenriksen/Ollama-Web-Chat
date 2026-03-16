import json
import os
from config import CHAT_HISTORY_FILE
import ollama

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
    all_histories = load_all_chat_histories()
    all_histories[user_id] = chat_data
    save_all_chat_histories(all_histories)

def generate_chat_title(prompt, model):
    try:
        response = ollama.chat(model=model, messages=[
            {'role': 'user', 'content': f"Create a 3-6 word title for this chat based on this message: {prompt}. Output only the title text."}
        ])

        return response['message']['content'].strip().replace('"', '')[:40]
        
    except Exception as e:
        print(f"Title generation error: {e}")
