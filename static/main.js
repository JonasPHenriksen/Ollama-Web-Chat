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
      const chatItem = html(".chat-item", {
        children: [
        html("span", { text: chat.title }),
        html("button.delete-btn", {
          onclick: (event) => deleteChat(event, chat.id),
          text: "❌"
        })
        ],
        onclick: () => switchChat(chat.id)
      })
      chatItem.dataset.id = chat.id;
      chatListItems.prepend(chatItem);
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

    // Hide chat list on mobile after switching chat
    if (window.innerWidth <= 768) {
      document.getElementById('chat-list').classList.remove('visible');
    }
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
      document.getElementById("model").style.display = 'block';
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

    // Batch render messages
    const messages = history.map(msg => renderMessage(msg.role, msg.content, savedModel));
    chat.append(...messages)

    chat.scrollTop = chat.scrollHeight;

    const modelSelect = document.getElementById("model");
    if (savedModel) {
      modelSelect.value = savedModel;
      modelSelect.style.display = history.length > 0 ? 'none' : 'block';
      modelSelect.disabled = history.length > 0;
    } else {
      modelSelect.style.display = 'block';
      modelSelect.disabled = false;
    }
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
  const modelSelect = document.getElementById("model");
  const fileIndicator = document.getElementById("file-indicator");
  const imagePreview = document.getElementById("image-preview");
  const imageUploadText = document.getElementById("image-upload-text");


  if (prompt.trim()) {
    chat.appendChild(renderMessage("user", prompt));
    document.getElementById("prompt").value = "";
  }

  if (imageFile) {
    const reader = new FileReader();
    reader.onload = function(e) {
      chat.innerHTML += `<img src="${e.target.result}" style="max-width: 30%; border-radius: 6px;"></div>`;
    };
    reader.readAsDataURL(imageFile);
    document.getElementById("image-upload").value = ""; // Clear file input
    fileIndicator.style.display = 'none'; // Hide indicator after sending
    imagePreview.style.display = 'none'; // Hide preview
    imagePreview.src = '#'; // Clear preview source
    imageUploadText.style.display = 'block'; // Show "Image" text
  }

  modelSelect.style.display = 'none';
  modelSelect.disabled = true;

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
    aiDiv.innerHTML = `<strong>AI (${model}):</strong> `;
    chat.appendChild(aiDiv);
    let result = "";
    while (true) {
      const {
        value,
        done
      } = await reader.read();
      if (done) break;
      result += decoder.decode(value, {
        stream: true
      });

      const shouldScroll = isUserAtBottom(chat);
      aiDiv.innerHTML = `<strong>AI (${model}):</strong> ${marked.parse(result.replace(/\[IMAGE\](.+)/g, (match, p1) => {
        let imgPath = p1.trim();
        const uploadsIndex = imgPath.indexOf("/uploads/");
        if (uploadsIndex !== -1) imgPath = imgPath.substring(uploadsIndex + 1);
        return `<br><img src="${imgPath}" style="max-width: 30%; border-radius: 6px;">`;
      }))}`;

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
        const res = await fetch("/system/system_shutdown", {
            method: "POST"
        });
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

// Event listener for image input change to show preview
document.getElementById("image-upload").addEventListener("change", function() {
  const fileIndicator = document.getElementById("file-indicator");
  const imagePreview = document.getElementById("image-preview");
  const imageUploadText = document.getElementById("image-upload-text");

  if (this.files && this.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      imagePreview.src = e.target.result;
      imagePreview.style.display = 'block';
      imageUploadText.style.display = 'none'; // Hide "Image" text
      fileIndicator.style.display = 'flex'; // Show clear button
    };
    reader.readAsDataURL(this.files[0]);
  } else {
    imagePreview.src = '#';
    imagePreview.style.display = 'none';
    imageUploadText.style.display = 'block'; // Show "Image" text
    fileIndicator.style.display = 'none'; // Hide clear button
  }
});

// Event listener for the clear button
document.getElementById("clear-image-btn").addEventListener("click", function(event) {
  event.stopPropagation(); // Prevent label click from re-opening file dialog
  const imageInput = document.getElementById("image-upload");
  const imagePreview = document.getElementById("image-preview");
  const imageUploadText = document.getElementById("image-upload-text");
  
  imageInput.value = ""; // Reset the file input
  imagePreview.src = '#'; // Clear preview source
  imagePreview.style.display = 'none'; // Hide preview
  imageUploadText.style.display = 'block'; // Show "Image" text
  document.getElementById("file-indicator").style.display = 'none'; // Hide clear button
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

async function askStream(prompt, model = "gemma:4b") {
  const res = await fetch("/ask_stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt,
      model
    })
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let result = "";

  while (true) {
    const {
      value,
      done
    } = await reader.read();
    if (done) break;
    result += decoder.decode(value);
    document.getElementById("chat").textContent = result;
  }
}

function renderMessage(role, content, modelName = document.getElementById("model").value) {
  function parseContent(text) {
    text = text.replace(/\[IMAGE\](.+)/g, (match, p1) => {
      let imgPath = p1.trim();
      const uploadsIndex = imgPath.indexOf("/uploads/");
      if (uploadsIndex !== -1) imgPath = imgPath.substring(uploadsIndex + 1);
      return `<br><img src="${imgPath}" style="max-width: 30%; border-radius: 6px;">`;
    });
    return text;
  }

  const senderLabel = html(".sender", { text: role === "user" ? "You:" : `AI (${modelName}):` })
  const messageContent = html("pre.message-content", { innerHTML: role === "user" ? parseContent(escapeHtml(content)) : marked.parse(parseContent(content)) })

  const message = html(`.${role}`, [ senderLabel, messageContent ])

  return message
}

window.onload = loadModels;

// New function to toggle chat list visibility on mobile
document.addEventListener('DOMContentLoaded', () => {
  const chatList = document.getElementById('chat-list');
  const showChatsBtn = document.createElement('button');
  showChatsBtn.id = 'show-chats-btn';
  showChatsBtn.innerHTML = '💬';
  showChatsBtn.onclick = () => {
    chatList.classList.toggle('visible');
  };
  document.body.appendChild(showChatsBtn);
});