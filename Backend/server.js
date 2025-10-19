// server.js
import express from "express";
const app = express();
app.get("/", (req, res) => res.send("Backend running locally!"));
app.listen(5000, () => console.log("Server running on port 5000"));
