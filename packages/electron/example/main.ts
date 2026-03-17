import { app, BrowserWindow } from "electron";
import * as path from "node:path";
import { SzElectronMain } from "../src/main";

const senzingPath = process.env.SENZING_PATH || "/opt/senzing";
const libDir = process.env.LD_LIBRARY_PATH || `${senzingPath}/lib`;

const sz = new SzElectronMain({
  workerPath: path.join(__dirname, "../src/main/worker.js"),
  workerEnv: {
    LD_LIBRARY_PATH: libDir,
    DYLD_LIBRARY_PATH: libDir,
  },
});

app.whenReady().then(() => {
  sz.setup();

  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "index.html"));
});

app.on("window-all-closed", async () => {
  await sz.teardown();
  app.quit();
});
