import React, { useState } from "react";

const Chatbot = () => {
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [responses, setResponses] = useState([]);

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  const handleSendMessage = async () => {
    if (!message) return;

    const newHistory = [...history, { role: "user", text: message }];
    setHistory(newHistory);
    setResponses((prev) => [...prev, { role: "user", text: message }]);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/chatai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, history: newHistory }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();
      const botReply = data.data.reply;

      setResponses((prev) => [...prev, { role: "bot", text: botReply }]);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat window */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
        {responses.map((resp, index) => (
          <div
            key={index}
            className={`flex ${
              resp.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`px-3 py-2 rounded-xl max-w-[75%] ${
                resp.role === "user"
                  ? "bg-purple-500 text-white rounded-br-none"
                  : "bg-gray-200 text-gray-800 rounded-bl-none"
              }`}
            >
              {resp.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input box */}
      <div>
        <div className="flex-1 items-center border-t p-2 gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 border text-black rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleSendMessage}
            className="bg-purple-600 hover:bg-purple-400 text-white px-4 py-2 rounded-xl transition"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
