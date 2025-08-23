from flask import Blueprint, session, jsonify
import os
from services.chat_service import load_chat_history, save_chat_history, load_all_chat_histories, save_all_chat_histories

chat_mgmt_bp = Blueprint("chat_mgmt", __name__)

@chat_mgmt_bp.route("/new_chat", methods=["POST"])
def new_chat():
    new_chat_id = os.urandom(16).hex()
    session['current_chat_id'] = new_chat_id
    save_chat_history(new_chat_id, {"title": "New Chat", "history": [], "model": None})
    return jsonify(new_chat_id)

@chat_mgmt_bp.route("/delete_chat/<chat_id>", methods=["POST"])
def delete_chat(chat_id):
    all_histories = load_all_chat_histories()
    if chat_id in all_histories:
        del all_histories[chat_id]
        save_all_chat_histories(all_histories)

        # Remove current chat ID if it was deleted
        if session.get('current_chat_id') == chat_id:
            session.pop('current_chat_id', None)

        return jsonify({"success": True, "message": "Chat deleted."})
    return jsonify({"success": False, "message": "Chat not found."}), 404

@chat_mgmt_bp.route("/switch_chat/<chat_id>", methods=["POST"])
def switch_chat(chat_id):
    all_histories = load_all_chat_histories()
    if chat_id in all_histories:
        session['current_chat_id'] = chat_id
        return "Chat switched."
    return "Chat not found.", 404

@chat_mgmt_bp.route("/list_chats")
def list_chats():
    all_histories = load_all_chat_histories()
    chat_list_data = [{"id": chat_id, "title": data.get("title", "Untitled Chat")}
                      for chat_id, data in all_histories.items()]
    return jsonify(chat_list_data)
