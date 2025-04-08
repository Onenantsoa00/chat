import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";

const app = express();
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "PUT"],
  })
);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "DELETE", "PUT"],
  },
});

mongoose
  .connect("mongodb://localhost:27017/chat-app")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const messageSchema = new mongoose.Schema({
  username: String,
  avatar: String,
  message: String,
  isDeleted: { type: Boolean, default: false },
  edited: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model("Message", messageSchema);

io.on("connection", async (socket) => {
  console.log("New client connected:", socket.id);

  const messages = await Message.find({ isDeleted: false })
    .sort({ timestamp: 1 })
    .limit(50);
  socket.emit("message-history", messages);

  updateConnectedClients();

  socket.on("send-message", async (data) => {
    try {
      const newMessage = new Message({
        username: data.username,
        avatar: data.avatar,
        message: data.message,
      });
      await newMessage.save();
      io.emit("receive-message", newMessage);
    } catch (err) {
      console.error("Error saving message:", err);
    }
  });

  socket.on("typing", (username) => {
    socket.broadcast.emit("user-typing", username);
  });

  socket.on("stop-typing", () => {
    socket.broadcast.emit("user-stopped-typing");
  });

  socket.on("delete-message", async (id) => {
    try {
      await Message.findByIdAndUpdate(id, { isDeleted: true });
      io.emit("message-deleted", id);
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  });

  socket.on("edit-message", async ({ id, newMessage }) => {
    try {
      await Message.findByIdAndUpdate(id, {
        message: newMessage,
        edited: true,
      });
      io.emit("message-edited", { id, newMessage });
    } catch (err) {
      console.error("Error editing message:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    updateConnectedClients();
  });

  function updateConnectedClients() {
    io.emit("connected-clients", { count: io.engine.clientsCount });
  }
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
