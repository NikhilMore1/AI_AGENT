import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PlusCircle, X } from "lucide-react";

const LeftPanel = ({ onSelectChat, currentChatId, onNewChat, closeSidebar }) => {
  const [chats, setChats] = useState([]);

  useEffect(() => {
    const loadChats = () => {
      const stored = JSON.parse(localStorage.getItem("chatHistory")) || [];
      setChats(stored.sort((a, b) => b.id - a.id));
    };
    loadChats();
    window.addEventListener("storage", loadChats);
    return () => window.removeEventListener("storage", loadChats);
  }, []);

  useEffect(() => {
  const loadChats = async () => {
    try {
      const res = await fetch("https://agent-backend-pocx.onrender.com/api/get-chats");
      const data = await res.json();
      setChats(data);
    } catch (err) {
      console.error("Failed to load DB chats:", err);
    }
  };
  loadChats();
}, []);

  return (
    <motion.div
      className="h-full w-full bg-gradient-to-b from-gray-950 via-gray-900 to-gray-800
      text-white flex flex-col p-5 md:p-4 lg:p-5 shadow-2xl overflow-y-auto 
      border-r border-gray-800 md:rounded-none md:rounded-r-3xl backdrop-blur-sm"
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-3">
        <h2 className="text-xl lg:text-2xl font-semibold tracking-wide text-purple-400">
          💬 Chats
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={onNewChat}
            className="flex items-center gap-1 bg-gradient-to-r from-purple-500 to-pink-500 
            hover:from-pink-600 hover:to-orange-500 text-xs md:text-sm px-3 py-1.5 rounded-lg 
            transition-all duration-200 shadow-md font-medium"
          >
            <PlusCircle size={16} /> New
          </button>

          <button
            onClick={closeSidebar}
            className="md:hidden text-gray-300 hover:text-white p-2 transition"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        {chats.length === 0 ? (
          <p className="text-gray-400 text-sm italic mt-16 text-center">
            No chats yet
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {chats.map((chat) => (
              <motion.div
                key={chat.id}
                className={`p-3 rounded-xl cursor-pointer text-sm md:text-[15px] font-medium truncate transition-all duration-300 ${
                  chat.id === currentChatId
                    ? "bg-purple-700/90 shadow-md text-white"
                    : "bg-gray-800/70 hover:bg-purple-600/80 hover:text-white"
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onSelectChat(chat.id)}
              >
                {chat.title?.length > 35
                  ? chat.title.slice(0, 35) + "..."
                  : chat.title}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-3 border-t border-gray-700 text-[12px] text-gray-500 text-center tracking-wide">
        <p>✨ VibeCoder AI — {new Date().getFullYear()}</p>
      </div>
    </motion.div>
  );
};

export default LeftPanel;
