import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

export default function CSharpCompilerController(router) {
  router.post('/api/compile-csharp', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'No code provided.' });

    // Save code to a temporary .cs file
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const fileName = `temp_${Date.now()}.cs`;
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, code);

    // Compile and run using csc (C# compiler must be installed)
    const exePath = filePath.replace(/\.cs$/, '.exe');
    const compileCmd = `csc "${filePath}"`;
    const runCmd = `"${exePath}"`;

    exec(compileCmd, (compileErr, compileStdout, compileStderr) => {
      if (compileErr || compileStderr) {
        fs.unlinkSync(filePath);
        return res.json({ output: compileStderr || compileErr.message });
      }
      exec(runCmd, (runErr, runStdout, runStderr) => {
        fs.unlinkSync(filePath);
        if (fs.existsSync(exePath)) fs.unlinkSync(exePath);
        if (runErr || runStderr) {
          return res.json({ output: runStderr || runErr.message });
        }
        return res.json({ output: runStdout });
      });
    });
  });
}
