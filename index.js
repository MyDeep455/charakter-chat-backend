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
    // Sicherheitsabfrage, ob der Key überhaupt geladen wurde.
    if (!API_KEY) {
        console.error("FEHLER: OPENROUTER_API_KEY nicht auf dem Server gefunden!");
        return res.status(500).json({ error: "API-Key ist auf dem Server nicht konfiguriert." });
    }

    try {
        const { character, chatHistory, userMessage, temperature = 0.7 } = req.body;

        if (!character || typeof userMessage === 'undefined') {
            return res.status(400).json({ error: "Charakter-Daten und eine Nachricht sind erforderlich." });
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
                model: "deepseek/deepseek-r1-0528:free",
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
        console.error("Fehler beim Verarbeiten der Anfrage:", error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

app.listen(3000, "0.0.0.0", () => {
    console.log(`Server läuft auf Port 3000 und ist bereit für Verbindungen.`);
});