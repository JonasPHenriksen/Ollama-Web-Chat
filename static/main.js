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
            chatItem.dataset.id = chat.id;
            chatItem.innerHTML = `<span>${chat.title}</span>
                                <button class="delete-btn" onclick="deleteChat(event,'${chat.id}')">❌</button>`;
            chatItem.onclick = () => switchChat(chat.id);
            chatListItems.appendChild(chatItem);
        });

        const savedChatId = localStorage.getItem("lastChatId");

        if (savedChatId && chats.some(chat => chat.id === savedChatId)) {
            await switchChat(savedChatId); 
        } else {
            await switchChat(chats[0].id);  
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
        const activeItem = document.querySelector(`.chat-item[data-id="${chatId}"]`);
        if (activeItem) activeItem.classList.add('active-chat');

        currentChatId = chatId;
        localStorage.setItem("lastChatId", chatId);
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
        const responseData = await res.json();

        await loadChatList();

        const chatListItems = document.getElementById("chat-list-items");
        if (chatListItems.children.length > 0) {
            const firstChatId = chatListItems.children[0].dataset.id;
            if (firstChatId) await switchChat(firstChatId);
        } else {
            document.getElementById("chat").innerHTML = "";
            document.getElementById("model").disabled = false;
            currentChatId = null;
        }

    } catch (error) {
        alert("Error deleting chat: " + error.message);
    }
}

async function loadChatHistory() {
    try {
        const res = await fetch("/history");
        const data = await res.json();
        const history = data.history;
        const savedModel = data.model;

        const chat = document.getElementById("chat");
        chat.innerHTML = "";
        history.forEach(msg => {
            const role = msg.role === "user" ? "You" : "AI";
            const className = msg.role === "user" ? "user" : "ai";

            if (msg.role === "user") {
                chat.innerHTML += `<div class="${className}"><strong>${role}:</strong><pre><code>${escapeHtml(msg.content)}</code></pre></div>`;
            } else {
                chat.innerHTML += `<div class="${className}"><strong>${role}:</strong> ${marked.parse(msg.content)}</div>`;
            }
        });
        chat.scrollTop = chat.scrollHeight;

        const modelSelect = document.getElementById("model");
        if (savedModel) modelSelect.value = savedModel;
        modelSelect.disabled = history.length > 0;
    } catch (error) {
        console.error("Error loading chat history:", error);
    }
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

async function sendPrompt() {
    const model = document.getElementById("model").value;
    const prompt = document.getElementById("prompt").value;
    if (!prompt.trim() || !model) return;

    const chat = document.getElementById("chat");

    chat.innerHTML += `<div class="user"><strong>You:</strong><pre><code>${escapeHtml(prompt)}</code></pre></div>`;
    document.getElementById("prompt").value = "";

    try {
        const res = await fetch("/ask_stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, model })
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        const aiDiv = document.createElement("div");
        aiDiv.className = "ai";
        aiDiv.innerHTML = "<strong>AI:</strong> ";
        chat.appendChild(aiDiv);

        function isUserAtBottom(element, threshold = 0.1) {
            const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
            return (distanceFromBottom / element.scrollHeight) < threshold;
        }

        let result = "";
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            result += decoder.decode(value, { stream: true });
            aiDiv.innerHTML = "<strong>AI:</strong> " + marked.parse(result);

            if (isUserAtBottom(chat)) {
                chat.scrollTop = chat.scrollHeight;
            }
        }

        await loadChatList();

    } catch (error) {
        chat.innerHTML += `<div class="ai"><strong>Error:</strong><pre><code>${escapeHtml(error.message)}</code></pre></div>`;
        chat.scrollTop = chat.scrollHeight;
    }
}

async function systemShutdown() {
    if (!confirm("Are you sure you want to shut down the entire system?")) return;
    try {
        const res = await fetch("/system/system_shutdown", { method: "POST" });
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

async function updateVRAM() {
    try {
        const res = await fetch("/system/vram"); 
        const data = await res.json();
        document.getElementById("vram-usage").textContent =
            `VRAM Usage: ${data.vram_used_mb} / ${data.vram_total_mb} MB`;
    } catch (err) {
        console.error("Failed to fetch VRAM usage", err);
    }
}

setInterval(updateVRAM, 5000);
updateVRAM();  

async function askStream(prompt, model="gemma:4b") {
    const res = await fetch("/chat/ask_stream", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({prompt, model})
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let result = "";
    
    while (true) {
        const {value, done} = await reader.read();
        if (done) break;
        result += decoder.decode(value);
        document.getElementById("chat").textContent = result; 
    }
}

window.onload = loadModels;
