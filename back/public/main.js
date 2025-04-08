const socket = io();

const clientsTotal = document.getElementById("clients-total");

const messageContainer = document.getElementById("message-container");
const nameInput = document.getElementById("name-input");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");

messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage();
});

socket.on("clients-total", (data) => {
  clientsTotal.innerText = `Total clients : ${data}`; // Mettre à jour dynamiquement le total des clients
});

function sendMessage() {
  console.log(messageInput.value);
  const data = {
    name: nameInput.value,
    message: messageInput.value,
    dateTime: new Date(),
  };
  socket.emit("message", data);
  addMessageToUI(true, data);
  messageInput.value = "";
}

socket.on("chat-message", (data) => {
  addMessageToUI(false, data);
});

function addMessageToUI(isOwnMessage, data) {
  const element = document.createElement("li");
  element.classList.add(isOwnMessage ? "message-right" : "message-left");
  element.innerHTML = `
      <p class="message">
        ${data.message}
        <span>${data.name} | ${moment(data.dateTime).fromNow()}</span>
      </p>
    `;
  messageContainer.appendChild(element);
  messageContainer.scrollTop = messageContainer.scrollHeight;
}
