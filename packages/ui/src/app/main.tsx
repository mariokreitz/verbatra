import { createRoot } from "react-dom/client";

function App() {
  return <div>Verbatra Studio</div>;
}

const container = document.getElementById("root");
if (container !== null) {
  createRoot(container).render(<App />);
}
