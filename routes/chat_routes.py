from flask import Blueprint, request, session, jsonify, Response, stream_with_context, send_from_directory
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

@chat_bp.route("/ask_stream", methods=["POST"])
def ask_stream():
    user_id = session.get("current_chat_id")
    if not user_id:
        return "No active chat found.", 400

    prompt = request.form.get("prompt", "")
    model = request.form.get("model", "gemma:4b")
    image_file = request.files.get("image")

    user_content = prompt if prompt else ""
    all_histories = load_all_chat_histories()

    image_path = None
    if image_file:
        upload_dir = os.path.join(os.getcwd(), "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        image_path = os.path.join(upload_dir, image_file.filename)
        image_file.save(image_path)
        user_content += f"\n[IMAGE]{image_path}"

    all_histories = load_all_chat_histories()
    if user_id not in all_histories or not all_histories[user_id]["history"]:
        title = generate_chat_title(prompt, model)
        all_histories[user_id] = {"title": title, "history": [], "model": model}

    if user_content.strip():  
        all_histories[user_id]["history"].append({"role": "user", "content": user_content})

    conversation_text = "\n".join([f"{msg['role'].capitalize()}: {msg['content']}" 
                                   for msg in all_histories[user_id]["history"]])

    process = subprocess.Popen(
        ["ollama", "run", model, "--think=false"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    process.stdin.write(conversation_text)
    process.stdin.close()

    def generate():
        ai_response = ""
        for line in iter(process.stdout.readline, ""):
            yield line
            ai_response += line
        process.wait()

        all_histories[user_id]["history"].append({"role": "ai", "content": ai_response})
        save_all_chat_histories(all_histories)

    return Response(stream_with_context(generate()), mimetype="text/plain")

@chat_bp.route('/uploads/<filename>')
def uploaded_file(filename):
    upload_dir = os.path.join(os.getcwd(), "uploads")
    return send_from_directory(upload_dir, filename)
