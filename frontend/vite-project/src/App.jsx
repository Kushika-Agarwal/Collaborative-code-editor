import { useCallback, useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
const socket = io("http://localhost:3000");
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
import NotFound from "./pages/not-found";
import { 
  detectFileType, 
  getLanguageDisplayName, 
  getPopularLanguages,
  getAllSupportedLanguages,
  isLanguageSupported 
} from "./utils/fileTypeDetection";

import BackToTop from "./components/ui/BackToTop";

import * as monaco from 'monaco-editor';


const App = () => {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState(() => localStorage.getItem("userName") || "");
  
  // File management state
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState("");
  const [currentFileContent, setCurrentFileContent] = useState("");
  const [currentFileLanguage, setCurrentFileLanguage] = useState("javascript");
  
  // Legacy state for backward compatibility
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("");
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


  // New state and ref for connection status
  const [isConnected, setIsConnected] = useState(socket.connected);
  const isInitialConnect = useRef(true);

  const [codeChangeTimeout, setCodeChangeTimeout] = useState(null);
  const [theme, setTheme] = useState("dark");


  // Scroll Control State
  const messagesEndRef = useRef(null);

   // auto-scroll effect
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTo({
        top: messagesEndRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [chatMessages]);

  // Load saved theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "dark";
    setTheme(savedTheme);
    if (savedTheme === "light") {
      document.body.classList.add("light-mode");
    }
  }, []);

  // New useEffect to handle connection status and toasts
  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
      if (isInitialConnect.current) {
        isInitialConnect.current = false;
      } else {
        toast({
          title: "Reconnected",
          description: "You are back online.",
          duration: 3000,
        });
      }
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


  // Enhancement:
  //  Show Active File in Browser Tab Title
  useEffect(() => {
  let baseTitle = activeFile || filename || "Collaborative Editor";
  if (joined) {
    if (activeFile) {
      baseTitle = `${activeFile} — CodeRoom`;
    } else {
      baseTitle = `CodeRoom (${roomId})`;
    }
  } else {
    baseTitle = 'Real-time Collaborative Code Editor';
  }
  document.title = hasUnsavedEdits ? `● ${baseTitle}` : baseTitle;
  return () => {
    document.title = 'Real-time Collaborative Code Editor';
  };
}, [hasUnsavedEdits, joined, activeFile, filename, roomId]);

  const toggleTheme = () => {
    if (theme === "dark") {
      document.body.classList.add("light-mode");
      localStorage.setItem("theme", "light");
      setTheme("light");
    } else {
      document.body.classList.remove("light-mode");
      localStorage.setItem("theme", "dark");
      setTheme("dark");
    }
  };

  // Helper: per-user color selection
  const getUserColor = (userId) => {
    if (colorCacheRef.current[userId]) return colorCacheRef.current[userId];
    const palette = [
      '#E57373', '#81C784', '#64B5F6', '#FFD54F', '#BA68C8',
      '#4DB6AC', '#F06292', '#7986CB', '#A1887F', '#90A4AE'
    ];
    // Simple hash
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
    const color = palette[hash % palette.length];
    colorCacheRef.current[userId] = color;
    return color;
  };

  // Render a remote cursor decoration and label
  const renderRemoteCursor = (payload) => {
    const editor = editorRef.current;
    if (!editor || !payload) return;
    const model = editor.getModel();
    if (!model) return;
    const currentFileName = activeFile || filename;
    if (!payload.filename || payload.filename !== currentFileName) return;

    const { userId, userName, position } = payload;
    const range = new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column);

    // Update decoration
    const opts = {
      className: 'remote-cursor',
      stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      overviewRuler: { color: getUserColor(userId), position: monaco.editor.OverviewRulerLane.Center },
      after: { content: '', inlineClassName: 'remote-cursor-inline' },
      isWholeLine: false,
    };
    const newDecos = editor.deltaDecorations(decorationsRef.current[userId] || [], [{ range, options: opts }]);
    decorationsRef.current[userId] = newDecos;

    // Update/add content widget for name label
    const id = `remote-cursor-widget-${userId}`;
    const node = document.createElement('div');
    node.className = 'remote-cursor-widget';
    node.style.backgroundColor = getUserColor(userId);
    node.textContent = (userName || 'User').slice(0, 12);

    const widget = {
      getId: () => id,
      getDomNode: () => node,
      getPosition: () => ({ position, preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE, monaco.editor.ContentWidgetPositionPreference.BELOW] }),
    };

    // Remove previous widget if exists
    if (widgetsRef.current[userId]) {
      try { editor.removeContentWidget(widgetsRef.current[userId]); } catch {}
    }
    widgetsRef.current[userId] = widget;
    editor.addContentWidget(widget);
    editor.layoutContentWidget(widget);
  };

  const clearRemoteCursor = (userId) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (decorationsRef.current[userId]) {
      editor.deltaDecorations(decorationsRef.current[userId], []);
      delete decorationsRef.current[userId];
    }
    if (widgetsRef.current[userId]) {
      try { editor.removeContentWidget(widgetsRef.current[userId]); } catch {}
      delete widgetsRef.current[userId];
    }
  };

  const clearAllRemoteCursors = () => {
    Object.keys(decorationsRef.current).forEach(clearRemoteCursor);
  };

  useEffect(() => {
    // User and room events
    socket.on("userJoined", (users) => setUsers(users));
    socket.on("codeUpdated", (newCode) => {
      setCode(newCode);
      setCurrentFileContent(newCode);
    });
    socket.on("userTyping", (user) => {
      setTyping(`${user.slice(0, 8)} is typing...`);
      setTimeout(() => setTyping(""), 3000);
    });
    socket.on("languageUpdated", (newLanguage) => {
      setLanguage(newLanguage);
      setCurrentFileLanguage(newLanguage);
    });
    socket.on("chatMessage", ({ userName, message }) =>
      setChatMessages((prev) => [...prev, { userName, message }])
    );
    
    // File management events
    socket.on("filesUpdated", ({ files: newFiles, activeFile: newActiveFile }) => {
      setFiles(newFiles);
      setActiveFile(newActiveFile);
      // Update current file content and language
      const currentFile = newFiles.find(f => f.filename === newActiveFile);
      if (currentFile) {
        setCurrentFileContent(currentFile.code);
        const detectedLang = detectFileType(currentFile.filename);
        setCurrentFileLanguage(detectedLang);
        setCode(currentFile.code);
        setLanguage(detectedLang);
        setFilename(currentFile.filename);
        console.log('[DEBUG] File switched:', currentFile.filename, 'Detected language:', detectedLang);
      }
    });

    socket.on("fileCreated", ({ file, createdBy }) => {
      setFiles(prev => [...prev, file]);
      setChatMessages((prev) => [...prev, { 
        userName: "System", 
        message: `File "${file.filename}" created by ${createdBy}` 
      }]);
    });

    socket.on("fileDeleted", ({ filename, deletedBy, newActiveFile }) => {
      setFiles(prev => prev.filter(f => f.filename !== filename));
      
      if (newActiveFile && newActiveFile !== activeFile) {
        setActiveFile(newActiveFile);
        // Request file content update
        socket.emit("switchFile", { roomId, filename: newActiveFile, switchedBy: userName });
      }
      
      setChatMessages((prev) => [...prev, { 
        userName: "System", 
        message: `File "${filename}" deleted by ${deletedBy}` 
      }]);
    });

    socket.on("fileRenamed", ({ oldFilename, newFilename, renamedBy }) => {
      setFiles(prev => prev.map(f => 
        f.filename === oldFilename 
          ? { ...f, filename: newFilename }
          : f
      ));
      
      if (activeFile === oldFilename) {
        setActiveFile(newFilename);
        setFilename(newFilename);
      }
      
      setChatMessages((prev) => [...prev, { 
        userName: "System", 
        message: `File renamed from "${oldFilename}" to "${newFilename}" by ${renamedBy}` 
      }]);
    });

    socket.on("activeFileChanged", ({ filename, file, switchedBy }) => {
      setActiveFile(filename);
      setCurrentFileContent(file.code);
      setCurrentFileLanguage(file.language);
      setCode(file.code);
      setLanguage(file.language);
      setFilename(filename);
      
      // Update files state to reflect active status
      setFiles(prev => prev.map(f => ({ 
        ...f, 
        isActive: f.filename === filename 
      })));
    });

    socket.on("fileCodeUpdated", ({ filename, code: newCode }) => {
      if (filename === activeFile) {
        setCurrentFileContent(newCode);
        setCode(newCode);
      }
      
      // Update the file in files array
      setFiles(prev => prev.map(f => 
        f.filename === filename 
          ? { ...f, code: newCode }
          : f
      ));
    });

    socket.on("fileLanguageUpdated", ({ filename, language: newLanguage }) => {
      if (filename === activeFile) {
        setCurrentFileLanguage(newLanguage);
        setLanguage(newLanguage);
      }
      
      // Update the file in files array
      setFiles(prev => prev.map(f => 
        f.filename === filename 
          ? { ...f, language: newLanguage }
          : f
      ));
    });

    // Version history events
    socket.on("versionAdded", (data) => setUndoRedoState(data.undoRedoState));
    socket.on("codeReverted", (data) => {
      setCode(data.code);
      setLanguage(data.language);
      setCurrentFileContent(data.code);
      setCurrentFileLanguage(data.language);
      setUndoRedoState(data.undoRedoState);
      setIsUndoing(false);
      setIsRedoing(false);

      console.log(
        `Code ${
          data.action === "undo"
            ? "undone"
            : data.action === "redo"
            ? "redone"
            : "reverted"
        } by ${data.performer}`
      );

      const actionText =
        data.action === "undo"
          ? "undone"
          : data.action === "redo"
          ? "redone"
          : "reverted";
      console.log(`Code ${actionText} by ${data.performer}`);
    });
    socket.on("undoRedoStateResponse", (response) => {
      if (response.success) setUndoRedoState(response.undoRedoState);
    });
    socket.on("checkpointCreated", (data) => {
      setIsCreatingCheckpoint(false);
      console.log(`Checkpoint created by ${data.performer}`);
    });
    socket.on("error", (error) => {
      console.error("Socket error:", error);
      if (error.type === "undo") setIsUndoing(false);
      if (error.type === "redo") setIsRedoing(false);
      if (error.type === "checkpoint") setIsCreatingCheckpoint(false);
      if (error.type === "createFile") alert(`Error creating file: ${error.message}`);
      if (error.type === "deleteFile") alert(`Error deleting file: ${error.message}`);
      if (error.type === "renameFile") alert(`Error renaming file: ${error.message}`);
      if (error.type === "switchFile") alert(`Error switching file: ${error.message}`);
    });
    
    // Legacy filename change event for backward compatibility
    socket.on("filenameChanged", ({ oldFilename, newFilename, userName: changedBy }) => {
      setFilename(newFilename);
      setChatMessages((prev) => [
        ...prev,
        { userName: "System", message: `Filename changed from "${oldFilename}" to "${newFilename}" by ${changedBy}` }
      ]);
    });

    // Cursor position events
    const onCursorPosition = (payload) => {
      if (payload.userId !== socket.id) {
        renderRemoteCursor(payload);
      }
    };
    
    const onCursorCleared = (payload) => {
      clearRemoteCursor(payload.userId);
    };

    socket.on('cursorPosition', onCursorPosition);
    socket.on('cursorCleared', onCursorCleared);

    return () => {
      socket.off();
    };
  }, [roomId, userName, activeFile]);

  useEffect(() => {
    const handleBeforeUnload = () => socket.emit("leaveRoom");
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const joinRoom = () => {
    if (!roomId || !userName)
      return alert("Please enter both Room Id and Your Name");
    localStorage.setItem("userName", userName); // <-- Add this line
    socket.emit("join_room", { roomId, userName });
    setJoined(true);

    setTimeout(() => {
      socket.emit("getUndoRedoState", { roomId });
    }, 1000);
  };

  const copyRoomId = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(roomId);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = roomId;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      toast({
        title: "Copied to Clipboard",
        description: `Room ID: ${roomId}`,
        duration: 2000,
      });
    } catch (err) {
      console.error('Failed to copy room ID:', err);
      toast({
        title: "Failed to Copy",
        description: "Unable to copy room ID to clipboard",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  // File management functions
  const handleFileCreate = (filename, createdBy, code = '', language = 'javascript') => {
    socket.emit("createFile", { 
      roomId, 
      filename, 
      createdBy, 
      code, 
      language 
    });
  };

  const handleFileDelete = (filename, deletedBy) => {
    socket.emit("deleteFile", { 
      roomId, 
      filename, 
      deletedBy 
    });
  };

  const handleFileRename = (oldFilename, newFilename) => {
    if (!newFilename || newFilename === oldFilename) return;
    
    socket.emit("renameFile", { 
      roomId, 
      oldFilename, 
      newFilename, 
      renamedBy: userName 
    });
  };

  const handleFileSwitch = (filename, switchedBy) => {
    if (filename === activeFile) return;
    
    socket.emit("switchFile", { 
      roomId, 
      filename, 
      switchedBy 
    });
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom");
    setJoined(false);
    setRoomId("");
    setUserName("");
    localStorage.removeItem("userName");
    setCode("// Welcome to the collaborative code editor\n// Start coding here...");
    setCurrentFileContent("// Welcome to the collaborative code editor\n// Start coding here...");
    setUsers([]);
    setTyping("");
    setLanguage("javascript");
    setCurrentFileLanguage("javascript");
    setFilename("untitled.js");
    setActiveFile("");
    setFiles([]);
    setShowAllLanguages(false);
    setChatMessages([]);
    setChatInput("");
    isInitialConnect.current = true; // Reset for the next connection
  };

  const handleChange = (newCode) => {
    const placeholderEl = document.querySelector('.monaco-placeholder');

    // use newCode instead of undefined "value"
    if (!newCode) {
      if (placeholderEl) placeholderEl.style.display = 'block';
    } else {
      if (placeholderEl) placeholderEl.style.display = 'none';
    }

    setCode(newCode);
    setCurrentFileContent(newCode);
    setHasUnsavedEdits(true);

    // clear existing timeout if any
    if (codeChangeTimeout) {
      window.clearTimeout(codeChangeTimeout);
    }

    const newTimeout = window.setTimeout(() => {
      // Use new file-specific code change event if active file exists
      if (activeFile) {
        socket.emit('fileCodeChange', { roomId, filename: activeFile, code: newCode });
      } else {
        // Fallback to legacy method
        socket.emit('codeChange', { roomId, code: newCode });
      }
      setHasUnsavedEdits(false);
    }, 500);

    setCodeChangeTimeout(newTimeout);

    // typing notification
    socket.emit('typing', { roomId, userName });
  };


  // Legacy filename change functions for backward compatibility
  const handleFilenameChange = (e) => {
    setPendingFilename(e.target.value);
  };

  const saveFilenameChange = () => {
    if (!pendingFilename || pendingFilename === filename) return;
    
    if (activeFile) {
      // Use new file rename functionality
      handleFileRename(activeFile, pendingFilename);
    } else {
      // Fallback to legacy method
      const oldFilename = filename;
      setFilename(pendingFilename);
      // Auto-detect language from filename
      const detectedLanguage = detectFileType(pendingFilename);
      if (detectedLanguage && detectedLanguage !== language && isLanguageSupported(detectedLanguage)) {
        setLanguage(detectedLanguage);
        setCurrentFileLanguage(detectedLanguage);
        socket.emit("languageChange", { roomId, language: detectedLanguage });
      }
      socket.emit("filenameChange", { roomId, oldFilename, newFilename: pendingFilename, userName });
    }
    setPendingFilename("");
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    setCurrentFileLanguage(newLanguage);
    
    // Use new file-specific language change event if active file exists
    if (activeFile) {
      socket.emit("fileLanguageChange", { roomId, filename: activeFile, language: newLanguage });
    } else {
      // Fallback to legacy method
      socket.emit("languageChange", { roomId, language: newLanguage });
    }
  };

  const handleManualLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    setCurrentFileLanguage(newLanguage);
    
    // Use new file-specific language change event if active file exists
    if (activeFile) {
      socket.emit("fileLanguageChange", { roomId, filename: activeFile, language: newLanguage });
    } else {
      // Fallback to legacy method
      socket.emit("languageChange", { roomId, language: newLanguage });
    }
    
    // Don't update filename automatically to avoid conflicts
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
      socket.emit("createCheckpoint", { roomId, code, language });
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
    setChatMessages((prev) => [...prev, newMessage]);
    // socket.emit("chatMessage", { roomId, ...newMessage });
    setChatInput("");
  };

  const handleChatDetach = (detached) => {
    setIsChatDetached(detached);
    if (!detached) {
      setIsChatMinimized(false); // Expand when bringing back
    }
  };

  const handleChatMinimize = (minimized) => {
    setIsChatMinimized(minimized);
  };

  const handleEditorOnMount = (editor, monaco) => {
    const placeholderEl = document.querySelector('.monaco-placeholder');
    if (placeholderEl) placeholderEl.style.display = 'block';
    editor.focus();

    // Debug: Log current language
    console.log('[DEBUG] Editor language:', editor.getModel().getLanguageId());

    // Register completion providers for all supported languages
    if (monaco.languages && monaco.languages.registerCompletionItemProvider) {
      const languageSuggestions = {
        javascript: [
          { label: 'for', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'for (let i = 0; i < arr.length; i++) {\n  // ...\n}', detail: 'JavaScript for loop' },
          { label: 'forEach', kind: monaco.languages.CompletionItemKind.Method, insertText: 'arr.forEach(item => {\n  // ...\n});', detail: 'JavaScript Array forEach' },
          { label: 'map', kind: monaco.languages.CompletionItemKind.Method, insertText: 'arr.map(item => item * 2);', detail: 'JavaScript Array map' },
          { label: 'filter', kind: monaco.languages.CompletionItemKind.Method, insertText: 'arr.filter(item => item > 0);', detail: 'JavaScript Array filter' },
          { label: 'reduce', kind: monaco.languages.CompletionItemKind.Method, insertText: 'arr.reduce((acc, item) => acc + item, 0);', detail: 'JavaScript Array reduce' },
          { label: 'async/await', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'async function fetchData() {\n  try {\n    const res = await fetch(url);\n    const data = await res.json();\n  } catch (e) {\n    // ...\n  }\n}', detail: 'JavaScript async/await' },
          { label: 'class', kind: monaco.languages.CompletionItemKind.Class, insertText: 'class MyClass {\n  constructor() {\n    // ...\n  }\n}', detail: 'JavaScript class' },
          { label: 'Promise', kind: monaco.languages.CompletionItemKind.Class, insertText: 'new Promise((resolve, reject) => {\n  // ...\n});', detail: 'JavaScript Promise' },
          { label: 'setTimeout', kind: monaco.languages.CompletionItemKind.Function, insertText: 'setTimeout(() => {\n  // ...\n}, 1000);', detail: 'JavaScript setTimeout' },
          { label: 'console.log', kind: monaco.languages.CompletionItemKind.Function, insertText: 'console.log()', detail: 'JavaScript log' },
        ],
        typescript: [
          { label: 'interface', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'interface Name {\n  // ...\n}', detail: 'TypeScript interface' },
          { label: 'type', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'type Name = {\n  // ...\n}', detail: 'TypeScript type' },
          { label: 'enum', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'enum MyEnum {\n  VALUE1,\n  VALUE2\n}', detail: 'TypeScript enum' },
          { label: 'generic', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'function identity<T>(arg: T): T {\n  return arg;\n}', detail: 'TypeScript generic function' },
        ],
        python: [
          { label: 'for', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'for i in range(n):\n    # ...', detail: 'Python for loop' },
          { label: 'while', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'while condition:\n    # ...', detail: 'Python while loop' },
          { label: 'def', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'def function_name(params):\n    # ...', detail: 'Python function' },
          { label: 'class', kind: monaco.languages.CompletionItemKind.Class, insertText: 'class MyClass:\n    def __init__(self):\n        pass', detail: 'Python class' },
          { label: 'list comprehension', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '[x for x in iterable]', detail: 'Python list comprehension' },
          { label: 'lambda', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'lambda x: x * 2', detail: 'Python lambda' },
          { label: 'import', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'import module', detail: 'Python import' },
          { label: 'print', kind: monaco.languages.CompletionItemKind.Function, insertText: 'print()', detail: 'Python print' },
        ],
        java: [
          { label: 'for', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'for (int i = 0; i < n; i++) {\n    // ...\n}', detail: 'Java for loop' },
          { label: 'while', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'while (condition) {\n    // ...\n}', detail: 'Java while loop' },
          { label: 'public static void main', kind: monaco.languages.CompletionItemKind.Function, insertText: 'public static void main(String[] args) {\n    // ...\n}', detail: 'Java main method' },
          { label: 'System.out.println', kind: monaco.languages.CompletionItemKind.Function, insertText: 'System.out.println()', detail: 'Java print' },
          { label: 'ArrayList', kind: monaco.languages.CompletionItemKind.Class, insertText: 'ArrayList<Type> list = new ArrayList<>();', detail: 'Java ArrayList' },
          { label: 'HashMap', kind: monaco.languages.CompletionItemKind.Class, insertText: 'HashMap<Key, Value> map = new HashMap<>();', detail: 'Java HashMap' },
        ],
        c: [
          { label: 'for', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'for (int i = 0; i < n; i++) {\n    // ...\n}', detail: 'C for loop' },
          { label: 'while', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'while (condition) {\n    // ...\n}', detail: 'C while loop' },
          { label: 'printf', kind: monaco.languages.CompletionItemKind.Function, insertText: 'printf("%d", value);', detail: 'C printf' },
          { label: 'struct', kind: monaco.languages.CompletionItemKind.Class, insertText: 'struct MyStruct {\n    int a;\n    float b;\n};', detail: 'C struct' },
          { label: 'typedef', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'typedef int myint;', detail: 'C typedef' },
        ],
        cpp: [
          { label: '#include', kind: monaco.languages.CompletionItemKind.Keyword, insertText: '#include <iostream>', detail: 'C++ include directive' },
          { label: 'for', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'for (int i = 0; i < n; ++i) {\n    // ...\n}', detail: 'C++ for loop' },
          { label: 'while', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'while (condition) {\n    // ...\n}', detail: 'C++ while loop' },
          { label: 'vector', kind: monaco.languages.CompletionItemKind.Class, insertText: 'std::vector<int> v;', detail: 'C++ STL vector' },
          { label: 'map', kind: monaco.languages.CompletionItemKind.Class, insertText: 'std::map<int, int> m;', detail: 'C++ STL map' },
          { label: 'set', kind: monaco.languages.CompletionItemKind.Class, insertText: 'std::set<int> s;', detail: 'C++ STL set' },
          { label: 'unordered_map', kind: monaco.languages.CompletionItemKind.Class, insertText: 'std::unordered_map<int, int> um;', detail: 'C++ STL unordered_map' },
          { label: 'class', kind: monaco.languages.CompletionItemKind.Class, insertText: 'class MyClass {\npublic:\n    MyClass() {}\n};', detail: 'C++ class' },
          { label: 'template', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'template <typename T>\nT add(T a, T b) {\n    return a + b;\n}', detail: 'C++ template function' },
        ],
        html: [
          { label: 'div', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '<div>\n  <!-- ... -->\n</div>', detail: 'HTML div' },
          { label: 'span', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '<span>\n  <!-- ... -->\n</span>', detail: 'HTML span' },
          { label: 'form', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '<form>\n  <input type="text" />\n</form>', detail: 'HTML form' },
          { label: 'img', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '<img src="" alt="" />', detail: 'HTML image' },
        ],
        css: [
          { label: 'display', kind: monaco.languages.CompletionItemKind.Property, insertText: 'display: flex;', detail: 'CSS display property' },
          { label: 'color', kind: monaco.languages.CompletionItemKind.Property, insertText: 'color: #000;', detail: 'CSS color property' },
          { label: 'margin', kind: monaco.languages.CompletionItemKind.Property, insertText: 'margin: 0;', detail: 'CSS margin property' },
          { label: 'padding', kind: monaco.languages.CompletionItemKind.Property, insertText: 'padding: 0;', detail: 'CSS padding property' },
        ],
        json: [
          { label: 'key', kind: monaco.languages.CompletionItemKind.Property, insertText: '"key": "value"', detail: 'JSON key-value' },
          { label: 'array', kind: monaco.languages.CompletionItemKind.Property, insertText: '"items": [1, 2, 3]', detail: 'JSON array' },
        ],
        markdown: [
          { label: 'header', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '# Header', detail: 'Markdown header' },
          { label: 'list', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '- item', detail: 'Markdown list' },
          { label: 'code', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '```js\nconsole.log("Hello World");\n```', detail: 'Markdown code block' },
        ],
        sql: [
          { label: 'SELECT', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'SELECT * FROM table;', detail: 'SQL SELECT' },
          { label: 'INSERT', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'INSERT INTO table VALUES (...);', detail: 'SQL INSERT' },
          { label: 'JOIN', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'SELECT * FROM table1 JOIN table2 ON table1.id = table2.id;', detail: 'SQL JOIN' },
        ],
        // Add more languages and suggestions as needed
      };

      Object.keys(languageSuggestions).forEach(lang => {
        monaco.languages.registerCompletionItemProvider(lang, {
          provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            console.log(`[DEBUG] Completion requested for word:`, word, 'in language:', lang);
            const suggestions = languageSuggestions[lang] || [];
            console.log('[DEBUG] Suggestions returned:', suggestions);
            return { suggestions };
          }
        });
      });
    } else {
      console.log('[DEBUG] Monaco completion provider API not available');
    }
  };

   const handleJoinFromLanding = (newRoomId, newUserName) => {
    setRoomId(newRoomId);
    setUserName(newUserName);
    localStorage.setItem("userName", newUserName);
    socket.emit("join_room", { roomId: newRoomId, userName: newUserName });
    setJoined(true);

    // Request initial undo/redo state after joining
    setTimeout(() => {
      socket.emit("getUndoRedoState", { roomId: newRoomId });
    }, 1000);
  };

  if (!joined) {
    return(
      <div>
        <LandingPage onJoinRoom={handleJoinFromLanding} /> 
        <BackToTop />
      </div>
    );
  }

    return (
          <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {/* Reconnecting indicator */}
        {!isConnected && (
          <div className="reconnecting-overlay">
            Reconnecting…
          </div>
        )}
    <>
      <ResizableLayout
        sidebar={
          <div className="sidebar">
            <button onClick={toggleTheme} className="theme-toggle-btn">
              {theme === "light" ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>
            <div className="room-info">
              <h2>Code Room: {roomId}</h2>
              <button 
                className="copy-room-id-btn"
                onClick={copyRoomId}
                title="Copy Room ID to clipboard"
              >
                <span className="copy-icon">📋</span>
                <span className="copy-text">Copy ID</span>
              </button>
            </div>
            <h3>
              Users in Room: <span style={{ fontWeight: "bold", color: "#2563eb" }}>{users.length}</span>
            </h3>
            <ul>
              {users.map((user, index) => (
                <li key={index}>{user.slice(0, 8)}</li>
              ))}
            </ul>
            <p className="typing-indicator">{typing}</p>
            
            {/* File Explorer Component */}
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
                <label htmlFor="filename">Active File:</label>
                <input
                  id="filename"
                  type="text"
                  className="filename-input"
                  value={pendingFilename || filename}
                  onChange={handleFilenameChange}
                  placeholder="e.g., main.js, script.py"
                />
                <button onClick={saveFilenameChange} className="save-filename-btn">Rename</button>
              </div>

              <div className="language-selector-group">
                <label htmlFor="language">Language:</label>
                <select
                  id="language"
                  className="language-selector"
                  value={language}
                  onChange={handleManualLanguageChange}
                >
                  <optgroup label="Popular Languages">
                    {getPopularLanguages().map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.name}
                      </option>
                    ))}
                  </optgroup>
                  {showAllLanguages && (
                    <optgroup label="All Languages">
                      {getAllSupportedLanguages()
                        .filter(lang => !getPopularLanguages().some(popular => popular.id === lang.id))
                        .map((lang) => (
                          <option key={lang.id} value={lang.id}>
                            {lang.name}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
                <button 
                  type="button"
                  className="show-all-languages-btn"
                  onClick={() => setShowAllLanguages(!showAllLanguages)}
                >
                  {showAllLanguages ? "Show Less" : "Show All"}
                </button>
              </div>
              
              <div className="language-info">
                <small>
                  Current: <strong>{getLanguageDisplayName(language)}</strong>
                </small>
              </div>
            </div>
            <button className="leave-button" onClick={leaveRoom}>
              Leave Room
            </button>

            <div className="version-controls">
              <h3>Version History</h3>
              <div className="version-buttons">
                <button
                  className={`version-btn undo-btn ${
                    !undoRedoState.canUndo || isUndoing ? "disabled" : ""
                  } ${isUndoing ? "loading" : ""}`}
                  onClick={handleUndo}
                  disabled={!undoRedoState.canUndo || isUndoing}
                  title="Undo (Ctrl+Z)"
                >
                  {isUndoing ? "Undoing..." : "Undo"}
                </button>
                <button
                  className={`version-btn redo-btn ${
                    !undoRedoState.canRedo || isRedoing ? "disabled" : ""
                  } ${isRedoing ? "loading" : ""}`}
                  onClick={handleRedo}
                  disabled={!undoRedoState.canRedo || isRedoing}
                  title="Redo (Ctrl+Y)"
                >
                  {isRedoing ? "Redoing..." : "Redo"}
                </button>
              </div>
              <div className="version-info">
                <span className="version-count">
                  {undoRedoState.currentVersionIndex + 1} /{" "}
                  {undoRedoState.totalVersions}
                </span>
              </div>
              <button
                className="version-btn history-btn"
                onClick={() => setShowVersionHistory(true)}
                title="View version history"
              >
                History
              </button>
              <button
                className={`version-btn checkpoint-btn ${
                  isCreatingCheckpoint ? "loading" : ""
                }`}
                onClick={createCheckpoint}
                disabled={isCreatingCheckpoint}
                title="Create checkpoint"
              >
                {isCreatingCheckpoint ? "Creating..." : "Checkpoint"}
              </button>
            </div>
          </div>
        }
        editor={
          <div className="editor-wrapper">
            <div className="editor-header">
              <span className="current-file-indicator">
                📄 {activeFile || filename} 
                {activeFile && (
                  <span className="file-language-badge">
                    {getLanguageDisplayName(currentFileLanguage)}
                  </span>
                )}
              </span>
            </div>
            <div style={{ position: "relative", height: "calc(100% - 40px)" }}>
            
            {/* Changed from defaultLanguage to language */}
             {/* Defaultlanguage prop only sets the language when the editor first loads and doesn't update it afterward. */}
            <Editor
              height="100%"
              language={currentFileLanguage} 
              value={currentFileContent || code} 
              onChange={handleChange}
              onMount={handleEditorOnMount}
              theme={theme === "dark" ? "vs-dark" : "vs-light"}
              options={{
                minimap:{ enabled: false },
                fontSize: 14,
              }}
            />
            {!(currentFileContent || code) && (
              <div
                className={`absolute top-0 left-[74px] text-sm pointer-events-none ${
                  theme === "dark" ? "text-gray-400" : "text-gray-500"
                }`}
              >
                start typing here...
              </div>
            )}
          </div>

            <VideoCall
              socket={socket}
              roomId={roomId}
              userName={userName}
              joined={joined}
            />
          </div>
        }
        chatPanel={
          <div className="chat-panel-content">
            <div className="chat-messages" ref={messagesEndRef} style={{ overflowY: "auto", maxHeight: "100%" }}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} className="chat-message">
                  <span className="chat-user">{msg.userName.slice(0, 8)}:</span>{" "}
                  {msg.message}
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
              <button type="submit" className="chat-send-btn">
                Send
              </button>
            </form>
          </div>
        }
        onChatDetach={handleChatDetach}
        isChatDetached={isChatDetached}
        onChatMinimize={handleChatMinimize}
        isChatMinimized={isChatMinimized}
        chatMessages={chatMessages}
        chatInput={chatInput}
        setChatInput={setChatInput}
        sendChatMessage={sendChatMessage}
        socket={socket}
        roomId={roomId}
        userName={userName}
      />
      
      {/* Detached Chat Window */}
      {isChatDetached && (
        <ChatWindow
          chatMessages={chatMessages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          sendChatMessage={sendChatMessage}
          onClose={() => setIsChatDetached(false)}
        />
      )}

      {/* Version History Modal */}
      <VersionHistory
        socket={socket}
        roomId={roomId}
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
      />
    </>
          </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
