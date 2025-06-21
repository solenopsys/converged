 
 

// Простой компонент
const Hello = ({ name }: { name: string }) => (
  <>
    <h1>Hello, {name}!</h1>
  </>
);

// Рендерим компонент в DOM
import { createRoot } from "react-dom/client";

const root = createRoot(document.getElementById("root")!);
root.render(<Hello name="Bun" />);
