import { useEffect, useState, useRef } from "react";
import { socket } from "./socket";
import Editor from "@monaco-editor/react";

const LANGUAGES = [
  { label: "JavaScript", value: "javascript", pistonName: "javascript", pistonVersion: "18.15.0" },
  { label: "Python", value: "python", pistonName: "python", pistonVersion: "3.10.0" },
  { label: "C++", value: "cpp", pistonName: "c++", pistonVersion: "10.2.0" },
  { label: "Java", value: "java", pistonName: "java", pistonVersion: "15.0.2" },
  { label: "TypeScript", value: "typescript", pistonName: "typescript", pistonVersion: "5.0.3" },
  { label: "Rust", value: "rust", pistonName: "rust", pistonVersion: "1.68.2" },
  { label: "Go", value: "go", pistonName: "go", pistonVersion: "1.16.2" },
  { label: "HTML", value: "html", pistonName: null, pistonVersion: null },
  { label: "CSS", value: "css", pistonName: null, pistonVersion: null },
];

const THEMES = [
  { label: "VS Dark", value: "vs-dark" },
  { label: "VS Light", value: "light" },
  { label: "High Contrast", value: "hc-black" },
];

function App() {
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [joined, setJoined] = useState(false);
  const [wrongPassword, setWrongPassword] = useState(false);
  const [code, setCode] = useState("// Start coding here...");
  const [language, setLanguage] = useState("javascript");
  const [theme, setTheme] = useState("vs-dark");
  const [fontSize, setFontSize] = useState(14);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [output, setOutput] = useState("");
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const chatBottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const joinRoom = () => {
    if (!roomId || !username) return;
    socket.emit("join-room", { roomId, username, password });
  };

  useEffect(() => {
    socket.on("join-success", () => setJoined(true));
    socket.on("wrong-password", () => {
      setWrongPassword(true);
      setTimeout(() => setWrongPassword(false), 3000);
    });
    socket.on("load-code", (data) => setCode(data));
    socket.on("code-update", (data) => setCode(data));
    socket.on("users-update", (data) => setUsers(data));
    socket.on("language-update", (lang) => setLanguage(lang));
    socket.on("receive-message", (data) => {
      setMessages((prev) => [...prev, data]);
    });
    socket.on("typing-update", (data) => setTypingUsers(data));

    return () => {
      socket.off("join-success");
      socket.off("wrong-password");
      socket.off("load-code");
      socket.off("code-update");
      socket.off("users-update");
      socket.off("language-update");
      socket.off("receive-message");
      socket.off("typing-update");
    };
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCodeChange = (value) => {
    setCode(value);
    socket.emit("code-change", { roomId, code: value });
  };

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    setLanguage(lang);
    socket.emit("language-change", { roomId, language: lang });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const extensions = {
      javascript: "js", python: "py", cpp: "cpp",
      java: "java", typescript: "ts", rust: "rs",
      go: "go", html: "html", css: "css",
    };
    const ext = extensions[language] || "txt";
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `code.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRun = () => {
    const lang = LANGUAGES.find((l) => l.value === language);
    setShowOutput(true);

    if (language === "javascript") {
      setRunning(true);
      setOutput("⏳ Running...");
      try {
        const logs = [];
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        console.log = (...args) => logs.push(args.map(a => typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)).join(" "));
        console.error = (...args) => logs.push("❌ " + args.join(" "));
        console.warn = (...args) => logs.push("⚠️ " + args.join(" "));
        eval(code);
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        setOutput(logs.length > 0 ? logs.join("\n") : "✅ Code ran successfully (no output)");
      } catch (err) {
        setOutput("❌ Error: " + err.message);
      }
      setRunning(false);
      return;
    }

    setOutput(`⚠️ Browser execution only supports JavaScript directly.\n\nFor ${lang?.label}:\n→ Use the ⬇️ Download button to save your code\n→ Run it locally on your machine\n\nTip: Switch to JavaScript to run code here!`);
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    const msg = { username, text: chatInput };
    socket.emit("send-message", { roomId, msg });
    setMessages((prev) => [...prev, msg]);
    setChatInput("");
    socket.emit("typing", { roomId, username, isTyping: false });
  };

  const handleTyping = (e) => {
    setChatInput(e.target.value);
    socket.emit("typing", { roomId, username, isTyping: true });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", { roomId, username, isTyping: false });
    }, 1500);
  };

  const leaveRoom = () => {
    socket.emit("leave-room", { roomId, username });
    setJoined(false);
    setCode("// Start coding here...");
    setMessages([]);
    setUsers([]);
    setOutput("");
  };

  if (!joined) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginBox}>
          <div style={styles.logoArea}>
            <span style={styles.logoIcon}>⚡</span>
            <h1 style={styles.title}>CodeCollab</h1>
          </div>
          <p style={styles.subtitle}>Real-time collaborative code editor</p>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Your Name</label>
            <input style={styles.input} placeholder="Enter your name" onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && joinRoom()} />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Room ID</label>
            <input style={styles.input} placeholder="Enter room ID" onChange={(e) => setRoomId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && joinRoom()} />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Room Password <span style={styles.optional}>(optional)</span></label>
            <input style={styles.input} type="password" placeholder="Leave blank for public room" onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && joinRoom()} />
          </div>
          {wrongPassword && <div style={styles.errorMsg}>❌ Wrong password! Try again.</div>}
          <button style={styles.joinBtn} onClick={joinRoom}>Join Room →</button>
          <p style={styles.hint}>💡 Same Room ID + Password = Same room</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      <div style={styles.header}>
        <h2 style={styles.headerTitle}>⚡ CodeCollab</h2>
        <span style={styles.roomBadge}>📁 {roomId}</span>
        <div style={styles.headerActions}>
          <select style={styles.langSelect} value={language} onChange={handleLanguageChange}>
            {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <select style={styles.langSelect} value={theme} onChange={(e) => setTheme(e.target.value)}>
            {THEMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button style={styles.actionBtn} onClick={() => setFontSize(f => Math.max(10, f - 1))}>A-</button>
          <span style={{ color: "#8b949e", fontSize: "12px" }}>{fontSize}px</span>
          <button style={styles.actionBtn} onClick={() => setFontSize(f => Math.min(24, f + 1))}>A+</button>
          <button style={styles.actionBtn} onClick={handleCopy}>{copied ? "✅ Copied!" : "📋 Copy"}</button>
          <button style={styles.actionBtn} onClick={handleDownload}>⬇️ Download</button>
          <button style={styles.actionBtn} onClick={() => setShowInput(!showInput)}>📥 Input</button>
          <button style={{ ...styles.actionBtn, background: running ? "#333" : "#238636", border: "none" }} onClick={handleRun} disabled={running}>
            {running ? "⏳ Running..." : "▶ Run"}
          </button>
          <button style={styles.leaveBtn} onClick={leaveRoom}>🚪 Leave</button>
        </div>
      </div>

      <div style={styles.mainLayout}>
        <div style={styles.editorWrapper}>
          {showInput && (
            <div style={styles.inputPanel}>
              <div style={styles.panelHeader}>
                <span>📥 Standard Input (stdin)</span>
                <button style={styles.closeBtn} onClick={() => setShowInput(false)}>✕</button>
              </div>
              <textarea style={styles.inputArea} placeholder="Enter input for your program..." value={input} onChange={(e) => setInput(e.target.value)} />
            </div>
          )}

          <div style={{ flex: showOutput ? "0 0 55%" : "1", overflow: "hidden" }}>
            <Editor
              height="100%"
              language={language}
              theme={theme}
              value={code}
              onChange={handleCodeChange}
              loading={<div style={{ color: "#58a6ff", padding: "20px" }}>⏳ Loading Editor...</div>}
              options={{
                fontSize: fontSize,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                cursorBlinking: "smooth",
                smoothScrolling: true,
                lineNumbers: "on",
                renderLineHighlight: "all",
                bracketPairColorization: { enabled: true },
              }}
            />
          </div>

          {showOutput && (
            <div style={styles.outputPanel}>
              <div style={styles.panelHeader}>
                <span>🖥️ Output</span>
                <button style={styles.closeBtn} onClick={() => setShowOutput(false)}>✕ Close</button>
              </div>
              <pre style={styles.outputText}>{output}</pre>
            </div>
          )}
        </div>

        <div style={styles.sidebar}>
          <div style={styles.sideSection}>
            <h3 style={styles.sideTitle}>🟢 Online ({users.length})</h3>
            {users.map((u, i) => (
              <div key={i} style={styles.userItem}>
                <span style={styles.userDot}>●</span>
                <span>{u.username || u}</span>
                {u.isCreator && <span style={styles.crownBadge}>👑</span>}
              </div>
            ))}
          </div>

          <div style={{ ...styles.sideSection, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <h3 style={styles.sideTitle}>💬 Chat</h3>
            <div style={styles.chatBox}>
              {messages.map((m, i) => (
                <div key={i} style={{
                  ...styles.chatMsg,
                  alignSelf: m.username === username ? "flex-end" : "flex-start",
                  background: m.username === username ? "#1f4068" : "#1e2a3a",
                  borderRadius: m.username === username ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                }}>
                  {m.username !== username && <div style={styles.chatUser}>{m.username}</div>}
                  <div>{m.text}</div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>
            {typingUsers.length > 0 && (
              <div style={styles.typingIndicator}>
                ✏️ {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
              </div>
            )}
            <div style={styles.chatInputRow}>
              <input style={styles.chatInput} placeholder="Message..." value={chatInput} onChange={handleTyping} onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
              <button style={styles.sendBtn} onClick={sendMessage}>➤</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  loginContainer: { height: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center" },
  loginBox: { background: "#161b22", padding: "40px", borderRadius: "16px", display: "flex", flexDirection: "column", gap: "16px", width: "360px", border: "1px solid #30363d", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" },
  logoArea: { display: "flex", alignItems: "center", gap: "10px" },
  logoIcon: { fontSize: "32px" },
  title: { color: "#58a6ff", margin: 0, fontSize: "28px", fontWeight: "700" },
  subtitle: { color: "#8b949e", margin: 0, fontSize: "14px" },
  inputGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { color: "#8b949e", fontSize: "13px" },
  optional: { color: "#484f58", fontSize: "12px" },
  input: { padding: "10px 14px", borderRadius: "8px", border: "1px solid #30363d", background: "#0d1117", color: "#fff", fontSize: "14px", outline: "none" },
  errorMsg: { background: "#3d1a1a", border: "1px solid #f85149", color: "#f85149", padding: "10px", borderRadius: "8px", fontSize: "13px" },
  joinBtn: { padding: "12px", background: "#238636", color: "#fff", border: "none", borderRadius: "8px", fontSize: "15px", cursor: "pointer", fontWeight: "600" },
  hint: { color: "#484f58", fontSize: "12px", margin: 0, textAlign: "center" },
  appContainer: { height: "100vh", display: "flex", flexDirection: "column", background: "#0d1117", color: "#fff" },
  header: { background: "#161b22", padding: "8px 16px", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #30363d", flexWrap: "wrap" },
  headerTitle: { color: "#58a6ff", margin: 0, fontSize: "18px" },
  roomBadge: { background: "#238636", padding: "3px 10px", borderRadius: "20px", fontSize: "12px" },
  headerActions: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginLeft: "auto" },
  langSelect: { padding: "5px 8px", background: "#0d1117", color: "#fff", border: "1px solid #30363d", borderRadius: "6px", fontSize: "12px", cursor: "pointer" },
  actionBtn: { padding: "5px 10px", background: "#21262d", color: "#fff", border: "1px solid #30363d", borderRadius: "6px", fontSize: "12px", cursor: "pointer" },
  leaveBtn: { padding: "5px 10px", background: "#3d1a1a", color: "#f85149", border: "1px solid #f85149", borderRadius: "6px", fontSize: "12px", cursor: "pointer" },
  mainLayout: { display: "flex", flex: 1, overflow: "hidden" },
  editorWrapper: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  inputPanel: { height: "120px", background: "#0d1117", borderBottom: "1px solid #30363d", display: "flex", flexDirection: "column" },
  inputArea: { flex: 1, background: "#0d1117", color: "#fff", border: "none", padding: "10px 16px", fontFamily: "monospace", fontSize: "13px", resize: "none", outline: "none" },
  outputPanel: { flex: "0 0 38%", background: "#0d1117", borderTop: "2px solid #238636", display: "flex", flexDirection: "column" },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 16px", background: "#161b22", borderBottom: "1px solid #30363d", color: "#8b949e", fontSize: "13px" },
  closeBtn: { background: "none", border: "1px solid #30363d", color: "#8b949e", cursor: "pointer", fontSize: "12px", borderRadius: "4px", padding: "2px 8px" },
  outputText: { padding: "16px", color: "#3fb950", fontFamily: "monospace", fontSize: "13px", overflow: "auto", flex: 1, margin: 0, whiteSpace: "pre-wrap" },
  sidebar: { width: "260px", background: "#161b22", borderLeft: "1px solid #30363d", display: "flex", flexDirection: "column", overflow: "hidden" },
  sideSection: { padding: "14px", borderBottom: "1px solid #30363d" },
  sideTitle: { color: "#8b949e", margin: "0 0 10px 0", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" },
  userItem: { color: "#58a6ff", fontSize: "14px", padding: "4px 0", display: "flex", alignItems: "center", gap: "6px" },
  userDot: { color: "#3fb950" },
  crownBadge: { fontSize: "12px" },
  chatBox: { flex: 1, overflowY: "auto", marginBottom: "8px", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" },
  chatMsg: { fontSize: "13px", color: "#c9d1d9", padding: "8px 10px", maxWidth: "85%", wordBreak: "break-word" },
  chatUser: { color: "#58a6ff", fontWeight: "bold", fontSize: "11px", marginBottom: "3px" },
  typingIndicator: { color: "#8b949e", fontSize: "11px", padding: "4px 0", fontStyle: "italic" },
  chatInputRow: { display: "flex", gap: "6px" },
  chatInput: { flex: 1, padding: "8px", background: "#0d1117", border: "1px solid #30363d", borderRadius: "6px", color: "#fff", fontSize: "13px" },
  sendBtn: { padding: "8px 12px", background: "#238636", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" },
};

export default App;