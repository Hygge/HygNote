import { useEffect, useState } from "react";
import { Cursor } from "animal-island-ui";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { MainWindow } from "./windows/MainWindow";
import { FloatWindow } from "./windows/FloatWindow";
import { applyTheme, readThemeId } from "./lib/theme";
import "./App.css";

function App() {
  const [windowLabel, setWindowLabel] = useState<string>("");

  useEffect(() => {
    applyTheme(readThemeId());
    const label = getCurrentWebviewWindow().label;
    setWindowLabel(label);
  }, []);

  if (windowLabel === "float") {
    return (
      <Cursor forceAll={false}>
        <FloatWindow />
      </Cursor>
    );
  }

  return (
    <Cursor forceAll={false}>
      <MainWindow />
    </Cursor>
  );
}

export default App;
