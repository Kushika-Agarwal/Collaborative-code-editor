import { useState } from "react";
import CompilerOutput from "./CompilerOutput";

const CppCompiler = ({ code, theme = "dark" }) => {
  const [cppOutput, setCppOutput] = useState("");
  const [cppLoading, setCppLoading] = useState(false);

  const handleRunCpp = async () => {
    setCppLoading(true);
    setCppOutput("");
    try {
      const res = await fetch("http://localhost:3000/api/compile-cpp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      setCppOutput(data.output || "No output");
    } catch (err) {
      setCppOutput("Error connecting to compiler API");
    }
    setCppLoading(false);
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
        C++ Online Compiler
      </h2>
      <button
        onClick={handleRunCpp}
        disabled={cppLoading}
        style={{
          padding: "8px 20px",
          fontSize: 16,
          background: "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          marginBottom: 12,
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}
      >
        {cppLoading ? "Running..." : "Run C++"}
      </button>
      <CompilerOutput
        output={cppOutput}
        error={cppOutput && cppOutput.toLowerCase().includes("error") ? cppOutput : ""}
        isLoading={cppLoading}
      />
    </div>
  );
};

export default CppCompiler;
