import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

 
import App from './App.tsx' 

import { createEvent as effCreateEvent } from "effector";

export function createEvent<T>(name?: string) {
  const ev = effCreateEvent<T>(name);
  ev.watch((payload) => {
    console.log("⚡", name ?? "event", payload);
  });
  return ev;
}

 

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
