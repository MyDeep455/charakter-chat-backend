import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import "dotenv/config";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const PROXY_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const API_KEY = process.env.OPENROUTER_API_KEY;

app.post("/chat", async (req, res) => {
    // Security query as to whether the key has been loaded at all.
    if (!API_KEY) {
        console.error("ERROR: OPENROUTER_API_KEY not found on the server!");
        return res.status(500).json({ error: "API key is not configured on the server." });
    }

    try {
        const { character, chatHistory, userMessage, temperature = 0.7, modelName } = req.body;

        if (!character || typeof userMessage === 'undefined') {
            return res.status(400).json({ error: "Character data and a message are required." });
        }

        const messages = [
            { role: "system", content: character.description },
            ...chatHistory
                .filter((msg) => msg.main)
                .map((msg) => ({
                    role: msg.sender === "ai" ? "assistant" : "user",
                    content: msg.main,
                })),
            { role: "user", content: userMessage },
        ];

        const apiResponse = await fetch(PROXY_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`,
                "HTTP-Referer": "https://charakter-chat-backend.onrender.com", 
                "X-Title": "AI Charakter-Chat App",
            },
            body: JSON.stringify({
                //If for some reason no model name is transmitted, the model below is the fallback option.
                model: modelName || "deepseek/deepseek-r1-0528:free",
                messages: messages,
                temperature: parseFloat(temperature),
                stream: true,
            }),
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error("Proxy API Error:", errorText);
            res.status(apiResponse.status).end(errorText);
            return;
        }

        res.setHeader("Content-Type", "text/event-stream");
        apiResponse.body.pipe(res);
    } catch (error) {
        console.error("Error processing the request:", error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

app.listen(3000, "0.0.0.0", () => {
    console.log(`Server is running on port 3000 and is ready for connections.`);
});