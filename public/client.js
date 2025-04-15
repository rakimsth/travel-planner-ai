document.addEventListener("DOMContentLoaded", () => {
  const chatMessages = document.getElementById("chat-messages");
  const messageInput = document.getElementById("message-input");
  const sendButton = document.getElementById("send-button");
  const modelSelect = document.getElementById("model-select");

  let isProcessing = false;

  // Fetch available models from Ollama
  async function fetchModels() {
    try {
      const response = await fetch("/models");
      const data = await response.json();

      // Clear loading option
      modelSelect.innerHTML = "";

      // Add models to select
      data.forEach((model) => {
        const option = document.createElement("option");
        option.value = model.name;
        option.textContent = model.name;
        modelSelect.appendChild(option);
      });

      if (data.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No models found";
        modelSelect.appendChild(option);
        sendButton.disabled = true;
      }
    } catch (error) {
      console.error("Error fetching models:", error);
      modelSelect.innerHTML = '<option value="">Error loading models</option>';

      // Show error message in chat
      const errorMsg = document.createElement("div");
      errorMsg.classList.add("error");
      errorMsg.textContent = "Failed to load models. Is Ollama running?";
      chatMessages.appendChild(errorMsg);
    }
  }

  // Function to add a message to the chat
  function addMessage(message, isUser = false) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");
    messageElement.classList.add(isUser ? "user-message" : "bot-message");

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    messageElement.innerHTML = `
        <div>${message}</div>
        <div class="timestamp">${timeString}</div>
      `;

    chatMessages.appendChild(messageElement);

    // Scroll to the bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Function to send message to the server
  async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isProcessing) return;

    // Set processing flag
    isProcessing = true;
    sendButton.disabled = true;

    // Add user message to chat
    addMessage(message, true);

    // Clear input
    messageInput.value = "";

    try {
      // Display thinking indicator
      const thinkingMsg = document.createElement("div");
      thinkingMsg.classList.add("message", "bot-message", "thinking");
      thinkingMsg.textContent = "Thinking...";
      chatMessages.appendChild(thinkingMsg);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      // Get the selected model
      const selectedModel = modelSelect.value;

      // Send request to server
      const response = await fetch("/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message,
          model: selectedModel,
        }),
      });

      // Remove thinking indicator
      chatMessages.removeChild(thinkingMsg);

      if (!response.ok) {
        throw new Error("Server error");
      }

      const data = await response.json();
      const htmlContent = marked.parse(data.response); // Convert markdown to HTML

      // Add bot response to chat
      addMessage(htmlContent);
    } catch (error) {
      console.error("Error:", error);
      // Remove thinking indicator if it exists
      const thinkingEl = document.querySelector(".thinking");
      if (thinkingEl) chatMessages.removeChild(thinkingEl);

      // Show error message
      addMessage("Sorry, there was an error processing your request. Please try again.");
    } finally {
      isProcessing = false;
      sendButton.disabled = false;
    }
  }

  // Event listeners
  sendButton.addEventListener("click", sendMessage);

  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Initialize by fetching models
  fetchModels();
});
