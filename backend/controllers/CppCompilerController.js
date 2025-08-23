import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

// POST /api/compile-cpp
// Body: { code: "...C++ code..." }
export default function(app) {
  app.post('/api/compile-cpp', (req, res) => {
    const code = req.body.code;
    if (!code) return res.status(400).json({ error: 'No code provided' });

    // Create temp file
    const tempDir = path.join(path.resolve(), 'tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const filename = `main_${Date.now()}.cpp`;
    const filepath = path.join(tempDir, filename);
    fs.writeFileSync(filepath, code);

    const outputExe = filepath.replace('.cpp', '.exe');
    const compileCmd = `g++ "${filepath}" -o "${outputExe}"`;

    exec(compileCmd, (err, stdout, stderr) => {
      if (err || stderr) {
        // Compilation error
        fs.unlinkSync(filepath);
        return res.json({ output: stderr || err.message });
      }
      // Run the executable
      exec(`"${outputExe}"`, { timeout: 5000 }, (runErr, runStdout, runStderr) => {
        // Clean up
        fs.unlinkSync(filepath);
        fs.unlinkSync(outputExe);
        if (runErr) {
          return res.json({ output: runStderr || runErr.message });
        }
        res.json({ output: runStdout });
      });
    });
  });
}
