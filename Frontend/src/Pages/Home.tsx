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
  const [listening, setListening] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [ws, setWs] = useState(null);

  const messagesEndRef = useRef(null);
  const utteranceRef = useRef(null);
  const recognition = useRef(null);

  // ===== Speech Recognition =====
  useEffect(() => {
    if (!("webkitSpeechRecognition" in window)) return;

    recognition.current = new window.webkitSpeechRecognition();
    recognition.current.continuous = false;
    recognition.current.interimResults = false;
    recognition.current.lang = "en-US";

    recognition.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSend();
    };
    recognition.current.onend = () => setListening(false);
  }, []);

  const startListening = () => {
    if (!recognition.current) return;
    setListening(true);
    recognition.current.start();
  };

  // ===== Voice Settings =====
  const [voiceSettings, setVoiceSettings] = useState({
    rate: 1,
    pitch: 1,
    voiceName: null,
  });

  function speak(rawText, settings = voiceSettings) {
    if (!window.speechSynthesis) return;
    const text = rawText.replace(/[#_*`]/g, "").trim();
    if (!text) return;

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = settings.rate;
    utter.pitch = settings.pitch;
    if (settings.voiceName) {
      const voices = window.speechSynthesis.getVoices();
      const selected = voices.find((v) => v.name === settings.voiceName);
      if (selected) utter.voice = selected;
    }
    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
  }

  function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  // ===== Auto-scroll =====
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // ===== WebSocket =====
  useEffect(() => {
    const socket = new WebSocket("wss://agent-backend-pocx.onrender.com/");
    setWs(socket);
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "analysis")
        setMessages((prev) => [...prev, { sender: "bot", text: data.analysis }]);
    };
    socket.onclose = () => console.log("WS closed");
    return () => socket.close();
  }, []);

  // ===== Send Message =====
  const handleSend = async () => {
    if (!input.trim() && !file) return;
    if (input.trim()) setMessages((p) => [...p, { sender: "user", text: input }]);
    if (file) setMessages((p) => [...p, { sender: "user", file }]);

    const formData = new FormData();
    formData.append("message", input);
    if (file) formData.append("file", file);

    setInput("");
    setFile(null);
    setTyping(true);

    try {
      const res = await fetch("https://agent-backend-pocx.onrender.com/api/chat", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      const fullText =
        typeof data.reply === "string" ? data.reply : JSON.stringify(data.reply);

      setMessages((p) => [...p, { sender: "bot", text: fullText }]);
      speak(fullText);
    } catch (err) {
      console.error(err);
      setMessages((p) => [...p, { sender: "bot", text: "⚠️ Something went wrong." }]);
    } finally {
      setTyping(false);
    }
  };

  // ===== Screen Share =====
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      setSharing(true);

      const captureInterval = setInterval(async () => {
        if (!sharing) {
          clearInterval(captureInterval);
          track.stop();
          return;
        }
        const frame = await new ImageCapture(track).grabFrame();
        const canvas = document.createElement("canvas");
        canvas.width = frame.width;
        canvas.height = frame.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(frame, 0, 0);
        const b64 = canvas.toDataURL("image/jpeg").split(",")[1];
        if (ws?.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: "frame", image_b64: b64 }));
      }, 2000);
    } catch (e) {
      console.error("Screen share error:", e);
      setSharing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-black text-white p-3 sm:p-4 md:p-6">
      {/* Header */}
      <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-purple-400 mb-4 drop-shadow-lg tracking-wide">
        <span className="text-pink-400">VibeCoder</span> AI Assistant 🤖
      </h1>

      {/* Chat Container */}
      <div className="flex-1 overflow-y-auto rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-3 sm:p-5 shadow-lg border border-gray-700 space-y-3 sm:space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-3 sm:p-4 rounded-3xl max-w-[90%] sm:max-w-2xl transition-all duration-300 ${
              msg.sender === "user"
                ? "bg-gradient-to-r from-pink-500 to-orange-400 self-end ml-auto text-white shadow-lg"
                : "bg-gradient-to-br from-gray-800 to-gray-700 text-gray-100 shadow-md"
            }`}
          >
            {msg.text && (
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {msg.text}
              </ReactMarkdown>
            )}

            {msg.sender === "bot" && (
              <div className="mt-2 flex gap-2 flex-wrap">
                <button
                  className="px-2 py-1 text-sm bg-purple-600 rounded hover:bg-purple-700"
                  onClick={() => speak(msg.text)}
                >
                  🔊 Listen
                </button>
                <button
                  className="px-2 py-1 text-sm bg-purple-600 rounded hover:bg-purple-700"
                  onClick={stopSpeaking}
                >
                  ⏹ Stop
                </button>
              </div>
            )}

            {msg.file && (
              <div className="mt-3">
                {msg.file.type.startsWith("image/") ? (
                  <img
                    src={URL.createObjectURL(msg.file)}
                    alt="upload"
                    className="max-w-xs rounded-lg shadow-md hover:scale-105 transition-transform"
                  />
                ) : (
                  <a
                    href={URL.createObjectURL(msg.file)}
                    download={msg.file.name}
                    className="text-blue-400 underline hover:text-blue-300 transition"
                  >
                    📄 {msg.file.name}
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
        {typing && <div className="text-gray-400 italic">Assistant is typing...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Section (Sticky on Mobile) */}
      <div className="sticky bottom-0 mt-3 sm:mt-4 flex flex-wrap items-center gap-2 sm:gap-3 bg-black/20 backdrop-blur-md p-2 sm:p-3 rounded-2xl">
        <label className="bg-gray-800 px-4 py-3 rounded-full cursor-pointer hover:bg-gray-700 transition-all duration-300">
          📎
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
        </label>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything..."
          className="flex-1 min-w-[150px] p-3 rounded-full bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm sm:text-base"
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />

        <button
          onClick={handleSend}
          className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 sm:px-6 py-2 sm:py-3 rounded-full font-semibold hover:from-pink-600 hover:to-orange-500 transition-all duration-300 transform hover:scale-105 shadow-lg text-sm sm:text-base"
        >
          Send 🚀
        </button>

        <button
          onClick={startListening}
          className="bg-gray-800 p-3 rounded-full text-sm sm:text-base"
        >
          {listening ? "🎙 Listening..." : "🎤 Speak"}
        </button>

        <button
          onClick={startScreenShare}
          className={`bg-gradient-to-r from-green-500 to-teal-500 px-3 sm:px-4 py-2 sm:py-3 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg text-sm sm:text-base ${
            sharing ? "opacity-50 cursor-not-allowed" : ""
          }`}
          disabled={sharing}
        >
          {sharing ? "Sharing..." : "🖥 Share"}
        </button>
      </div>

      {/* Voice Controls (Responsive) */}
      <div className="mt-3 flex flex-wrap gap-3 justify-center items-center text-sm sm:text-base">
        <div className="flex items-center gap-2">
          <label>Rate:</label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={voiceSettings.rate}
            onChange={(e) =>
              setVoiceSettings({ ...voiceSettings, rate: parseFloat(e.target.value) })
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <label>Pitch:</label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={voiceSettings.pitch}
            onChange={(e) =>
              setVoiceSettings({ ...voiceSettings, pitch: parseFloat(e.target.value) })
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <label>Voice:</label>
          <select
            value={voiceSettings.voiceName || ""}
            onChange={(e) => setVoiceSettings({ ...voiceSettings, voiceName: e.target.value })}
            className="bg-gray-800 p-2 rounded"
          >
            {window.speechSynthesis
              .getVoices()
              .map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {file && (
        <div className="mt-2 text-sm text-gray-400 text-center">📁 {file.name}</div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex space-x-2">
      <span className="w-3 h-3 bg-purple-400 rounded-full animate-bounce"></span>
      <span className="w-3 h-3 bg-pink-400 rounded-full animate-bounce delay-150"></span>
      <span className="w-3 h-3 bg-purple-400 rounded-full animate-bounce delay-300"></span>
    </div>
  );
}
