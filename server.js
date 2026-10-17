
require("dotenv").config();

const express = require("express");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20kb" }));

const publicDirectory = path.join(__dirname, "public");
app.use(express.static(publicDirectory));

app.get("/api/status", (req, res) => {
  res.json({
    app: "Maya AI",
    status: "online",
    aiConfigured: Boolean(process.env.OPENAI_API_KEY)
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const message = req.body?.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Please provide a message."
      });
    }

    if (message.length > 8000) {
      return res.status(413).json({
        error: "Message is too long. Please shorten it."
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: "AI is not configured. Add OPENAI_API_KEY to your server environment."
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const model = process.env.OPENAI_MODEL;

    if (!model) {
      return res.status(503).json({
        error: "Set OPENAI_MODEL to a model available to your API account."
      });
    }

    const response = await client.responses.create({
      model,
      instructions:
        "You are Maya, a helpful, friendly AI assistant. " +
        "Answer clearly and honestly. Never claim you performed a phone action, " +
        "sent a message, made a call, or changed a setting unless a connected " +
        "tool actually confirmed that action. Explain limitations when necessary.",
      input: message.trim(),
      tools: [{ type: "web_search" }]
    });

    res.json({
      reply: response.output_text || "Sorry, I couldn't generate a reply."
    });
  } catch (error) {
    console.error("Maya AI error:", error.message);

    res.status(500).json({
      error: "Maya couldn't complete that request. Check your API configuration and server logs."
    });
  }
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found." });
  }

  res.sendFile(path.join(publicDirectory, "index.html"), error => {
    if (error) next(error);
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Maya AI server running on port ${PORT}`);
});
