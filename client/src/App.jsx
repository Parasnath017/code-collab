import { useEffect, useState } from "react";
import { socket } from "./socket";
import Editor from "@monaco-editor/react";

function App() {
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const [code, setCode] = useState("// Start coding here...");
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  const joinRoom = () => {
    if (!roomId || !username) return;
    socket.emit("join-room", { roomId, username });
    setJoined(true);
  };

  useEffect(() => {
    socket.on("load-code", (data) => setCode(data));
    socket.on("code-update", (data) => setCode(data));
    socket.on("users-update", (data) => setUsers(data));
    socket.on("receive-message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      socket.off("load-code");
      socket.off("code-update");
      socket.off("users-update");
      socket.off("receive-message");
    };
  }, []);

  const handleCodeChange = (value) => {
    setCode(value);
    socket.emit("code-change", { roomId, code: value });
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    const msg = { username, text: chatInput };
    socket.emit("send-message", { roomId, msg });
    setMessages((prev) => [...prev, msg]);
    setChatInput("");
  };

  if (!joined) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginBox}>
          <h1 style={styles.title}>⚡ CodeCollab</h1>
          <p style={styles.subtitle}>Real-time collaborative code editor</p>
          <input
            style={styles.input}
            placeholder="Your Name"
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Room ID"
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button style={styles.joinBtn} onClick={joinRoom}>
            Join Room →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.headerTitle}>⚡ CodeCollab</h2>
        <span style={styles.roomBadge}>Room: {roomId}</span>
      </div>

      <div style={styles.mainLayout}>
        {/* Editor */}
        <div style={styles.editorSection}>
          <Editor
            height="100%"
            defaultLanguage="javascript"
            theme="vs-dark"
            value={code}
            onChange={handleCodeChange}
            loading={
              <div style={{ color: "#58a6ff", padding: "20px", fontSize: "16px" }}>
                ⏳ Loading Editor...
              </div>
            }
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: "on",
            }}
          />
        </div>

        {/* Sidebar */}
        <div style={styles.sidebar}>
          {/* Online Users */}
          <div style={styles.sideSection}>
            <h3 style={styles.sideTitle}>🟢 Online ({users.length})</h3>
            {users.map((u, i) => (
              <div key={i} style={styles.userItem}>
                <span style={styles.userDot}>●</span> {u}
              </div>
            ))}
          </div>

          {/* Chat */}
          <div style={styles.sideSection}>
            <h3 style={styles.sideTitle}>💬 Chat</h3>
            <div style={styles.chatBox}>
              {messages.map((m, i) => (
                <div key={i} style={styles.chatMsg}>
                  <span style={styles.chatUser}>{m.username}: </span>
                  <span>{m.text}</span>
                </div>
              ))}
            </div>
            <div style={styles.chatInputRow}>
              <input
                style={styles.chatInput}
                placeholder="Message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button style={styles.sendBtn} onClick={sendMessage}>
                ➤
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  loginContainer: {
    height: "100vh",
    background: "#0d1117",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  loginBox: {
    background: "#161b22",
    padding: "40px",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    width: "320px",
    border: "1px solid #30363d",
  },
  title: { color: "#58a6ff", margin: 0, fontSize: "28px" },
  subtitle: { color: "#8b949e", margin: 0, fontSize: "14px" },
  input: {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #30363d",
    background: "#0d1117",
    color: "#fff",
    fontSize: "14px",
  },
  joinBtn: {
    padding: "10px",
    background: "#238636",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "15px",
    cursor: "pointer",
  },
  appContainer: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#0d1117",
    color: "#fff",
  },
  header: {
    background: "#161b22",
    padding: "12px 20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    borderBottom: "1px solid #30363d",
  },
  headerTitle: { color: "#58a6ff", margin: 0 },
  roomBadge: {
    background: "#238636",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "13px",
  },
  mainLayout: { display: "flex", flex: 1, overflow: "hidden" },
  editorSection: { flex: 1 },
  sidebar: {
    width: "260px",
    background: "#161b22",
    borderLeft: "1px solid #30363d",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  sideSection: {
    padding: "16px",
    borderBottom: "1px solid #30363d",
  },
  sideTitle: { color: "#8b949e", margin: "0 0 10px 0", fontSize: "13px" },
  userItem: { color: "#58a6ff", fontSize: "14px", padding: "4px 0" },
  userDot: { color: "#3fb950" },
  chatBox: {
    height: "200px",
    overflowY: "auto",
    marginBottom: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  chatMsg: { fontSize: "13px", color: "#c9d1d9" },
  chatUser: { color: "#58a6ff", fontWeight: "bold" },
  chatInputRow: { display: "flex", gap: "6px" },
  chatInput: {
    flex: 1,
    padding: "8px",
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "13px",
  },
  sendBtn: {
    padding: "8px 12px",
    background: "#238636",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
};

export default App;