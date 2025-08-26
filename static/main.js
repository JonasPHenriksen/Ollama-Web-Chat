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
            chat.innerHTML += renderMessage(msg.role, msg.content);
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

async function sendMessage() {
    const model = document.getElementById("model").value;
    const prompt = document.getElementById("prompt").value;
    const imageFile = document.getElementById("image-upload").files[0];
    if (!prompt.trim() && !imageFile) return;

    const chat = document.getElementById("chat");

    if (prompt.trim()) {
        chat.innerHTML += renderMessage("user", prompt);
        document.getElementById("prompt").value = "";
    }

    if (imageFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            chat.innerHTML += `<img src="${e.target.result}" style="max-width: 30%; border-radius: 6px;"></div>`;
        };
        reader.readAsDataURL(imageFile);
        document.getElementById("image-upload").value = "";
    }

    const formData = new FormData();
    formData.append("model", model);
    if (prompt.trim()) formData.append("prompt", prompt);
    if (imageFile) formData.append("image", imageFile);

    function isUserAtBottom(element, threshold = 0.1) {
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    return (distanceFromBottom / element.scrollHeight) < threshold;
    }

    try {
        const res = await fetch("/ask_stream", {
            method: "POST",
            body: formData
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        const aiDiv = document.createElement("div");
        aiDiv.className = "ai";
        aiDiv.innerHTML = "<strong>AI:</strong> ";
        chat.appendChild(aiDiv);
        let result = "";
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            result += decoder.decode(value, { stream: true });

            const shouldScroll = isUserAtBottom(chat);
            aiDiv.innerHTML = "<strong>AI:</strong> " + marked.parse(result.replace(/\[IMAGE\](.+)/g, (match, p1) => {
                let imgPath = p1.trim();
                const uploadsIndex = imgPath.indexOf("/uploads/");
                if (uploadsIndex !== -1) imgPath = imgPath.substring(uploadsIndex + 1);
                return `<br><img src="${imgPath}" style="max-width: 30%; border-radius: 6px;">`;
            }));

            if (shouldScroll) {
                chat.scrollTop = chat.scrollHeight;
            }
        }

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
        sendMessage();
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

setInterval(updateVRAM, 30000);
updateVRAM();  

async function askStream(prompt, model="gemma:4b") {
    const res = await fetch("/ask_stream", {
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

function renderMessage(role, content) {
    function parseContent(text) {
        // Handle [IMAGE] tags
        text = text.replace(/\[IMAGE\](.+)/g, (match, p1) => {
            let imgPath = p1.trim();
            const uploadsIndex = imgPath.indexOf("/uploads/");
            if (uploadsIndex !== -1) imgPath = imgPath.substring(uploadsIndex + 1);
            return `<br><img src="${imgPath}" style="max-width: 30%; border-radius: 6px;">`;
        });
        return text;
    }

    let htmlContent;
    if (role === "user") {
        htmlContent = `<div class="user"><strong>You:</strong> ${parseContent(escapeHtml(content))}</div>`;
    } else {
        htmlContent = `<div class="ai"><strong>AI:</strong> ${marked.parse(parseContent(content))}</div>`;
    }

    return htmlContent;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}


window.onload = loadModels;
