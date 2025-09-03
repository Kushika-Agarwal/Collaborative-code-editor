import { useState } from "react";
import CompilerOutput from "./CompilerOutput";

const CSharpCompiler = ({ code, theme = "dark" }) => {
  const [csOutput, setCsOutput] = useState("");
  const [csLoading, setCsLoading] = useState(false);

  const handleRunCSharp = async () => {
    setCsLoading(true);
    setCsOutput("");
    try {
      const res = await fetch("http://localhost:3000/api/compile-csharp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      setCsOutput(data.output || "No output");
    } catch (err) {
      setCsOutput("Error connecting to C# compiler API");
    }
    setCsLoading(false);
  };

  return (
    <div
      style={{
        margin: "1rem 0",
        padding: "1rem",
        background: theme === "dark" ? "#18181b" : "#f3f4f6",
        borderRadius: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
        maxWidth: 700,
        width: "100%",
      }}
    >
      <h2 style={{ color: theme === "dark" ? "#fff" : "#222", marginTop: 0, marginBottom: 8 }}>
        C# Online Compiler
      </h2>
      <button
        onClick={handleRunCSharp}
        disabled={csLoading}
        style={{
          padding: "8px 20px",
          fontSize: 16,
          background: "#9333ea",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          marginBottom: 12,
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}
      >
        {csLoading ? "Running..." : "Run C#"}
      </button>
      <CompilerOutput
        output={csOutput}
        error={csOutput && csOutput.toLowerCase().includes("error") ? csOutput : ""}
        isLoading={csLoading}
      />
    </div>
  );
};

export default CSharpCompiler;
