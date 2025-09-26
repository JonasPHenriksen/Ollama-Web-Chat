from flask import Blueprint, request, session, jsonify, Response, stream_with_context, send_from_directory
from services.chat_service import (
    load_chat_history,
    save_chat_history,
    generate_chat_title,
    load_all_chat_histories,
    save_all_chat_histories
)
import os
import subprocess

chat_bp = Blueprint("chat", __name__)

SUMMARY_LOG = "summaries_debug.txt"

def run_ai(model, prompt):
    """Helper to run Ollama with a prompt and capture response."""
    process = subprocess.Popen(
        ["ollama", "run", model, "--think=false"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    ai_output, _ = process.communicate(prompt)
    process.wait()
    return ai_output.strip()

def log_summary_to_file(summary_text, kind="summary"):
    """Append summaries/super-summaries to a debug file."""
    with open(SUMMARY_LOG, "a", encoding="utf-8") as f:
        f.write(f"\n--- {kind.upper()} ---\n")
        f.write(summary_text + "\n")

def summarize_with_ai(user_question, ai_response, model="qwen3:8b"):
    conversation_text = f"User: {user_question}\nAI: {ai_response}"
    
    prompt = f"""Summarize the following question-and-answer exchange into a compact memory note. 
            Focus on the key facts and outcomes provided in the AI's response. 
            Be faithful to the content—do not add or invent details.

            Exchange:
            {conversation_text}

            Summary:"""

    summary = run_ai(model, prompt)
    log_summary_to_file(summary, kind="summary")
    return {"role": "system", "content": summary}

def super_summarize(summaries, model="qwen3:8b"):
    summaries_text = "\n".join([s["content"] for s in summaries])

    prompt = f"""Merge these memory notes into a single, concise super-summary.
                Preserve all essential facts, decisions, and topic shifts.
                Ensure logical flow and accuracy—do not invent information.
                Make it brief but comprehensive.

                Notes:
                {summaries_text}

                Super-summary:"""

    super_summary = run_ai(model, prompt)
    log_summary_to_file(super_summary, kind="super-summary")
    return {"role": "system", "content": super_summary}

def maybe_summarize(all_histories, user_id, model="qwen3:8b"):
    history = all_histories[user_id]["history"]

    if len(history) >= 2 and history[-2]['role'] == 'user' and history[-1]['role'] == 'ai':
        user_question = history[-2]['content']
        ai_response = history[-1]['content']
        
        summary_msg = summarize_with_ai(user_question, ai_response, model)
        all_histories[user_id].setdefault("summaries", []).append(summary_msg)

        summaries = all_histories[user_id].get("summaries", [])
        if len(summaries) >= 4:
            super_summary_msg = super_summarize(summaries, model)
            all_histories[user_id]["summaries"] = [super_summary_msg]

@chat_bp.route("/history")
def get_history():
    user_id = session.get('current_chat_id')
    if not user_id:
        user_id = os.urandom(16).hex()
        session['current_chat_id'] = user_id
        save_chat_history(user_id, {"title": "New Chat", "history": [], "summaries": [], "model": None})

    chat_data = load_chat_history(user_id)

    return jsonify({
        "history": chat_data.get("history", []),
        "model": chat_data.get("model", None),
        "title": chat_data.get("title", "New Chat")
    })

def build_conversation_text(all_histories, user_id, max_recent=5):
    summaries = all_histories[user_id].get("summaries", [])
    recent_messages = all_histories[user_id]["history"][-max_recent:]

    parts = []
    if summaries:
        parts.append(f"system: Previous conversation summary:\n{summaries[-1]['content']}")

    for msg in recent_messages:
        content = msg['content']
        if 'attachments' in msg and msg['attachments']:
            for attachment_path in msg['attachments']:
                content += f"\n[IMAGE]{attachment_path}"
        parts.append(f"{msg['role']}: {content}")

    return "\n".join(parts)

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

    attachments = []

    if image_file:
        upload_dir = os.path.join(os.getcwd(), "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        image_path = os.path.join(upload_dir, image_file.filename)
        image_file.save(image_path)
        attachments.append(image_path)  

    if user_id not in all_histories or not all_histories[user_id]["history"]:
        title = generate_chat_title(prompt, model)
        all_histories[user_id] = {
            "title": title,
            "history": [],
            "summaries": [],
            "model": model
        }

    if user_content.strip() or attachments:
        entry = {"role": "user", "content": user_content}
        if attachments:
            entry["attachments"] = attachments
        all_histories[user_id]["history"].append(entry)

    conversation_text = build_conversation_text(all_histories, user_id)

    with open("debug.txt", "w", encoding="utf-8") as f:
        f.write("Input to model:\n" + conversation_text + "\n")

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
        maybe_summarize(all_histories, user_id, model=model)
        save_all_chat_histories(all_histories)

    return Response(stream_with_context(generate()), mimetype="text/plain")

@chat_bp.route('/uploads/<filename>')
def uploaded_file(filename):
    upload_dir = os.path.join(os.getcwd(), "uploads")
    return send_from_directory(upload_dir, filename)