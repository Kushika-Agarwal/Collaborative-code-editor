import { useCallback, useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";
import VideoCall from "./VideoCall";
import VersionHistory from "./VersionHistory";
import ResizableLayout from "./components/ResizableLayout";
import ChatWindow from "./components/ChatWindow";
import FileExplorer from "./components/FileExplorer";
import LandingPage from "./pages/Landing_page";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { useToast } from "./hooks/use-toast";
import { 
  detectFileType, 
  getLanguageDisplayName, 
  getPopularLanguages,
  getAllSupportedLanguages,
  isLanguageSupported 
} from "./utils/fileTypeDetection";
import BackToTop from "./components/ui/BackToTop";
import * as monaco from 'monaco-editor';
import CppCompiler from "./components/CppCompiler";

// Socket connection is established once and reused.
const socket = io("http://localhost:3000");

const App = () => {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState(() => localStorage.getItem("userName") || "");
  
  // File management state - This is the primary source of truth for file data.
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState("");
  const [currentFileContent, setCurrentFileContent] = useState("");
  const [currentFileLanguage, setCurrentFileLanguage] = useState("javascript");
  
  // Legacy state - Maintained for components or logic not yet fully migrated
  // to the new file management system. Should be phased out eventually.
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [filename, setFilename] = useState("untitled.js");

  const [pendingFilename, setPendingFilename] = useState("");
  const [users, setUsers] = useState([]);
  const { toast } = useToast();
  const [typing, setTyping] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showAllLanguages, setShowAllLanguages] = useState(false);
  const [undoRedoState, setUndoRedoState] = useState({
    canUndo: false,
    canRedo: false,
    currentVersionIndex: -1,
    totalVersions: 0,
  });
  const [isUndoing, setIsUndoing] = useState(false);
  const [isRedoing, setIsRedoing] = useState(false);
  const [isCreatingCheckpoint, setIsCreatingCheckpoint] = useState(false);
  
  // Resizable panel states
  const [isChatDetached, setIsChatDetached] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);

  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);

  // Connection status state and refs
  const [isConnected, setIsConnected] = useState(socket.connected);
  const isInitialConnect = useRef(true);
  const editorRef = useRef(null);
  const decorationsRef = useRef({});
  const widgetsRef = useRef({});
  const colorCacheRef = useRef({});

  const [codeChangeTimeout, setCodeChangeTimeout] = useState(null);
  const [theme, setTheme] = useState("dark");

  const messagesEndRef = useRef(null);

  // Effect for auto-scrolling chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  // Effect to load saved theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "dark";
    setTheme(savedTheme);
    if (savedTheme === "light") {
      document.body.classList.add("light-mode");
    }
  }, []);

  // Effect to handle socket connection status and display toasts
  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
      if (!isInitialConnect.current) {
        toast({
          title: "Reconnected",
          description: "You are back online.",
          duration: 3000,
        });
      }
      isInitialConnect.current = false;
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      toast({
        title: "Connection Lost",
        description: "Attempting to reconnect...",
        variant: "destructive",
        duration: 5000,
      });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [toast]);

  // Effect to update the browser tab title based on the current state
  useEffect(() => {
    let baseTitle;
    if (joined) {
      baseTitle = activeFile ? `${activeFile} — CodeRoom` : `CodeRoom (${roomId})`;
    } else {
      baseTitle = 'Real-time Collaborative Code Editor';
    }
    document.title = hasUnsavedEdits ? `● ${baseTitle}` : baseTitle;
    return () => {
      document.title = 'Real-time Collaborative Code Editor';
    };
  }, [hasUnsavedEdits, joined, activeFile, roomId]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.body.classList.toggle("light-mode", newTheme === "light");
  };

  // Main effect for handling all real-time socket events
  useEffect(() => {
    if (!joined) return;

    // --- Event Handlers ---
    const handleUserJoined = (users) => setUsers(users);
    const handleCodeUpdated = (newCode) => {
        setCode(newCode);
        setCurrentFileContent(newCode);
    };
    const handleUserTyping = (user) => {
        setTyping(`${user.slice(0, 8)} is typing...`);
        setTimeout(() => setTyping(""), 3000);
    };
    const handleLanguageUpdated = (newLanguage) => {
        setLanguage(newLanguage);
        setCurrentFileLanguage(newLanguage);
    };
    const handleChatMessage = ({ userName, message }) =>
        setChatMessages((prev) => [...prev, { userName, message }]);
    const handleFilesUpdated = ({ files: newFiles, activeFile: newActiveFile }) => {
        setFiles(newFiles);
        setActiveFile(newActiveFile);
        const currentFile = newFiles.find(f => f.filename === newActiveFile);
        if (currentFile) {
            setCurrentFileContent(currentFile.code);
            const detectedLang = detectFileType(currentFile.filename);
            setCurrentFileLanguage(detectedLang);
            // Sync legacy state
            setCode(currentFile.code);
            setLanguage(detectedLang);
            setFilename(currentFile.filename);
        }
    };
    const handleFileCreated = ({ file, createdBy }) => {
        setFiles(prev => [...prev, file]);
        setChatMessages(prev => [...prev, { userName: "System", message: `File "${file.filename}" created by ${createdBy}` }]);
    };
    const handleFileDeleted = ({ filename, deletedBy, newActiveFile }) => {
        setFiles(prev => prev.filter(f => f.filename !== filename));
        if (newActiveFile && newActiveFile !== activeFile) {
            setActiveFile(newActiveFile);
            socket.emit("switchFile", { roomId, filename: newActiveFile, switchedBy: userName });
        }
        setChatMessages(prev => [...prev, { userName: "System", message: `File "${filename}" deleted by ${deletedBy}` }]);
    };
    const handleFileRenamed = ({ oldFilename, newFilename, renamedBy }) => {
        setFiles(prev => prev.map(f => f.filename === oldFilename ? { ...f, filename: newFilename } : f));
        if (activeFile === oldFilename) {
            setActiveFile(newFilename);
            setFilename(newFilename);
        }
        setChatMessages(prev => [...prev, { userName: "System", message: `File renamed from "${oldFilename}" to "${newFilename}" by ${renamedBy}` }]);
    };
    const handleActiveFileChanged = ({ filename, file }) => {
        setActiveFile(filename);
        setCurrentFileContent(file.code);
        setCurrentFileLanguage(file.language);
        // Sync legacy state
        setCode(file.code);
        setLanguage(file.language);
        setFilename(filename);
    };
    const handleFileCodeUpdated = ({ filename, code: newCode }) => {
        if (filename === activeFile) {
            setCurrentFileContent(newCode);
            setCode(newCode);
        }
        setFiles(prev => prev.map(f => f.filename === filename ? { ...f, code: newCode } : f));
    };
    const handleFileLanguageUpdated = ({ filename, language: newLanguage }) => {
        if (filename === activeFile) {
            setCurrentFileLanguage(newLanguage);
            setLanguage(newLanguage);
        }
        setFiles(prev => prev.map(f => f.filename === filename ? { ...f, language: newLanguage } : f));
    };
    const handleVersionAdded = (data) => setUndoRedoState(data.undoRedoState);
    const handleCodeReverted = (data) => {
        setCode(data.code);
        setLanguage(data.language);
        setCurrentFileContent(data.code);
        setCurrentFileLanguage(data.language);
        setUndoRedoState(data.undoRedoState);
        setIsUndoing(false);
        setIsRedoing(false);
    };
    const handleUndoRedoStateResponse = (response) => {
        if (response.success) setUndoRedoState(response.undoRedoState);
    };
    const handleCheckpointCreated = (data) => {
        setIsCreatingCheckpoint(false);
        console.log(`Checkpoint created by ${data.performer}`);
    };
    const handleError = (error) => {
        console.error("Socket error:", error);
        if (error.type) {
            toast({ title: `Error: ${error.type}`, description: error.message, variant: "destructive" });
        }
        if (error.type === "undo") setIsUndoing(false);
        if (error.type === "redo") setIsRedoing(false);
        if (error.type === "checkpoint") setIsCreatingCheckpoint(false);
    };
    const onCursorPosition = (payload) => {
        if (payload.userId !== socket.id) renderRemoteCursor(payload);
    };
    const onCursorCleared = (payload) => clearRemoteCursor(payload.userId);

    // --- Register Listeners ---
    socket.on("userJoined", handleUserJoined);
    socket.on("codeUpdated", handleCodeUpdated);
    socket.on("userTyping", handleUserTyping);
    socket.on("languageUpdated", handleLanguageUpdated);
    socket.on("chatMessage", handleChatMessage);
    socket.on("filesUpdated", handleFilesUpdated);
    socket.on("fileCreated", handleFileCreated);
    socket.on("fileDeleted", handleFileDeleted);
    socket.on("fileRenamed", handleFileRenamed);
    socket.on("activeFileChanged", handleActiveFileChanged);
    socket.on("fileCodeUpdated", handleFileCodeUpdated);
    socket.on("fileLanguageUpdated", handleFileLanguageUpdated);
    socket.on("versionAdded", handleVersionAdded);
    socket.on("codeReverted", handleCodeReverted);
    socket.on("undoRedoStateResponse", handleUndoRedoStateResponse);
    socket.on("checkpointCreated", handleCheckpointCreated);
    socket.on("error", handleError);
    socket.on('cursorPosition', onCursorPosition);
    socket.on('cursorCleared', onCursorCleared);

    return () => {
      // --- Clean up THIS effect's listeners ---
      // This is crucial. Using socket.off() without arguments would remove
      // ALL listeners, including the 'connect' and 'disconnect' listeners
      // from the other useEffect hook.
      socket.off("userJoined", handleUserJoined);
      socket.off("codeUpdated", handleCodeUpdated);
      socket.off("userTyping", handleUserTyping);
      socket.off("languageUpdated", handleLanguageUpdated);
      socket.off("chatMessage", handleChatMessage);
      socket.off("filesUpdated", handleFilesUpdated);
      socket.off("fileCreated", handleFileCreated);
      socket.off("fileDeleted", handleFileDeleted);
      socket.off("fileRenamed", handleFileRenamed);
      socket.off("activeFileChanged", handleActiveFileChanged);
      socket.off("fileCodeUpdated", handleFileCodeUpdated);
      socket.off("fileLanguageUpdated", handleFileLanguageUpdated);
      socket.off("versionAdded", handleVersionAdded);
      socket.off("codeReverted", handleCodeReverted);
      socket.off("undoRedoStateResponse", handleUndoRedoStateResponse);
      socket.off("checkpointCreated", handleCheckpointCreated);
      socket.off("error", handleError);
      socket.off('cursorPosition', onCursorPosition);
      socket.off('cursorCleared', onCursorCleared);
    };
  }, [joined, roomId, userName, activeFile]); // Dependencies for re-running the effect

  // Cursors logic wrapped in useCallback for stability
  const getUserColor = useCallback((userId) => {
    if (colorCacheRef.current[userId]) return colorCacheRef.current[userId];
    const palette = ['#E57373', '#81C784', '#64B5F6', '#FFD54F', '#BA68C8'];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
    const color = palette[hash % palette.length];
    colorCacheRef.current[userId] = color;
    return color;
  }, []);

  const renderRemoteCursor = useCallback((payload) => {
      const editor = editorRef.current;
      if (!editor || !payload || !payload.position) return;
      const currentFileName = activeFile || filename;
      if (payload.filename !== currentFileName) return;
      
      const { userId, userName, position } = payload;
      const range = new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column + 1);
      
      const decorationOpts = {
          className: 'remote-cursor',
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      };
      const newDecos = editor.deltaDecorations(decorationsRef.current[userId] || [], [{ range, options: decorationOpts }]);
      decorationsRef.current[userId] = newDecos;

      const widgetId = `remote-cursor-widget-${userId}`;
      let node = document.getElementById(widgetId);
      if (!node) {
        node = document.createElement('div');
        node.id = widgetId;
        node.className = 'remote-cursor-widget';
        node.style.backgroundColor = getUserColor(userId);
        node.textContent = (userName || 'User').slice(0, 12);

        const widget = {
            getId: () => widgetId,
            getDomNode: () => node,
            getPosition: () => ({ position, preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE, monaco.editor.ContentWidgetPositionPreference.BELOW] }),
        };
        editor.addContentWidget(widget);
        widgetsRef.current[userId] = widget;
      } else {
        editor.layoutContentWidget(widgetsRef.current[userId]);
      }
  }, [activeFile, filename, getUserColor]);

  const clearRemoteCursor = useCallback((userId) => {
      const editor = editorRef.current;
      if (!editor) return;
      if (decorationsRef.current[userId]) {
          editor.deltaDecorations(decorationsRef.current[userId], []);
          delete decorationsRef.current[userId];
      }
      if (widgetsRef.current[userId]) {
          editor.removeContentWidget(widgetsRef.current[userId]);
          delete widgetsRef.current[userId];
      }
  }, []);

  const handleJoinFromLanding = (newRoomId, newUserName) => {
    setRoomId(newRoomId);
    setUserName(newUserName);
    localStorage.setItem("userName", newUserName);
    socket.emit("join_room", { roomId: newRoomId, userName: newUserName });
    setJoined(true);
    setTimeout(() => {
      socket.emit("getUndoRedoState", { roomId: newRoomId });
    }, 1000);
  };
  
  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast({
        title: "Copied to Clipboard",
        description: `Room ID: ${roomId}`,
        duration: 2000,
      });
    } catch (err) {
      console.error('Failed to copy room ID:', err);
      toast({
        title: "Failed to Copy",
        description: "An error occurred while copying.",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  // --- File Management Handlers ---
  const handleFileCreate = (filename) => socket.emit("createFile", { roomId, filename, createdBy: userName });
  const handleFileDelete = (filename) => socket.emit("deleteFile", { roomId, filename, deletedBy: userName });
  const handleFileRename = (oldFilename, newFilename) => {
    if (!newFilename || newFilename === oldFilename) return;
    socket.emit("renameFile", { roomId, oldFilename, newFilename, renamedBy: userName });
  };
  const handleFileSwitch = (filename) => {
    if (filename === activeFile) return;
    socket.emit("switchFile", { roomId, filename, switchedBy: userName });
  };
  
  const leaveRoom = () => {
    socket.emit("leaveRoom", { roomId }); // Good practice to inform server which room is being left
    setJoined(false);
    // Reset all relevant states
    setRoomId("");
    localStorage.removeItem("userName");
    setUsers([]);
    setFiles([]);
    setActiveFile("");
    setCurrentFileContent("");
    setCurrentFileLanguage("javascript");
    setCode("");
    setLanguage("javascript");
    setFilename("untitled.js");
    setChatMessages([]);
    isInitialConnect.current = true;
  };

  const handleChange = (newCode) => {
    setCode(newCode);
    setCurrentFileContent(newCode);
    setHasUnsavedEdits(true);

    if (codeChangeTimeout) {
      clearTimeout(codeChangeTimeout);
    }
    
    const newTimeout = setTimeout(() => {
      if (activeFile) {
        socket.emit('fileCodeChange', { roomId, filename: activeFile, code: newCode });
      } else {
        socket.emit('codeChange', { roomId, code: newCode }); // Fallback
      }
      setHasUnsavedEdits(false);
    }, 500);

    setCodeChangeTimeout(newTimeout);
    socket.emit('typing', { roomId, userName });
  };

  const saveFilenameChange = () => {
    if (!pendingFilename || pendingFilename === (activeFile || filename)) return;
    handleFileRename(activeFile || filename, pendingFilename);
    setPendingFilename("");
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    setCurrentFileLanguage(newLanguage);
    
    if (activeFile) {
      socket.emit("fileLanguageChange", { roomId, filename: activeFile, language: newLanguage });
    } else {
      socket.emit("languageChange", { roomId, language: newLanguage }); // Fallback
    }
  };

  const handleUndo = useCallback(() => {
    if (undoRedoState.canUndo && !isUndoing) {
      setIsUndoing(true);
      socket.emit("undo", { roomId });
    }
  }, [undoRedoState, isUndoing, roomId]);

  const handleRedo = useCallback(() => {
    if (undoRedoState.canRedo && !isRedoing) {
      setIsRedoing(true);
      socket.emit("redo", { roomId });
    }
  }, [undoRedoState, isRedoing, roomId]);

  const createCheckpoint = () => {
    if (!isCreatingCheckpoint) {
      setIsCreatingCheckpoint(true);
      socket.emit("createCheckpoint", { roomId, code: currentFileContent, language: currentFileLanguage });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    if (joined) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [joined, handleUndo, handleRedo]);

  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newMessage = { userName, message: chatInput };
    // The local update is now handled by the socket echo from the server for consistency
    socket.emit("chatMessage", { roomId, ...newMessage });
    setChatInput("");
  };

  const handleEditorOnMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  if (!joined) {
    return (
      <>
        <LandingPage onJoinRoom={handleJoinFromLanding} />
        <BackToTop />
      </>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {currentFileLanguage === "cpp" && (
            <div style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: "1rem" }}>
                <CppCompiler code={currentFileContent} theme={theme} />
            </div>
        )}
        <ResizableLayout
          sidebar={
            <div className="sidebar">
              <button onClick={toggleTheme} className="theme-toggle-btn">
                {theme === "light" ? "☀️ Light Mode" : "🌙 Dark Mode"}
              </button>
              <div className="room-info">
                <h2>Code Room: {roomId}</h2>
                <button className="copy-room-id-btn" onClick={copyRoomId} title="Copy Room ID">
                  <span className="copy-icon">📋</span>
                  <span className="copy-text">Copy ID</span>
                </button>
              </div>
              <h3>Users: <span style={{ fontWeight: "bold", color: "#2563eb" }}>{users.length}</span></h3>
              <ul>
                {users.map((user, index) => <li key={index}>{user.slice(0, 8)}</li>)}
              </ul>
              <p className="typing-indicator">{typing || " "}</p>
              
              <FileExplorer
                files={files}
                activeFile={activeFile}
                onFileCreate={handleFileCreate}
                onFileDelete={handleFileDelete}
                onFileRename={handleFileRename}
                onFileSwitch={handleFileSwitch}
                userName={userName}
              />
              
              <div className="file-controls">
                <h3>Current File Settings</h3>
                <div className="filename-input-group">
                  <label htmlFor="filename">Rename File:</label>
                  <input
                    id="filename"
                    type="text"
                    className="filename-input"
                    value={pendingFilename}
                    onChange={(e) => setPendingFilename(e.target.value)}
                    placeholder={activeFile || filename}
                  />
                  <button onClick={saveFilenameChange} className="save-filename-btn">Save</button>
                </div>

                <div className="language-selector-group">
                  <label htmlFor="language">Language:</label>
                  <select
                    id="language"
                    className="language-selector"
                    value={currentFileLanguage}
                    onChange={handleLanguageChange}
                  >
                    <optgroup label="Popular Languages">
                      {getPopularLanguages().map((lang) => <option key={lang.id} value={lang.id}>{lang.name}</option>)}
                    </optgroup>
                    {showAllLanguages && (
                      <optgroup label="All Languages">
                        {getAllSupportedLanguages()
                          .filter(lang => !getPopularLanguages().some(p => p.id === lang.id))
                          .map((lang) => <option key={lang.id} value={lang.id}>{lang.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                  <button type="button" className="show-all-languages-btn" onClick={() => setShowAllLanguages(!showAllLanguages)}>
                    {showAllLanguages ? "Show Less" : "Show All"}
                  </button>
                </div>
              </div>
              
              <div className="version-controls">
                <h3>Version History</h3>
                <div className="version-buttons">
                  <button onClick={handleUndo} disabled={!undoRedoState.canUndo || isUndoing} title="Undo (Ctrl+Z)">
                    {isUndoing ? "Undoing..." : "Undo"}
                  </button>
                  <button onClick={handleRedo} disabled={!undoRedoState.canRedo || isRedoing} title="Redo (Ctrl+Y)">
                    {isRedoing ? "Redoing..." : "Redo"}
                  </button>
                </div>
                <button onClick={() => setShowVersionHistory(true)} title="View full history">
                  History
                </button>
                <button onClick={createCheckpoint} disabled={isCreatingCheckpoint} title="Create a named checkpoint">
                  {isCreatingCheckpoint ? "Creating..." : "Checkpoint"}
                </button>
              </div>

              <button className="leave-button" onClick={leaveRoom}>
                Leave Room
              </button>
            </div>
          }
          editor={
            <div className="editor-wrapper">
              <div className="editor-header">
                <span>📄 {activeFile || filename} 
                  <span className="file-language-badge">{getLanguageDisplayName(currentFileLanguage)}</span>
                </span>
              </div>
              <div style={{ position: "relative", height: "calc(100% - 40px)" }}>
                <Editor
                  height="100%"
                  language={currentFileLanguage} 
                  value={currentFileContent} 
                  onChange={handleChange}
                  onMount={handleEditorOnMount}
                  theme={theme === "dark" ? "vs-dark" : "vs-light"}
                  options={{ minimap: { enabled: false }, fontSize: 14, lineNumbers: "on" }}
                />
                {!currentFileContent && (
                  <div className="editor-placeholder">start typing here...</div>
                )}
              </div>
              <VideoCall socket={socket} roomId={roomId} userName={userName} joined={joined} />
            </div>
          }
          chatPanel={
            <div className="chat-panel-content">
              <div className="chat-messages" ref={messagesEndRef}>
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className="chat-message">
                    <span className="chat-user">{msg.userName.slice(0, 8)}:</span> {msg.message}
                  </div>
                ))}
              </div>
              <form className="chat-input-form" onSubmit={sendChatMessage}>
                <input
                  className="chat-input"
                  type="text"
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  maxLength={200}
                />
                <button type="submit" className="chat-send-btn">Send</button>
              </form>
            </div>
          }
        />
        <VersionHistory
          socket={socket}
          roomId={roomId}
          isOpen={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;