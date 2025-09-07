import React, { useEffect, useState } from 'react';
import './TypingIndicator.css';

const TypingIndicator = ({ typingUsers = [] }) => {
  const [animatedDots, setAnimatedDots] = useState('.');

  // Animate the dots similar to WhatsApp
  useEffect(() => {
    if (typingUsers.length === 0) return;

    const interval = setInterval(() => {
      setAnimatedDots(prev => {
        if (prev === '...') return '.';
        if (prev === '..') return '...';
        return '..';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [typingUsers.length]);

  // Don't render if no one is typing
  if (typingUsers.length === 0) {
    return null;
  }

  // Format the typing text similar to WhatsApp
  const getTypingText = () => {
    const names = typingUsers.map(user => user.userName || user);
    
    if (names.length === 1) {
      return `${names[0].slice(0, 10)} is typing${animatedDots}`;
    } else if (names.length === 2) {
      return `${names[0].slice(0, 8)} and ${names[1].slice(0, 8)} are typing${animatedDots}`;
    } else if (names.length === 3) {
      return `${names[0].slice(0, 6)}, ${names[1].slice(0, 6)} and ${names[2].slice(0, 6)} are typing${animatedDots}`;
    } else {
      return `${names[0].slice(0, 6)}, ${names[1].slice(0, 6)} and ${names.length - 2} others are typing${animatedDots}`;
    }
  };

  return (
    <div className="typing-indicator">
      <div className="typing-indicator-content">
        <div className="typing-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
        <span className="typing-text">
          {getTypingText()}
        </span>
      </div>
    </div>
  );
};

export default TypingIndicator;
