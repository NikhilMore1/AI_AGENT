import React, { useState, useEffect } from "react";
import Home from "./Home";
import LeftPanel from "./LeftPanal";

const ChatScreen = () => {
  const [messages, setMessages] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(Date.now());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 🧠 Load selected chat
  const handleSelectChat = (id) => {
    setCurrentChatId(id);
    const stored = JSON.parse(localStorage.getItem("chatHistory")) || [];
    const selected = stored.find((chat) => chat.id === id);
    setMessages(selected ? selected.messages : []);
    setSidebarOpen(false); // auto-close on mobile
  };

  // ➕ New chat
 const handleNewChat = async () => {
  const stored = JSON.parse(localStorage.getItem("chatHistory")) || [];
  const current = stored.find((chat) => chat.id === currentChatId);

  // 🧾 Step 1: Save current chat (if not empty)
  if (current && current.messages.length > 0) {
    try {
      await fetch("http://localhost:5000/api/save-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: currentChatId,
          title: current.title || "New Chat",
          messages: current.messages,
        }),
      });
      console.log("💾 Chat saved to DB");
    } catch (err) {
      console.error("Failed to save chat:", err);
    }
  }

  // 🆕 Step 2: Start a new chat
  const newChatId = Date.now();
  setCurrentChatId(newChatId);
  setMessages([]);
  setSidebarOpen(false);
};


  // 💾 Save chats in localStorage
  useEffect(() => {
    if (messages.length === 0) return;
    const title = messages[0]?.text?.slice(0, 30) || "New Chat";
    const stored = JSON.parse(localStorage.getItem("chatHistory")) || [];

    const updated = [
      ...stored.filter((chat) => chat.id !== currentChatId),
      { id: currentChatId, title, messages },
    ];

    localStorage.setItem("chatHistory", JSON.stringify(updated));
  }, [messages, currentChatId]);

  return (
    <div className="relative flex h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-black text-white overflow-hidden">
      {/* Sidebar */}
      <div
        className={`fixed md:static top-0 left-0 h-full z-40 transform transition-transform duration-300 ease-in-out 
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} 
          w-[80%] sm:w-[60%] md:w-[25%] lg:w-[22%] xl:w-[18%]`}
      >
        <LeftPanel
          onSelectChat={handleSelectChat}
          currentChatId={currentChatId}
          onNewChat={handleNewChat}
          closeSidebar={() => setSidebarOpen(false)}
        />
      </div>

      {/* Mobile toggle button */}
      <button
        onClick={() => setSidebarOpen((prev) => !prev)}
        className="absolute top-4 left-4 z-50 md:hidden bg-gray-900/80 backdrop-blur-md p-2 rounded-full shadow-md text-white hover:bg-gray-800 transition"
      >
        {sidebarOpen ? "❌" : "☰"}
      </button>

      {/* Chat window */}
      <div className="flex-1 flex flex-col w-full md:w-[75%] lg:w-[78%] xl:w-[82%] h-full overflow-hidden">
        <Home messages={messages} setMessages={setMessages} />
      </div>
    </div>
  );
};

export default ChatScreen;
