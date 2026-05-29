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

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, username }) => {
    socket.join(roomId);
    socket.username = username;
    socket.roomId = roomId;

    if (!roomUsers[roomId]) roomUsers[roomId] = {};
    roomUsers[roomId][socket.id] = username;

    // Send existing code to new user
    if (roomCode[roomId]) {
      socket.emit("load-code", roomCode[roomId]);
    }

    // Update users list for everyone
    io.to(roomId).emit("users-update", Object.values(roomUsers[roomId]));
    console.log(`${username} joined room: ${roomId}`);
  });

  socket.on("code-change", ({ roomId, code }) => {
    roomCode[roomId] = code;
    socket.to(roomId).emit("code-update", code);
  });

  socket.on("send-message", ({ roomId, msg }) => {
    socket.to(roomId).emit("receive-message", msg);
  });

  socket.on("disconnect", () => {
    const { roomId, username } = socket;
    if (roomId && roomUsers[roomId]) {
      delete roomUsers[roomId][socket.id];
      io.to(roomId).emit("users-update", Object.values(roomUsers[roomId]));
    }
    console.log(`${username} disconnected`);
  });
});

server.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});