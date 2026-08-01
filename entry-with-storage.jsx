import "./storage-polyfill.js";
import React from "react";
import { createRoot } from "react-dom/client";
import QuietCoup from "./QuietCoup.jsx";

const root = createRoot(document.getElementById("root"));
root.render(<QuietCoup />);
