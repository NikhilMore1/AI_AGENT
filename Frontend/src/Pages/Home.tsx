// Home.jsx (replace your existing file)
import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(import.meta.env.GEMINI_API_KEY);


export default function Home() {
  const [input, setInput] = useState(null);
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

    const text = rawText
      .replace(/[#_*`]/g, "")
      .replace(/\n{2,}/g, "\n")
      .trim();

    if (!text) return;

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

  // ===== WebSocket: connect to your backend for screen-share + help notifications =====
  useEffect(() => {
    // change host if needed
    const socket = new WebSocket("ws://localhost:5000");
    setWs(socket);

    socket.onopen = () => console.log("WS connected");
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "analysis") {
          setMessages((prev) => [...prev, { sender: "bot", text: data.analysis }]);
        } else if (data.type === "hint") {
          console.log("Screen share hint:", data);
        } else if (data.type === "new_help_request") {
          // Optionally show a small toast for supervisors
          console.log("New help request:", data.question);
        } else if (data.type === "help_resolved") {
          // Supervisor answered — show bot reply and speak it
          const botText = data.answer;
          setMessages((prev) => [...prev, { sender: "bot", text: botText }]);
          speak(botText);
        }
      } catch (e) {
        console.error("WS parse error", e);
      }
    };

    socket.onclose = () => console.log("WS closed");
    socket.onerror = (e) => console.log("WS error", e);

    return () => {
      socket.close();
    };
  }, []);

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
      // Send to your local backend
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

      // final bot message
      setMessages((prev) => [...prev.filter((m) => m.sender !== "bot-temp"), { sender: "bot", text: fullText }]);

      // Speak reply automatically
      speak(fullText);
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
        // grab frame
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

  // ===== Supervisor panel (toggleable) =====
  const [showAdmin, setShowAdmin] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [answerText, setAnswerText] = useState("");

  useEffect(() => {
    if (showAdmin) fetchRequests();
  }, [showAdmin]);

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch("http://localhost:5000/api/helprequests?status=pending");
      const list = await res.json();
      setRequests(list);
    } catch (e) {
      console.error("Failed to fetch requests", e);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleResolve = async (id) => {
    if (!answerText.trim()) {
      alert("Enter an answer first.");
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/helprequests/${id}/resolve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answerText }),
      });
      const data = await res.json();
      // Clear answer, refresh list
      setAnswerText("");
      fetchRequests();

      // You will also receive a websocket broadcast for this resolved event (the bot reply),
      // but we also add it to the chat instantly for immediate feedback:
      if (data.ok) {
        setMessages((prev) => [...prev, { sender: "bot", text: answerText }]);
        speak(answerText);
      }
    } catch (e) {
      console.error("Resolve failed", e);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-black text-white p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-extrabold mb-6 text-center text-purple-400 drop-shadow-lg animate-pulse tracking-wide">
          <span className="text-pink-400">Exon</span> AI Assistant 🤖
        </h1>
        <div className="flex gap-2">
          <button className="bg-gray-800 px-3 py-2 rounded" onClick={() => setShowAdmin((s) => !s)}>
            {showAdmin ? "Close Supervisor" : "Open Supervisor"}
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-4">
        {/* Chat column */}
        <div className="col-span-8 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-6 space-y-4 shadow-xl border border-gray-700">
            {messages.map((msg, idx) => (
              <div key={idx} className={`p-4 rounded-3xl max-w-2xl transition-all duration-300 ${msg.sender === "user" ? "bg-gradient-to-r from-pink-500 to-orange-400 self-end ml-auto text-white shadow-lg" : "bg-gradient-to-br from-gray-800 to-gray-700 text-gray-100 shadow-md"}`}>
                {msg.text && <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{msg.text}</ReactMarkdown>}
                {msg.sender === "bot" && (
                  <div className="mt-2 flex gap-2">
                    <button className="px-2 py-1 text-sm bg-purple-600 rounded hover:bg-purple-700" onClick={() => speak(msg.text)}>🔊 Listen</button>
                    <button className="px-2 py-1 text-sm bg-purple-600 rounded hover:bg-purple-700" onClick={stopSpeaking}>⏹️ Stop</button>
                  </div>
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
            {typing && <div className="bg-gray-800 self-start p-3 rounded-3xl shadow-lg"><TypingDots /></div>}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="mt-4 items-center gap-2 flex">
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

        {/* Admin column */}
        <div className="col-span-4 p-4 bg-gray-900 rounded-2xl shadow-lg">
          {showAdmin ? (
            <>
              <h2 className="text-xl font-bold mb-2">Supervisor Panel</h2>
              <button onClick={fetchRequests} className="mb-2 px-3 py-2 rounded bg-purple-600">Refresh</button>
              {loadingRequests ? <div>Loading...</div> : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {requests.length === 0 && <div className="text-gray-400">No pending requests.</div>}
                  {requests.map((r) => (
                    <div key={r._id} className="p-3 bg-gray-800 rounded">
                      <div className="text-sm text-gray-300">{r.question}</div>
                      <div className="mt-2 flex gap-2">
                        <input className="flex-1 p-2 rounded bg-gray-700" placeholder="Type answer..." value={answerText} onChange={(e) => setAnswerText(e.target.value)} />
                        <button className="px-3 py-2 bg-green-600 rounded" onClick={() => handleResolve(r._id)}>Resolve</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-gray-400">Open Supervisor to view & resolve pending help requests.</div>
          )}
        </div>
      </div>
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
