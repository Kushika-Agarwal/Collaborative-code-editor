import React from "react";

const CompilerOutput = ({ output, error, isLoading }) => (
  <div style={{
    background: "#18181b",
    color: "#e5e7eb",
    borderRadius: 8,
    padding: "12px 16px",
    marginTop: 8,
    minHeight: 80,
    fontFamily: "monospace",
    fontSize: 14,
    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
    maxWidth: 600,
    width: "100%",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    border: error ? "2px solid #ef4444" : "2px solid #2563eb"
  }}>
    {isLoading && <span style={{ color: "#38bdf8" }}>Compiling...</span>}
    {!isLoading && error && (
      <span style={{ color: "#ef4444" }}>{error}</span>
    )}
    {!isLoading && !error && output && (
      <span style={{ color: "#22c55e" }}>{output}</span>
    )}
    {!isLoading && !error && !output && (
      <span style={{ color: "#888" }}>No output.</span>
    )}
  </div>
);

export default CompilerOutput;
