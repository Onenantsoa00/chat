<template>
  <div class="chat-app" :class="{ 'dark-mode': darkMode }">
    <div class="header">
      <h1 class="title">I-RESaka</h1>
      <button class="theme-toggle" @click="toggleTheme">
        {{ darkMode ? "☀️ Light" : "🌙 Dark" }}
      </button>
    </div>

    <div class="main">
      <div class="user-info">
        <img :src="avatar" class="avatar" @click="changeAvatar" />
        <input
          type="text"
          v-model="username"
          class="name-input"
          placeholder="Anonymous"
          maxlength="20"
        />
      </div>

      <div class="typing-indicator" v-if="someoneTyping">
        <div class="typing-animation">
          <span></span>
          <span></span>
          <span></span>
        </div>
        {{ someoneTyping }} is typing...
      </div>

      <ul class="message-container" ref="messageContainer">
        <transition-group name="message">
          <li
            v-for="msg in messages"
            :key="msg._id"
            :class="
              msg.username === username ? 'message-right' : 'message-left'
            "
          >
            <div v-if="!msg.isDeleted" class="message-wrapper">
              <div class="message-header">
                <img :src="msg.avatar" class="message-avatar" />
                <span class="username">{{ msg.username }}</span>
                <span class="time">{{ formatTime(msg.timestamp) }}</span>
                <span v-if="msg.edited" class="edited-badge">(edited)</span>
              </div>
              <div class="message-content">
                {{ msg.message }}
              </div>
              <div class="message-actions" v-if="msg.username === username">
                <button @click="editMessage(msg._id, msg.message)">✏️</button>
                <button @click="deleteMessage(msg._id)">🗑️</button>
              </div>
            </div>
            <div v-else class="deleted-message">Message deleted</div>
          </li>
        </transition-group>
      </ul>

      <form class="message-form">
        <input
          type="text"
          v-model="newMessage"
          @input="handleTyping"
          @keyup.enter="sendMessage"
          class="message-input"
          placeholder="Type a message..."
        />
        <button type="button" @click="sendMessage" class="send-button">
          Send
        </button>
      </form>
    </div>
    <h3 class="clients-total">Online: {{ connectedClients }}</h3>

    <div v-if="editingMessage" class="modal">
      <div class="modal-content">
        <h3>Edit Message</h3>
        <textarea v-model="editMessageText" ref="editTextarea"></textarea>
        <div class="modal-actions">
          <button @click="saveEditedMessage">Save</button>
          <button @click="cancelEdit">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { io } from "socket.io-client";
import moment from "moment";

export default {
  data() {
    return {
      socket: null,
      username: "Anonymous",
      avatar: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${Math.random()
        .toString(36)
        .substring(2)}`,
      newMessage: "",
      messages: [],
      connectedClients: 0,
      darkMode: false,
      editingMessage: null,
      editMessageText: "",
      someoneTyping: "",
      typingTimeout: null,
    };
  },
  mounted() {
    this.initSocket();
    this.darkMode = localStorage.getItem("darkMode") === "true";
    document.body.className = this.darkMode ? "dark-mode" : "";
  },
  methods: {
    initSocket() {
      this.socket = io("http://localhost:3000", {
        transports: ["websocket"],
      });

      this.socket.on("message-history", (history) => {
        this.messages = history;
        this.scrollToBottom();
      });

      this.socket.on("receive-message", (message) => {
        this.messages.push(message);
        this.scrollToBottom();
        this.animateMessage();
      });

      this.socket.on("message-deleted", (id) => {
        const index = this.messages.findIndex((m) => m._id === id);
        if (index !== -1) {
          this.messages[index].isDeleted = true;
        }
      });

      this.socket.on("message-edited", ({ id, newMessage }) => {
        const index = this.messages.findIndex((m) => m._id === id);
        if (index !== -1) {
          this.messages[index].message = newMessage;
          this.messages[index].edited = true;
        }
      });

      this.socket.on("connected-clients", (data) => {
        this.connectedClients = data.count;
      });

      this.socket.on("user-typing", (username) => {
        this.someoneTyping = username;
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
          this.someoneTyping = "";
        }, 2000);
      });

      this.socket.on("user-stopped-typing", () => {
        this.someoneTyping = "";
      });
    },
    sendMessage() {
      if (!this.newMessage.trim()) return;

      const messageData = {
        username: this.username,
        avatar: this.avatar,
        message: this.newMessage,
      };

      this.socket.emit("send-message", messageData);
      this.newMessage = "";
      this.socket.emit("stop-typing");
    },
    handleTyping() {
      if (this.newMessage) {
        this.socket.emit("typing", this.username);
      } else {
        this.socket.emit("stop-typing");
      }
    },
    deleteMessage(id) {
      if (confirm("Delete this message?")) {
        this.socket.emit("delete-message", id);
      }
    },
    editMessage(id, currentMessage) {
      this.editingMessage = id;
      this.editMessageText = currentMessage;
      this.$nextTick(() => {
        this.$refs.editTextarea.focus();
      });
    },
    saveEditedMessage() {
      if (this.editMessageText.trim()) {
        this.socket.emit("edit-message", {
          id: this.editingMessage,
          newMessage: this.editMessageText,
        });
      }
      this.cancelEdit();
    },
    cancelEdit() {
      this.editingMessage = null;
      this.editMessageText = "";
    },
    changeAvatar() {
      this.avatar = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${Math.random()
        .toString(36)
        .substring(2)}`;
    },
    toggleTheme() {
      this.darkMode = !this.darkMode;
      localStorage.setItem("darkMode", this.darkMode);
      document.body.className = this.darkMode ? "dark-mode" : "";
    },
    formatTime(timestamp) {
      return moment(timestamp).format("HH:mm");
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.messageContainer;
        container.scrollTop = container.scrollHeight;
      });
    },
    animateMessage() {
      const messages = document.querySelectorAll(".message-wrapper");
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        lastMessage.classList.add("message-pop");
        setTimeout(() => {
          lastMessage.classList.remove("message-pop");
        }, 500);
      }
    },
  },
};
</script>

<style>
:root {
  --primary-color: #4361ee;
  --secondary-color: #3f37c9;
  --light-color: #f8f9fa;
  --dark-color: #212529;
  --success-color: #4cc9f0;
  --danger-color: #f72585;
  --warning-color: #ffbe0b;
  --info-color: #4895ef;
  --bg-color: #ffffff;
  --text-color: #212529;
  --border-color: #dee2e6;
  --shadow-color: rgba(0, 0, 0, 0.1);
}

.dark-mode {
  --primary-color: #4361ee;
  --secondary-color: #3f37c9;
  --light-color: #343a40;
  --dark-color: #f8f9fa;
  --bg-color: #212529;
  --text-color: #f8f9fa;
  --border-color: #495057;
  --shadow-color: rgba(255, 255, 255, 0.05);
}

body {
  margin: 0;
  padding: 0;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  background-color: var(--bg-color);
  color: var(--text-color);
  transition: background-color 0.3s, color 0.3s;
}

.chat-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  box-sizing: border-box;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.title {
  margin: 0;
  font-size: 2rem;
  color: var(--primary-color);
}

.theme-toggle {
  background: var(--primary-color);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.3s;
}

.theme-toggle:hover {
  background: var(--secondary-color);
  transform: translateY(-2px);
}

.main {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px var(--shadow-color);
  background-color: var(--light-color);
}

.user-info {
  display: flex;
  align-items: center;
  padding: 15px;
  background-color: var(--primary-color);
  border-bottom: 1px solid var(--border-color);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-right: 10px;
  cursor: pointer;
  transition: transform 0.3s;
}

.avatar:hover {
  transform: scale(1.1);
}

.name-input {
  flex-grow: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 20px;
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 1rem;
}

.name-input::placeholder {
  color: rgba(255, 255, 255, 0.7);
}

.typing-indicator {
  padding: 8px 15px;
  font-size: 0.8rem;
  color: var(--text-color);
  opacity: 0.8;
  display: flex;
  align-items: center;
}

.typing-animation {
  display: inline-flex;
  margin-right: 8px;
}

.typing-animation span {
  width: 6px;
  height: 6px;
  margin: 0 2px;
  background-color: var(--primary-color);
  border-radius: 50%;
  display: inline-block;
  animation: typing 1.4s infinite both;
}

.typing-animation span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-animation span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%,
  60%,
  100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-5px);
  }
}

.message-container {
  flex-grow: 1;
  overflow-y: auto;
  padding: 15px;
  list-style: none;
  margin: 0;
  scroll-behavior: smooth;
}

.message-left,
.message-right {
  max-width: 70%;
  margin-bottom: 15px;
  transition: all 0.3s;
}

.message-left {
  align-self: flex-start;
  margin-right: auto;
}

.message-right {
  align-self: flex-end;
  margin-left: auto;
}

.message-wrapper {
  padding: 12px 16px;
  border-radius: 18px;
  position: relative;
  box-shadow: 0 2px 5px var(--shadow-color);
  transition: all 0.3s;
}

.message-left .message-wrapper {
  background-color: var(--bg-color);
  border-bottom-left-radius: 4px;
}

.message-right .message-wrapper {
  background-color: var(--primary-color);
  color: white;
  border-bottom-right-radius: 4px;
}

.message-pop {
  animation: pop 0.5s ease;
}

@keyframes pop {
  0% {
    transform: scale(0.9);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.message-header {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.message-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  margin-right: 8px;
}

.username {
  font-weight: bold;
  font-size: 0.8rem;
  margin-right: 8px;
}

.message-right .username {
  color: rgba(255, 255, 255, 0.9);
}

.time {
  font-size: 0.7rem;
  opacity: 0.7;
}

.message-right .time {
  color: rgba(255, 255, 255, 0.7);
}

.edited-badge {
  font-size: 0.7rem;
  opacity: 0.7;
  margin-left: 5px;
  font-style: italic;
}

.message-content {
  margin: 0;
  word-wrap: break-word;
  line-height: 1.4;
}

.message-actions {
  position: absolute;
  top: -15px;
  right: 10px;
  display: flex;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.3s;
}

.message-wrapper:hover .message-actions {
  opacity: 1;
}

.message-actions button {
  background: var(--light-color);
  border: none;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.8rem;
  box-shadow: 0 1px 3px var(--shadow-color);
  transition: all 0.2s;
}

.message-actions button:hover {
  transform: scale(1.1);
}

.message-right .message-actions button {
  background: var(--secondary-color);
  color: white;
}

.deleted-message {
  font-style: italic;
  opacity: 0.6;
  padding: 12px 16px;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 18px;
  color: var(--text-color);
}

.message-form {
  display: flex;
  padding: 15px;
  border-top: 1px solid var(--border-color);
  background-color: var(--light-color);
}

.message-input {
  flex-grow: 1;
  padding: 12px 15px;
  border: none;
  border-radius: 20px;
  font-size: 1rem;
  background-color: var(--bg-color);
  color: var(--text-color);
  box-shadow: inset 0 1px 3px var(--shadow-color);
}

.message-input:focus {
  outline: none;
  box-shadow: inset 0 1px 3px var(--shadow-color),
    0 0 0 2px var(--primary-color);
}

.send-button {
  margin-left: 10px;
  padding: 0 20px;
  border: none;
  border-radius: 20px;
  background-color: var(--primary-color);
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.send-button:hover {
  background-color: var(--secondary-color);
  transform: translateY(-2px);
}

.clients-total {
  text-align: center;
  margin-top: 15px;
  font-size: 0.9rem;
  opacity: 0.7;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--bg-color);
  padding: 20px;
  border-radius: 10px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 5px 15px var(--shadow-color);
}

.modal-content h3 {
  margin-top: 0;
  color: var(--primary-color);
}

.modal-content textarea {
  width: 100%;
  min-height: 100px;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  font-family: inherit;
  font-size: 1rem;
  background-color: var(--light-color);
  color: var(--text-color);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.modal-actions button {
  padding: 8px 16px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.2s;
}

.modal-actions button:first-child {
  background-color: var(--primary-color);
  color: white;
}

.modal-actions button:first-child:hover {
  background-color: var(--secondary-color);
}

.modal-actions button:last-child {
  background-color: var(--light-color);
  color: var(--text-color);
}

.modal-actions button:last-child:hover {
  background-color: var(--border-color);
}

.message-enter-active,
.message-leave-active {
  transition: all 0.5s;
}
.message-enter-from,
.message-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
