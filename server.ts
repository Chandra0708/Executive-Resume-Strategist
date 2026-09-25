import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fetch from "node-fetch";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY is not defined in the environment. AI features will fail.");
  }
  const ai = new GoogleGenAI({ 
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Proxy route to fetch HTML for JD extraction
  app.post("/api/fetch-html", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
      if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
      const html = await response.text();
      res.json({ html });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch content" });
    }
  });

  // AI Routes
  app.post("/api/ai/:action", async (req, res) => {
    const { action } = req.params;
    const { prompt, config, contents } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server. Please add it to Settings > Secrets." });
    }

    const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.8-flash"];
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const mergedConfig: any = {
          ...config,
        };

        // For gemini-3.8-flash, explicitly minimize thinking latency
        if (model === "gemini-3.8-flash") {
          mergedConfig.thinkingConfig = {
            thinkingLevel: ThinkingLevel.LOW,
            ...(config?.thinkingConfig || {})
          };
        }

        const response = await ai.models.generateContent({
          model, 
          contents: prompt || contents,
          config: mergedConfig
        });

        if (response.text) {
          return res.json({ text: response.text });
        }
      } catch (error: any) {
        lastError = error;
        console.warn(`Model ${model} failed for action ${action}:`, error.message || error);
        const errorMessage = error.message || "";
        // If API key is invalid or permission denied, no need to retry other models
        if (errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("PERMISSION_DENIED")) {
          return res.status(error.status || 400).json({ 
            error: "API key not valid or permission denied. Please check your Gemini API key in Settings > Secrets." 
          });
        }
        // Otherwise continue to next candidate model
      }
    }

    console.error(`All models failed for AI ${action}:`, lastError);
    res.status(500).json({ error: lastError?.message || "Failed to generate content from AI model." });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
