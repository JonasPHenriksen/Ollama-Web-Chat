from flask import Blueprint, request, session, jsonify
from services.chat_service import load_chat_history, save_chat_history, generate_chat_title, load_all_chat_histories, save_all_chat_histories
import os
import subprocess

chat_bp = Blueprint("chat", __name__)

@chat_bp.route("/history")
def get_history():
    user_id = session.get('current_chat_id')
    if not user_id:
        user_id = os.urandom(16).hex()
        session['current_chat_id'] = user_id
        save_chat_history(user_id, {"title": "New Chat", "history": [], "model": None})

    chat_data = load_chat_history(user_id)
    
    return jsonify({
        "history": chat_data.get("history", []),
        "model": chat_data.get("model", None)
    })

@chat_bp.route("/ask", methods=["POST"])
def ask():
    data = request.json
    prompt = data.get("prompt", "")
    model = data.get("model", "gemma:7b")
    user_id = session.get('current_chat_id')

    if not user_id:
        return jsonify({"error": "No active chat found."}), 400

    all_histories = load_all_chat_histories()

    if user_id not in all_histories or not all_histories[user_id]["history"]:
        title = generate_chat_title(prompt, model)
        all_histories[user_id] = {"title": title, "history": []}
        all_histories[user_id]["model"] = model

    all_histories[user_id]["history"].append({"role": "user", "content": prompt})

    conversation_text = "\n".join([f"{msg['role'].capitalize()}: {msg['content']}" for msg in all_histories[user_id]["history"]])

    try:
        process = subprocess.run(["ollama", "run", model, "--think=false"],
                                 input=conversation_text,
                                 capture_output=True,
                                 text=True,
                                 timeout=120)
        if process.returncode != 0:
            return jsonify({"error": process.stderr}), 500

        ai_response = process.stdout.strip() or "No response from model"
        all_histories[user_id]["history"].append({"role": "ai", "content": ai_response})
        save_all_chat_histories(all_histories)
        return ai_response

    except subprocess.TimeoutExpired:
        return jsonify({"error": "Request timed out"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
