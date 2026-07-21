import { ClipboardWindow } from "./pages/ClipboardWindow";
import { CaptureTool } from "./pages/CaptureTool";

export default function App() {
  const tool = new URLSearchParams(window.location.search).get("tool");
  if (tool === "capture" || tool === "color") return <CaptureTool tool={tool} />;
  return <ClipboardWindow />;
}
