import React, { useState, useEffect } from "react";
import Home from "./Home";
import LeftPanel from "./LeftPanal"; // ✅ same name as your file (LeftPanal)

const ChatScreen = () => {
  const [messages, setMessages] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(Date.now());

  // 🧠 Load a selected chat’s messages from localStorage
  const handleSelectChat = (id) => {
    setCurrentChatId(id);
    const stored = JSON.parse(localStorage.getItem("chatHistory")) || [];
    const selected = stored.find((chat) => chat.id === id);
    setMessages(selected ? selected.messages : []);
  };

  // ➕ Create a new empty chat
  const handleNewChat = () => {
    const newChatId = Date.now();
    setCurrentChatId(newChatId);
    setMessages([]);
  };

  // 💾 Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length === 0) return;

    const title = messages[0]?.text || "New Chat";
    const stored = JSON.parse(localStorage.getItem("chatHistory")) || [];

    const updated = [
      ...stored.filter((chat) => chat.id !== currentChatId),
      { id: currentChatId, title, messages },
    ];

    localStorage.setItem("chatHistory", JSON.stringify(updated));
  }, [messages, currentChatId]);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-black text-white">
      {/* Left Side (Chat History) */}
      <div className="md:w-1/4 w-full md:h-full border-r border-gray-800">
        <LeftPanel
          onSelectChat={handleSelectChat}
          currentChatId={currentChatId}
          onNewChat={handleNewChat}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 md:w-3/4 w-full">
        <Home messages={messages} setMessages={setMessages} />
      </div>
    </div>
  );
};

export default ChatScreen;
