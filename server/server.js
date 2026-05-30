const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const roomCode = {};
const roomUsers = {};
const roomPasswords = {};
const roomTyping = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, username, password }) => {
    // Password check
    if (roomPasswords[roomId] && roomPasswords[roomId] !== password) {
      socket.emit("wrong-password");
      return;
    }

    // Set password if first user
    if (!roomPasswords[roomId] && password) {
      roomPasswords[roomId] = password;
    }

    socket.join(roomId);
    socket.username = username;
    socket.roomId = roomId;

    if (!roomUsers[roomId]) roomUsers[roomId] = {};

    const isCreator = Object.keys(roomUsers[roomId]).length === 0;
    roomUsers[roomId][socket.id] = { username, isCreator };

    if (roomCode[roomId]) {
      socket.emit("load-code", roomCode[roomId]);
    }

    socket.emit("join-success");
    io.to(roomId).emit("users-update", Object.values(roomUsers[roomId]));
    console.log(`${username} joined room: ${roomId}`);
  });

  socket.on("code-change", ({ roomId, code }) => {
    roomCode[roomId] = code;
    socket.to(roomId).emit("code-update", code);
  });

  socket.on("language-change", ({ roomId, language }) => {
    socket.to(roomId).emit("language-update", language);
  });

  socket.on("send-message", ({ roomId, msg }) => {
    socket.to(roomId).emit("receive-message", msg);
  });

  socket.on("typing", ({ roomId, username, isTyping }) => {
    if (!roomTyping[roomId]) roomTyping[roomId] = new Set();
    if (isTyping) roomTyping[roomId].add(username);
    else roomTyping[roomId].delete(username);
    socket.to(roomId).emit("typing-update", [...roomTyping[roomId]]);
  });

  socket.on("leave-room", ({ roomId, username }) => {
    socket.leave(roomId);
    if (roomUsers[roomId]) {
      delete roomUsers[roomId][socket.id];
      io.to(roomId).emit("users-update", Object.values(roomUsers[roomId]));
    }
    console.log(`${username} left room: ${roomId}`);
  });

  socket.on("disconnect", () => {
    const { roomId, username } = socket;
    if (roomId && roomUsers[roomId]) {
      delete roomUsers[roomId][socket.id];
      io.to(roomId).emit("users-update", Object.values(roomUsers[roomId]));
      if (roomTyping[roomId]) {
        roomTyping[roomId].delete(username);
        socket.to(roomId).emit("typing-update", [...roomTyping[roomId]]);
      }
    }
    console.log(`${username} disconnected`);
  });
});

server.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});