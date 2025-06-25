import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import "dotenv/config";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const PROXY_API_URL = "https://llm.chutes.ai/v1/chat/completions";
const API_KEY = process.env.DEEPSEEK_API_KEY;

app.post("/chat", async (req, res) => {
    try {
        const {
            character,
            chatHistory,
            userMessage,
            temperature = 0.7,
        } = req.body;

        if (!character || typeof userMessage === "undefined") {
            return res.status(400).json({
                error: "Charakter-Daten und eine Nachricht (kann leer sein) sind erforderlich.",
            });
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
                Authorization: `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
                model: "deepseek-ai/DeepSeek-R1-0528",
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


// --- START: NEUER CODE-BLOCK FÜR DIE TITEL-GENERIERUNG ---

app.post('/generate-title', async (req, res) => {
  const { chatHistory } = req.body;

  if (!chatHistory || chatHistory.length === 0) {
    return res.status(400).send('Chat-Verlauf fehlt.');
  }

  // Kombiniere die Nachrichten zu einem einzigen Textblock für die KI
  const conversationText = chatHistory.map(msg => `${msg.sender}: ${msg.main}`).join('\n');

  try {
    // Wir nutzen hier deine bestehenden Variablen PROXY_API_URL und API_KEY
    const deepseekResponse = await fetch(PROXY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-R1-0528", // Wir nutzen dasselbe Modell wie für den Chat
        messages: [
          {
            "role": "system",
            "content": "Du bist ein hilfreicher Assistent, der einen Chatverlauf analysiert und einen kurzen, prägnanten, thematischen Titel dafür generiert. Antworte NUR mit dem Titel und nichts anderem. Der Titel soll auf Deutsch sein. Füge keine Anführungszeichen hinzu."
          },
          {
            "role": "user",
            "content": conversationText
          }
        ],
        max_tokens: 20,
        temperature: 0.5,
        stream: false // WICHTIG: Kein Stream, wir wollen eine einzige Antwort
      })
    });

    if (!deepseekResponse.ok) {
      throw new Error(`API Fehler bei Titel-Generierung: ${deepseekResponse.statusText}`);
    }

    const data = await deepseekResponse.json();
    const title = data.choices[0].message.content.trim();
    
    // Sende nur den reinen Titel an das Frontend zurück
    res.status(200).json({ title: title });

  } catch (error) {
    console.error("Fehler bei der Titel-Generierung:", error);
    res.status(500).send("Fehler auf dem Server bei der Titel-Generierung.");
  }
});

// --- ENDE: NEUER CODE-BLOCK ---


app.listen(3000, "0.0.0.0", () => {
    console.log(`Server läuft auf Port 3000 und ist bereit für Verbindungen.`);
});