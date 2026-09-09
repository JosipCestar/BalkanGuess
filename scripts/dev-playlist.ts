import { spawn } from "node:child_process";
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3001"], { stdio: "inherit", env: { ...process.env, PLAYLIST_DEV: "1" }, windowsHide: true });
child.on("exit", code => { process.exitCode = code ?? 1; });
