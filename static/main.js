let currentChatId = null;

async function loadModels() {
    try {
        const res = await fetch("/models");
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
        document.getElementById("model").innerHTML = '<option value="" disabled>Error loading models</option>';
    }
}

async function loadChatList() {
    try {
        const res = await fetch("/list_chats");
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
            chatItem.innerHTML = `<span>${chat.title}</span><button class="delete-btn" onclick="deleteChat(event,'${chat.id}')">❌</button>`;
            chatItem.onclick = () => switchChat(chat.id);
            chatListItems.appendChild(chatItem);
        });

        if (!currentChatId || !chats.some(chat => chat.id === currentChatId)) {
            await switchChat(chats[0].id);
        } else {
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
        if(activeItem) activeItem.classList.add('active-chat');

        currentChatId = chatId;
        loadChatHistory();
    } catch (error) {
        alert("Error switching chat: " + error.message);
    }
}

async function startNewChat() {
    try {
        const res = await fetch("/new_chat", { method: 'POST' });
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
        const data = await res.json();
        if (data.new_chat_id) {
            await loadChatList();
            await switchChat(data.new_chat_id);
        } else {
            await loadChatList();
        }
    } catch (error) {
        alert("Error deleting chat: " + error.message);
    }
}

async function loadChatHistory() {
    try {
        const res = await fetch("/history");
        const history = await res.json();
        const chat = document.getElementById("chat");
        chat.innerHTML = "";
        history.forEach(msg => {
            const role = msg.role === "user" ? "You" : "AI";
            const className = msg.role === "user" ? "user" : "ai";
            chat.innerHTML += `<div class="${className}"><strong>${role}:</strong> ${marked.parse(msg.content)}</div>`;
        });
        chat.scrollTop = chat.scrollHeight;

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
    chat.innerHTML += `<div class="user"><strong>You:</strong> ${marked.parse(prompt)}</div>`;
    document.getElementById("prompt").value = "";
    try {
        const res = await fetch("/ask", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({model, prompt})
        });
        const data = await res.text();
        chat.innerHTML += `<div class="ai"><strong>AI:</strong> ${marked.parse(data)}</div>`;
        chat.scrollTop = chat.scrollHeight;
        loadChatList();
    } catch (error) {
        chat.innerHTML += `<div class="ai"><strong>Error:</strong> ${error.message}</div>`;
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
