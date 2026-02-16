const icons = {
  trash: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash2-icon lucide-trash-2"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  copy: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy-icon lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-icon lucide-check"><path d="M20 6 9 17l-5-5"/></svg>`,
  paperclip: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-paperclip-icon lucide-paperclip"><path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/></svg>`,
  message: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square-icon lucide-message-square"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/></svg>`,
  octagonAlert: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-octagon-alert-icon lucide-octagon-alert"><path d="M12 16h.01"/><path d="M12 8v4"/><path d="M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z"/></svg>`,
  x: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`
}

async function loadModels() {
  try {
    const res = await fetch("/models");
    const models = await res.json();
    const select = document.getElementById("model");
    select.innerHTML = "";
    if (models.length === 0) {
      select.innerHTML = '<option value="" disabled>No models available</option>';
    } else {
      models.forEach(model => {
        const option = html("option", {
          value: model,
          text: model
        })
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
          html(".chat-icon", { innerHTML: icons.message }),
          html("span", { text: chat.title }),
          html("button.delete-btn", {
            onclick: (event) => deleteChat(event, chat.id),
            innerHTML: icons.trash
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

    localStorage.setItem("lastChatId", chatId);
    loadChatHistory();

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
    }

  } catch (error) {
    alert("Error deleting chat: " + error.message);
  }
}

function addCopyButton(element, textSelector) {
  const copyBtn = html("button.copy-btn", {
    innerHTML: icons.copy + "Copy",
    title: "Copy to clipboard",
    onclick: (e) => {
      e.stopPropagation();
      const text = textSelector(element)
      if (!text) return

      navigator.clipboard.writeText(text).then(() => {
        copyBtn.innerHTML = icons.check + "Copied!";
        setTimeout(() => {
          copyBtn.innerHTML = icons.copy + "Copy";
        }, 2000);
      }).catch(err => {
        alert("Failed to copy text: " + err);
      });
    }
  })
  element.appendChild(copyBtn);
}

async function loadChatHistory(modelName = document.getElementById("model").value) {
  try {
    const res = await fetch("/history");
    const data = await res.json();
    const history = data.history;
    const savedModel = data.model;
    const chatTitle = data.title + " ("+modelName+")";

    const chat = document.getElementById("chat");
    chat.innerHTML = "";

    document.querySelector(".chat-name").textContent = chatTitle

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

  if (prompt.trim()) {
    const message = renderMessage("user", prompt);
    message.classList.add("animate-in")
    chat.appendChild(message);
    setTimeout(() => {
      message.classList.remove("animate-in")
    }, 1000);
    document.getElementById("prompt").value = "";
  }

  if (imageFile) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const image = html("img", {
        src: e.target.result,
        style: {
          marginLeft: "auto",
          maxWidth: "30%",
          borderRadius: "6px"
        }
      })
      chat.appendChild(image)
    };
    reader.readAsDataURL(imageFile);
    document.getElementById("image-upload").value = ""; 
    fileIndicator.style.display = 'none'; 
    imagePreview.style.display = 'none'; 
    imagePreview.src = '#'; 
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

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status} ${res.statusText}${await res.text()}`)
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    const aiDiv = html(".ai")
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
      aiDiv.innerHTML = ""
      aiDiv.appendChild(renderMessage("", result, model))

      if (shouldScroll) {
        chat.scrollTop = chat.scrollHeight;
      }
    }

  } catch (error) {
    const message = renderMessage("assistant", error.message, model)
    message.classList.add("error-message")
    message.appendChild(html(".error-indicator", {
      innerHTML: icons.octagonAlert
    }))
    chat.appendChild(message)
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

document.getElementById("image-upload").addEventListener("change", function() {
  const fileIndicator = document.getElementById("file-indicator");
  const imagePreview = document.getElementById("image-preview");

  if (this.files && this.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      imagePreview.src = e.target.result;
      imagePreview.style.display = 'block';
      fileIndicator.style.display = 'flex';
    };
    reader.readAsDataURL(this.files[0]);
  } else {
    imagePreview.src = '#';
    imagePreview.style.display = 'none';
    fileIndicator.style.display = 'none';
  }
});

document.getElementById("clear-image-btn").addEventListener("click", function(event) {
  event.stopPropagation(); 
  const imageInput = document.getElementById("image-upload");
  const imagePreview = document.getElementById("image-preview");
  
  imageInput.value = ""; 
  imagePreview.src = '#'; 
  imagePreview.style.display = 'none'; 
  document.getElementById("file-indicator").style.display = 'none'; 
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

const settings = {
	indentLines: true,
	lineNumbers: true,
}

function detectIndent(text) {
  const lines = text.split("\n")
    .map(line => line.match(/^( +)/)) 
    .filter(Boolean) 
    .map(m => m[0].length);

  if (lines.length < 2) return 2;

  const diffs = {};
  for (let i = 1; i < lines.length; i++) {
    const diff = Math.abs(lines[i] - lines[i - 1]);
    if (diff > 0) {
      diffs[diff] = (diffs[diff] || 0) + 1;
    }
  }

  const indentSize = parseInt(Object.keys(diffs).sort((a, b) => diffs[b] - diffs[a])[0]);
  return indentSize || 2;
}

function highlightCode(root = document) {
  const codeBlocks = root.querySelectorAll("pre > code");

  codeBlocks.forEach(block => {
    let text = block.textContent;
    block.innerHTML = ""
    block.className = "show-code"

    const indentSize = detectIndent(text)

    const lineNumbers = html("numbers")
    if (settings.lineNumbers) {
      text = text.replace(/\s+$/, '') 
      const lines = text.split("\n")
      for (let i = 0; i < lines.length; i++) {
        const number = html("number")
        lineNumbers.append(number)
      }
    }

    let wasIndented = false
    let prevIndents = 0
    const fragment = document.createDocumentFragment()
    const highlightedText = hljs.highlightAuto(text).value
    highlightedText.split("\n").forEach(line => {
      const regex = new RegExp(" {" + indentSize + "}", "g");
      line = line.replace(regex, "\t");

      const isEmpty = line.trim() === ""
      const matches = line.match(/^\s+/)

      if (settings.indentLines) {
        const indents = matches ? matches[0].split("\t").length - 1 : 0

        const hasWhiteSpace = /^[\s\uFEFF\xA0]+/.test(line) 

        line = line.replace(/^(\t+)/, (match, group) => "<i>\t</i>".repeat(group.length))
        const inScope = hasWhiteSpace || (wasIndented && isEmpty)
        if (isEmpty) {
          line = inScope ? "<i>\t</i>".repeat(prevIndents) : "\n"
        }
        wasIndented = inScope
        prevIndents = indents
      }
      

      const wrapper = html("span", {
        innerHTML: line
        + (line.trim() !== "" ? "\n" : ""),
      })

      fragment.append(wrapper)
    })
    const code = html("code", [fragment])

    block.append(lineNumbers, code)
  });
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

  const senderLabel = role === "assistant" ? html(".sender", { text: `${modelName}` }) : null
  const messageContent = html("pre.message-content", { 
    innerHTML: role === "user" ? 
      marked.parse(parseContent(escapeHtml(content))) : 
      marked.parse(parseContent(content)) 
  })

  const message = html(`.${role}`, [ senderLabel, messageContent ])

  highlightCode(message)
  
  message.querySelectorAll("pre:has(> code)").forEach(pre => {
    addCopyButton(pre, (pre => {
      const code = pre.querySelector("code")
      if (!code) return

      return code.innerText
    }))
  });

  return message
}

window.onload = loadModels;

document.addEventListener('DOMContentLoaded', () => {
  const chatList = document.getElementById('chat-list');
  const showChatsBtn = html("button.show-chats-btn.button", {
    innerHTML: icons.message,
    children: html("span", { text: "Chats" }),
    onclick: () => chatList.classList.toggle("visible")
  })

  const chatTopbar = document.querySelector(".chat-topbar")
  chatTopbar.appendChild(showChatsBtn);

  const closeChatListBtn = document.querySelector(".close-chat-list-btn")
  closeChatListBtn.addEventListener("click", () => {
    chatList.classList.remove("visible")
  })
});

const chat = document.getElementById("chat");
chat.addEventListener("click", (e) => {
  if (e.target.tagName === "IMG") {
    const popup = html(".image-popup", {
      children: [
        html("button.close-popup-btn", {
          innerHTML: icons.x,
          onclick: () => document.body.removeChild(popup)
        }),
        html(".backdrop", {
          onclick: () => document.body.removeChild(popup)
        }),
        html("img", { src: e.target.src })
      ]
    })
    document.body.appendChild(popup);
  }
})