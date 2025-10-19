import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PlusCircle } from "lucide-react";

const LeftPanel = ({ onSelectChat, currentChatId, onNewChat }) => {
  const [chats, setChats] = useState([]);

  // Load chat history from localStorage
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("chatHistory")) || [];
    setChats(stored);
  }, []);

  // Function to select a chat
  const handleSelectChat = (id) => {
    onSelectChat(id);
  };

  return (
    <motion.div
      className="w-full md:w-1/4 bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col p-4 rounded-2xl shadow-xl overflow-y-auto"
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold tracking-wide">Chat History</h2>
        <button
          onClick={onNewChat}
          className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-sm px-3 py-1.5 rounded-lg transition-all duration-200 shadow-md"
        >
          <PlusCircle size={16} /> New
        </button>
      </div>

      {chats.length === 0 ? (
        <p className="text-gray-400 text-sm italic mt-10 text-center">
          No previous chats
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {chats.map((chat) => (
            <motion.div
              key={chat.id}
              className={`p-3 rounded-xl cursor-pointer text-sm hover:bg-indigo-600 hover:text-white transition-all ${
                chat.id === currentChatId ? "bg-indigo-700" : "bg-gray-700"
              }`}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleSelectChat(chat.id)}
            >
              {chat.title.length > 30
                ? chat.title.slice(0, 30) + "..."
                : chat.title}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default LeftPanel;
