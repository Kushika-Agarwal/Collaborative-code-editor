import React, { useState } from "react";
import Chatbot from "./chatBot";
import { MessageCircle, X } from "lucide-react";
import "./floating.css"

const FloatingChatbot = () => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [hover, setHover] = useState(false);

  const handleDrag = (e) => {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    let newX = screenW - e.clientX - 50;
    let newY = screenH - e.clientY - 50;

    if (newX < 10) newX = 10;
    if (newY < 10) newY = 10;

    setPosition({ x: newX, y: newY });
  };

  return (
    <>
      {/* Floating Icon */}
      <div
        onClick={() => setOpen(!open)}
        onDrag={(e) => handleDrag(e)}
        draggable
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="floating-button"
        style={{
          bottom: position.y,
          right: position.x,
        }}
      >
        <MessageCircle size={28} />

        {/* Hover Text */}
        {hover && <div className="tooltip">Chatbot</div>}
      </div>

      {/* Popup Chatbot */}
      {open && (
        <div className="chatbot-container">
          {/* Header */}
          <div className="chatbot-header">
            <span>AI Chatbot</span>
            <button onClick={() => setOpen(false)} className="close-button">
              <X size={14} color="white" />
            </button>
          </div>

          {/* Chatbot Component */}
          <div className="flex-1">
            <Chatbot />
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingChatbot;
