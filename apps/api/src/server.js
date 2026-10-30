import express from "express";
import cors from "cors";
import terminalRoutes from "./routes/terminal.routes.js";

const app = express();
const PORT = 3000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", app: "Haunted Terminal API" });
});

app.use("/api/terminal", terminalRoutes);

app.listen(PORT, () => {
  console.log(`👻 Haunted Terminal API: http://localhost:${PORT}`);
});