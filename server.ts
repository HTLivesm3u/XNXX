import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes
  app.get("/api/channels", async (req, res) => {
    try {
      const m3uUrl = "https://spoo.me/XNXx";
      const response = await axios.get(m3uUrl);
      const m3uContent = response.data;

      const channels = parseM3U(m3uContent);
      res.json(channels);
    } catch (error) {
      console.error("Error fetching M3U:", error);
      res.status(500).json({ error: "Failed to fetch channels" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

function parseM3U(content: string) {
  const lines = content.split("\n");
  const channels: any[] = [];
  let currentChannel: any = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("#EXTINF:")) {
      // Parse EXTINF
      const info = line.substring(8);
      const logoMatch = info.match(/tvg-logo="([^"]+)"/);
      const groupMatch = info.match(/group-title="([^"]+)"/);
      const nameMatch = info.match(/,(.*)$/);

      currentChannel.logo = logoMatch ? logoMatch[1] : "";
      currentChannel.group = groupMatch ? groupMatch[1] : "General";
      currentChannel.name = nameMatch ? nameMatch[1].trim() : "Unknown Channel";
    } else if (line.startsWith("#KODIPROP:inputstream.adaptive.license_key=")) {
      const key = line.split("=")[1];
      if (key.includes(":")) {
        // ClearKey
        const [kid, k] = key.split(":");
        currentChannel.clearKey = { [kid]: k };
      } else if (key.startsWith("http")) {
        // Widevine URL
        currentChannel.widevineUrl = key;
      }
    } else if (line.startsWith("#EXTHTTP:")) {
      try {
        const headersJson = line.substring(9);
        currentChannel.headers = JSON.parse(headersJson);
      } catch (e) {
        console.error("Error parsing EXTHTTP headers", e);
      }
    } else if (line.startsWith("#EXTVLCOPT:http-user-agent=")) {
      const ua = line.split("=")[1];
      currentChannel.headers = currentChannel.headers || {};
      currentChannel.headers["User-Agent"] = ua;
    } else if (line.startsWith("http")) {
      currentChannel.url = line;
      // If we have a URL, it's the end of a channel entry
      if (currentChannel.url) {
        if (!currentChannel.name) {
          // Try to get name from URL or just use index
          const urlParts = line.split("/");
          const fileName = urlParts[urlParts.length - 1];
          currentChannel.name = fileName.split(".")[0] || `Channel ${channels.length + 1}`;
        }
        channels.push({ ...currentChannel, id: channels.length });
      }
      currentChannel = {};
    }
  }

  return channels;
}

startServer();
