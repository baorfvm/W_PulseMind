import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/plus-jakarta-sans";
import "@/styles/globals.css";
import DemoOne from "@/demo";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DemoOne />
  </StrictMode>,
);
