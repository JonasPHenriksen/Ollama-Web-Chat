from flask import Flask, request, render_template_string, jsonify, session, abort
import subprocess
import json
import os

app = Flask(__name__)
app.secret_key = "supersecretkey"

CHAT_HISTORY_FILE = "chat_history.json"

def load_all_chat_histories():
    if os.path.exists(CHAT_HISTORY_FILE):
        with open(CHAT_HISTORY_FILE, "r") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return {}
    return {}

def save_all_chat_histories(all_histories):
    with open(CHAT_HISTORY_FILE, "w") as f:
        json.dump(all_histories, f, indent=4)

def load_chat_history(user_id):
    all_histories = load_all_chat_histories()
    return all_histories.get(user_id, [])

def save_chat_history(user_id, history):
    all_histories = load_all_chat_histories()
    all_histories[user_id] = history
    save_all_chat_histories(all_histories)

HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Ollama Web Chat</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        /* General body and container styles */
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: radial-gradient(circle at top left, #0f2027, #203a43, #2c5364);
            color: #e0e0e0;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        h1 {
            text-align: center;
            padding: 20px;
            margin: 0;
            color: #00e5ff;
            text-shadow: 0 0 10px #00e5ff, 0 0 20px #0099cc;
            font-weight: 400;
        }

        /* Main chat layout */
        #chat-container {
            display: flex;
            flex: 1;
            margin: 10px 20px;
            min-height: 0; /* Add this to prevent content from pushing past the viewport */
        }

        /* Chat list sidebar */
        #chat-list {
            width: 250px;
            background: rgba(20, 20, 30, 0.7);
            border-radius: 12px;
            padding: 15px;
            margin-right: 10px;
            box-shadow: inset 0 0 10px rgba(0,255,255,0.2);
            display: flex;
            flex-direction: column;
        }
        #chat-list-items {
            flex: 1; /* This is the key fix for the chat list scrolling */
            overflow-y: auto;
        }
        .chat-item {
            padding: 10px;
            cursor: pointer;
            border-radius: 6px;
            margin-bottom: 5px;
            background: rgba(0, 229, 255, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }
        .chat-item:hover {
            background: rgba(0, 229, 255, 0.2);
        }
        .active-chat {
            border: 1px solid #00e5ff;
        }
        .delete-btn {
            background: none;
            border: none;
            color: #ff6347;
            cursor: pointer;
            font-size: 1.2em;
        }
        #new-chat-btn {
            background: #4caf50;
            margin-top: 10px;
            flex-shrink: 0;
        }

        /* Main chat window */
        #chat-window {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: rgba(20, 20, 30, 0.7);
            border-radius: 12px;
            box-shadow: inset 0 0 10px rgba(0,255,255,0.2);
        }
        #chat {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
        }

        /* Chat message styles */
        .user {
            color: #00e5ff;
            margin: 8px 0;
        }
        .ai {
            color: #76ff03;
            margin: 8px 0 15px 0;
        }

        /* Input and model selection styles */
        #input-area {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 15px 20px;
            background: rgba(10, 10, 20, 0.85);
            border-top: 1px solid rgba(0, 229, 255, 0.2);
            backdrop-filter: blur(6px);
            border-radius: 0 0 12px 12px;
            flex-shrink: 0; /* Add this to prevent it from shrinking */
        }
        select, textarea {
            background: rgba(30, 30, 40, 0.9);
            border: 1px solid rgba(0,229,255,0.4);
            border-radius: 8px;
            padding: 10px;
            color: #e0e0e0;
            font-size: 14px;
            outline: none;
        }
        textarea {
            resize: none;
            height: 80px;
        }
        /* Add this new rule to the <style> block */
        select:disabled {
            background-color: #0d0d0d;
            color: #5c5757;
        }
    </style>
</head>
<body>
    <h1>Ollama Web Chat</h1>
    <div id="chat-container">
        <div id="chat-list">
            <h3>Chats</h3>
            <div id="chat-list-items"></div>
            <button id="new-chat-btn" onclick="startNewChat()">Start New Chat</button>
            <button id="shutdown-btn" style="background:#ff4444; margin-top:10px;" onclick="systemShutdown()">Shutdown System</button>
        </div>
        <div id="chat-window">
            <div id="chat"></div>
            <div id="input-area">
                <label for="model">Select Model:</label>
                <select id="model"></select>
                <textarea id="prompt" placeholder="Type your question here..."></textarea>
            </div>
        </div>
    </div>
<script>
    // Store the current chat ID
    let currentChatId = null;

    async function loadModels() {
        try {
            const res = await fetch("/models");
            if (!res.ok) throw new Error("Failed to load models");
            const models = await res.json();
            const select = document.getElementById("model");
            select.innerHTML = "";
            if (models.length === 0) {
                select.innerHTML = '<option value="" disabled>No models available</option>';
            } else {
                models.forEach(m => {
                    const option = document.createElement("option");
                    option.value = m;
                    option.text = m;
                    select.add(option);
                });
            }
            loadChatList();
        } catch (error) {
            console.error("Error loading models:", error);
            const select = document.getElementById("model");
            select.innerHTML = '<option value="" disabled>Error loading models</option>';
        }
    }

    async function loadChatList() {
        try {
            const res = await fetch("/list_chats");
            if (!res.ok) throw new Error("Failed to load chat list");
            // The API now returns an array of objects
            const chats = await res.json();
            const chatListItems = document.getElementById("chat-list-items");
            chatListItems.innerHTML = "";
            
            if (chats.length === 0) {
                startNewChat();
                return;
            }
            
            chats.forEach(chat => {
                const chatItem = document.createElement("div");
                chatItem.className = "chat-item";
                chatItem.innerHTML = `<span>${chat.title}</span><button class="delete-btn" onclick="deleteChat(event, '${chat.id}')">❌</button>`;
                chatItem.onclick = () => switchChat(chat.id);
                chatListItems.appendChild(chatItem);
            });

            if (!currentChatId || !chats.some(chat => chat.id === currentChatId)) {
                // Set the current chat to the first one in the list
                await switchChat(chats[0].id);
            } else {
                // Otherwise, load the history for the existing current chat
                await loadChatHistory();
                document.querySelector(`[onclick="switchChat('${currentChatId}')"]`).classList.add('active-chat');
            }
        } catch (error) {
            console.error("Error loading chat list:", error);
        }
    }

    async function switchChat(chatId) {
        try {
            const res = await fetch(`/switch_chat/${chatId}`, { method: 'POST' });
            if (!res.ok) throw new Error("Failed to switch chat");

            document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active-chat'));
            const activeItem = document.querySelector(`[onclick="switchChat('${chatId}')"]`);
            if(activeItem) {
                activeItem.classList.add('active-chat');
            }

            currentChatId = chatId;
            loadChatHistory();
        } catch (error) {
            alert("Error switching chat: " + error.message);
        }
    }

    async function startNewChat() {
        try {
            const res = await fetch("/new_chat", { method: 'POST' });
            if (!res.ok) throw new Error("Failed to start new chat");
            const newChatId = await res.json();
            await loadChatList();
            await switchChat(newChatId);
        } catch (error) {
            alert("Error starting new chat: " + error.message);
        }
    }

    async function deleteChat(event, chatId) {
        event.stopPropagation();
        if (!confirm("Are you sure you want to delete this chat?")) return;
        try {
            const res = await fetch(`/delete_chat/${chatId}`, { method: 'POST' });
            if (!res.ok) throw new Error("Failed to delete chat");

            const responseData = await res.json();
            if (responseData.new_chat_id) {
                // If a new chat was created, switch to it
                await loadChatList();
                await switchChat(responseData.new_chat_id);
            } else {
                // Otherwise, just reload the list
                await loadChatList();
            }
        } catch (error) {
            alert("Error deleting chat: " + error.message);
        }
    }

    async function loadChatHistory() {
        try {
            const res = await fetch("/history");
            if (!res.ok) throw new Error("Failed to load history");
            const history = await res.json();
            const chat = document.getElementById("chat");
            chat.innerHTML = "";
            history.forEach(msg => {
                const role = msg.role === "user" ? "You" : "AI";
                const className = msg.role === "user" ? "user" : "ai";
                chat.innerHTML += `<div class="${className}"><strong>${role}:</strong> ${marked.parse(msg.content)}</div>`;
            });
            chat.scrollTop = chat.scrollHeight;

            // Lock model if chat history is not empty
            const modelSelect = document.getElementById("model");
            modelSelect.disabled = history.length > 0;
        } catch (error) {
            console.error("Error loading chat history:", error);
        }
    }

    async function sendPrompt() {
        const model = document.getElementById("model").value;
        const prompt = document.getElementById("prompt").value;
        if (!prompt.trim() || !model) return;
        const chat = document.getElementById("chat");
        chat.innerHTML += '<div class="user"><strong>You:</strong> ' + marked.parse(prompt) + '</div>';
        document.getElementById("prompt").value = "";
        try {
            const res = await fetch("/ask", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({model, prompt})
            });
            if (!res.ok) throw new Error("Failed to get response");
            const data = await res.text();
            chat.innerHTML += '<div class="ai"><strong>AI:</strong> ' + marked.parse(data) + '</div>';
            chat.scrollTop = chat.scrollHeight;
            loadChatList();
        } catch (error) {
            chat.innerHTML += '<div class="ai"><strong>Error:</strong> ' + error.message + '</div>';
            chat.scrollTop = chat.scrollHeight;
        }
    }

    async function systemShutdown() {
        if (!confirm("Are you sure you want to shut down the entire system?")) return;
        try {
            const res = await fetch("/system_shutdown", { method: "POST" });
            if (!res.ok) throw new Error("Failed to shutdown system");
            alert("System is shutting down...");
        } catch (error) {
            alert("Error: " + error.message);
        }
    }

    document.getElementById("prompt").addEventListener("keydown", function(event) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendPrompt();
        }
    });

    window.onload = loadModels;
</script>
</body>
</html>
"""

@app.route("/")
def home():
    if 'current_chat_id' not in session:
        session['current_chat_id'] = os.urandom(16).hex()
        save_chat_history(session['current_chat_id'], [])
    return render_template_string(HTML)

@app.route("/models")
def models():
    try:
        result = subprocess.run(["ollama", "list"], capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            return jsonify({"error": "Failed to list models", "details": result.stderr}), 500
        lines = result.stdout.splitlines()
        model_names = [line.split()[0] for line in lines[1:] if line.strip()]
        return jsonify(model_names)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/switch_chat/<chat_id>", methods=["POST"])
def switch_chat(chat_id):
    all_histories = load_all_chat_histories()
    if chat_id in all_histories:
        session['current_chat_id'] = chat_id
        return "Chat switched."
    return "Chat not found.", 404

@app.route("/ask", methods=["POST"])
def ask():
    
    data = request.json
    prompt = data.get("prompt", "")
    model = data.get("model", "gemma:7b")
    user_id = session.get('current_chat_id', None)
    
    if not user_id:
        return jsonify({"error": "No active chat found."}), 400

    all_histories = load_all_chat_histories()
    
    if user_id not in all_histories or not all_histories[user_id]["history"]:
        title = generate_chat_title(prompt, model)
        all_histories[user_id] = {"title": title, "history": []}
    
    all_histories[user_id]["history"].append({"role": "user", "content": prompt})
    
    conversation_text = ""
    for message in all_histories[user_id]["history"]:
        if message["role"] == "user":
            conversation_text += f"You: {message['content']}\n"
        else:
            conversation_text += f"AI: {message['content']}\n"
    
    try:
        process = subprocess.run(
            ["ollama", "run", model],
            input=conversation_text,
            capture_output=True,
            text=True,
            timeout=120
        )
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
        
@app.route("/reset", methods=["POST"])
def reset():
    user_id = session.get('current_chat_id', None)
    if user_id:
        save_chat_history(user_id, [])
    return "Conversation reset."

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
        
        title = title_process.stdout.strip().replace('"', '')
        return title[:50]
        
    except Exception as e:
        print(f"Error generating title: {e}")
        return "New Chat"
    
@app.route("/list_chats")
def list_chats():
    all_histories = load_all_chat_histories()
    chat_list_data = [{"id": chat_id, "title": data.get("title", "Untitled Chat")} for chat_id, data in all_histories.items()]
    return jsonify(chat_list_data)

@app.route("/history")
def get_history():
    user_id = session.get('current_chat_id', None)
    if not user_id:
        user_id = os.urandom(16).hex()
        session['current_chat_id'] = user_id
        save_chat_history(user_id, {"title": "New Chat", "history": []})
        return jsonify([])
    
    all_histories = load_all_chat_histories()
    chat_data = all_histories.get(user_id, {"title": "New Chat", "history": []})
    
    if isinstance(chat_data, list):
        history = chat_data
        all_histories[user_id] = {"title": "Untitled Chat", "history": history}
        save_all_chat_histories(all_histories)
        return jsonify(history)
    else:
        return jsonify(chat_data["history"])

@app.route("/new_chat", methods=["POST"])
def new_chat():
    new_chat_id = os.urandom(16).hex()
    session['current_chat_id'] = new_chat_id
    save_chat_history(new_chat_id, {"title": "New Chat", "history": []})
    return jsonify(new_chat_id)

@app.route("/delete_chat/<chat_id>", methods=["POST"])
def delete_chat(chat_id):
    all_histories = load_all_chat_histories()
    if chat_id in all_histories:
        del all_histories[chat_id]
        save_all_chat_histories(all_histories)
        if session.get('current_chat_id') == chat_id:
            session.pop('current_chat_id', None)
            new_chat_id = os.urandom(16).hex()
            session['current_chat_id'] = new_chat_id
            save_chat_history(new_chat_id, {"title": "New Chat", "history": []})
            return jsonify({"new_chat_id": new_chat_id, "message": "Chat deleted and a new one started."})
        return "Chat deleted."
    return "Chat not found.", 404

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
                return {}
            except json.JSONDecodeError:
                return {}
    return {}

def save_chat_history(user_id, chat_data):
    all_histories = load_all_chat_histories()
    all_histories[user_id] = chat_data
    save_all_chat_histories(all_histories)

@app.route("/system_shutdown", methods=["POST"])
def system_shutdown():
    try:
        subprocess.run(["sudo", "/sbin/shutdown", "now"])
        return "Shutting down system..."
    except Exception as e:
        return str(e), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
