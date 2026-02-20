import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import SidePanel from "./components/sidepanel/SidePanel";
import "./components/sidepanel/SidePanel.css";

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>,
);
