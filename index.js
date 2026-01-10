const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("OK en producción 🚀"));

app.listen(3000, () => console.log("Server on http://localhost:3000"));