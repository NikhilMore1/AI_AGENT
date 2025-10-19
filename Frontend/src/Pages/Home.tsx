import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [file, setFile] = useState(null);
  const messagesEndRef = useRef(null);
  const utteranceRef = useRef(null);
  const [ws, setWs] = useState(null);
  const [sharing, setSharing] = useState(false);

  // ===== Speech Recognition =====
  const [listening, setListening] = useState(false);
  const recognition = useRef(null);

  useEffect(() => {
    if (!("webkitSpeechRecognition" in window)) return;

    recognition.current = new window.webkitSpeechRecognition();
    recognition.current.continuous = false; 
    recognition.current.interimResults = false;
    recognition.current.lang = "en-US";

    recognition.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSend(); // send automatically if desired
    };

    recognition.current.onend = () => setListening(false);
  }, []);

  const startListening = () => {
    if (!recognition.current) return;
    setListening(true);
    recognition.current.start();
  };

  // ===== Voice Settings for TTS =====
  const [voiceSettings, setVoiceSettings] = useState({
    rate: 1,
    pitch: 1,
    voiceName: null,
  });

function speak(rawText, settings = voiceSettings) {
  if (!window.speechSynthesis) return;
  
  // Clean text: remove markdown symbols (#, *, _, `, etc.)
  const text = rawText
    .replace(/[#_*`]/g, "")
    .replace(/\n{2,}/g, "\n") // multiple newlines -> one
    .trim();

  if (!text) return;

  // Stop any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = settings.rate;
  utterance.pitch = settings.pitch;
  
  if (settings.voiceName) {
    const voices = window.speechSynthesis.getVoices();
    const selected = voices.find((v) => v.name === settings.voiceName);
    if (selected) utterance.voice = selected;
  }

  utteranceRef.current = utterance;
  window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}


  // ===== Auto-scroll =====
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // ===== Send Chat =====
  const handleSend = async () => {
    if (!input.trim() && !file) return;

    if (input.trim()) setMessages((prev) => [...prev, { sender: "user", text: input }]);
    if (file) setMessages((prev) => [...prev, { sender: "user", file }]);

    const formData = new FormData();
    formData.append("message", input);
    if (file) formData.append("file", file);

    setInput("");
    setFile(null);
    setTyping(true);

    try {
      const res = await fetch("http://localhost:5000/api/chat", { method: "POST", body: formData });
      const data = await res.json();
      const fullText = typeof data.reply === "string" ? data.reply : JSON.stringify(data.reply, null, 2);

      // Animate typing
      let botText = "";
      for (let i = 0; i < fullText.length; i += 15) {
        botText = fullText.slice(0, i + 15);
        setMessages((prev) => [...prev.filter((m) => m.sender !== "bot-temp"), { sender: "bot-temp", text: botText }]);
        await new Promise((r) => setTimeout(r, 10));
      }

      setMessages((prev) => [...prev.filter((m) => m.sender !== "bot-temp"), { sender: "bot", text: fullText }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { sender: "bot", text: "⚠️ Something went wrong." }]);
    } finally {
      setTyping(false);
    }
  };

  // ===== Screen Share =====
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const videoTrack = stream.getVideoTracks()[0];
      setSharing(true);

      const captureInterval = setInterval(async () => {
        if (!sharing) {
          clearInterval(captureInterval);
          videoTrack.stop();
          return;
        }
        const imageBitmap = await new ImageCapture(videoTrack).grabFrame();
        const canvas = document.createElement("canvas");
        canvas.width = imageBitmap.width;
        canvas.height = imageBitmap.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(imageBitmap, 0, 0);
        const b64 = canvas.toDataURL("image/jpeg").split(",")[1];

        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "frame", image_b64: b64 }));
      }, 2000);
    } catch (err) {
      console.error("Screen share error:", err);
      setSharing(false);
    }
  };

  // ===== WebSocket =====
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:5000");
    setWs(socket);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "analysis") setMessages((prev) => [...prev, { sender: "bot", text: data.analysis }]);
      else if (data.type === "hint" || data.type === "info") console.log("Screen share hint:", data);
    };
    socket.onclose = () => console.log("Screen share WS disconnected");

    return () => socket.close();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-black text-white p-4">
      <h1 className="text-4xl font-extrabold mb-6 text-center text-purple-400 drop-shadow-lg animate-pulse tracking-wide">
        <span className="text-pink-400">Nexus</span> AI Assistant 🤖
      </h1>

      {/* Chat Window */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-6 space-y-4 shadow-xl border border-gray-700">
        {messages.map((msg, idx) => (
          <div key={idx} className={`p-4 rounded-3xl max-w-2xl transition-all duration-300 ${msg.sender === "user" ? "bg-gradient-to-r from-pink-500 to-orange-400 self-end ml-auto text-white shadow-lg animate-slide-in-right" : "bg-gradient-to-br from-gray-800 to-gray-700 text-gray-100 shadow-md animate-slide-in-left"}`}>
            {msg.text && <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{msg.text}</ReactMarkdown>}
            {msg.sender === "bot" && (
              <button className="ml-2 px-2 py-1 text-sm bg-purple-600 rounded hover:bg-purple-700" onClick={() => speak(msg.text)}>
                🔊 Listen
              </button>
            )}
             {msg.sender === "bot" && (
              <button className="ml-2 px-2 py-1 text-sm bg-purple-600 rounded hover:bg-purple-700"  onClick={stopSpeaking}>⏹️ Stop</button>
            )}
            {msg.file && (
              <div className="mt-3">
                {msg.file.type.startsWith("image/") ? (
                  <img src={URL.createObjectURL(msg.file)} alt="upload" className="max-w-xs rounded-lg shadow-md hover:scale-105 transition-transform" />
                ) : (
                  <a href={URL.createObjectURL(msg.file)} download={msg.file.name} className="text-blue-400 underline hover:text-blue-300 transition">📄 {msg.file.name}</a>
                )}
              </div>
            )}
          </div>
        ))}
        {typing && <div className="bg-gray-800 self-start p-3 rounded-3xl shadow-lg animate-fade-in"><TypingDots /></div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Section */}
      <div className="flex mt-4 items-center gap-2">
        <label className="bg-gray-800 px-4 py-3 rounded-full cursor-pointer hover:bg-gray-700 transition-all duration-300">
          📎
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
        </label>

        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask me anything..." className="flex-1 p-3 rounded-full bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all duration-300" onKeyDown={(e) => e.key === "Enter" && handleSend()} />

        <button onClick={handleSend} className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 rounded-full font-semibold hover:from-pink-600 hover:to-orange-500 transition-all duration-300 transform hover:scale-105 shadow-lg">Send 🚀</button>
        <button onClick={startListening} className="bg-gray-800 p-3 rounded-full">{listening ? "🎙️ Listening..." : "🎤 Speak"}</button>
        <button onClick={startScreenShare} className={`bg-gradient-to-r from-green-500 to-teal-500 px-4 py-3 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${sharing ? "opacity-50 cursor-not-allowed" : ""}`} disabled={sharing}>{sharing ? "Sharing..." : "Share Screen 🖥️"}</button>
      </div>

      {/* Voice Controls */}
      <div className="mt-2 flex gap-2 items-center">
        <label>Rate:</label>
        <input type="range" min="0.5" max="2" step="0.1" value={voiceSettings.rate} onChange={(e) => setVoiceSettings({ ...voiceSettings, rate: parseFloat(e.target.value) })} />
        <label>Pitch:</label>
        <input type="range" min="0.5" max="2" step="0.1" value={voiceSettings.pitch} onChange={(e) => setVoiceSettings({ ...voiceSettings, pitch: parseFloat(e.target.value) })} />
        <label>Voice:</label>
        <select value={voiceSettings.voiceName || ""} onChange={(e) => setVoiceSettings({ ...voiceSettings, voiceName: e.target.value })}>
          {window.speechSynthesis.getVoices().map((v) => (<option key={v.name} value={v.name}>{v.name}</option>))}
        </select>
      </div>

      {file && <div className="mt-2 text-sm text-gray-400 text-center">📁 Selected file: {file.name}</div>}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex space-x-2">
      <span className="w-3 h-3 bg-purple-400 rounded-full animate-bounce"></span>
      <span className="w-3 h-3 bg-pink-400 rounded-full animate-bounce delay-350"></span>
      <span className="w-3 h-3 bg-purple-400 rounded-full animate-bounce delay-300"></span>
    </div>
  );
}
