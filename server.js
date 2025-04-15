const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

const { OpenAI } = require("openai");
const { wrapOpenAI } = require("langsmith/wrappers");
const { traceable } = require("langsmith/traceable");

const {
  availableFunctions,
  formatForecast,
  getCoordinatesTool,
  getWeatherTool,
} = require("./tools/weather");

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Configure OpenAI with Ollama base URL
const openai = wrapOpenAI(
  new OpenAI({
    baseURL: "http://localhost:11434/v1", // Ollama OpenAI-compatible endpoint
    apiKey: "ollama", // Can be any non-empty string
  })
);

// Route to serve the chat interface
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Route to get available models from Ollama
app.get("/models", async (req, res) => {
  try {
    // Using native fetch for Ollama's native API since model list isn't in OpenAI format
    const response = await fetch("http://localhost:11434/api/tags");
    const data = await response.json();
    res.json(data.models || []);
  } catch (error) {
    console.error("Error fetching models:", error);
    res.status(500).json({ error: "Failed to fetch models" });
  }
});

const tracedChatCompletion = traceable(
  openai.chat.completions.create.bind(openai.chat.completions)
);

// Route to handle chat requests via OpenAI-compatible API
app.post("/chat", async (req, res) => {
  const { message, model = "llama3.2" } = req.body;
  const messages = [
    {
      role: "system",
      content: `You are a helpful travel planner assistant that returns the result in markdown format.
  
  Your goal is to generate personalized travel itineraries by extracting key details from the user such as:
  - Destination(s)
  - Travel budget (total or per day)
  - Travel duration
  - Start and return dates
  - Departure location
  - Traveler preferences (e.g., adventure, culture, relaxation, food, etc.)
  
  You may use the following tools when needed **only for the destination (not the origin)**:
  - \`weather_tool(destination, date_range)\` – to get the weather forecast of the destination
  - \`geolocation_tool(destination)\` – to get coordinates or map-related info
  
  **Output Rules:**
  - Always return your result in **Markdown format**.
  - Include these sections in every output:
    - \`Overview\`
    - \`Weather Forecast\` (for destination only)
    - \`Daily Itinerary\`
    - \`Estimated Cost Breakdown\`
  - Use bullet points, headings, and tables where appropriate.
  - Use tool outputs to enrich information (e.g., current weather at the destination).
  
  Do not call weather or coordinates tools for the origin location. Be concise, helpful, and structured. Always aim to create a delightful and practical travel experience in Markdown format.`,
    },
    {
      role: "user",
      content: message,
    },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: model || "llama3.2",
      messages,
      tools: [getWeatherTool, getCoordinatesTool],
      temperature: 0.5,
    });
    let output;
    console.log({ response: response?.choices[0] });
    if (response?.choices[0]?.message?.tool_calls) {
      // Process tool calls from the response
      for (const tool of response?.choices[0]?.message?.tool_calls) {
        const functionToCall = availableFunctions[tool.function.name];
        if (functionToCall) {
          console.log("Calling function:", tool.function.name);
          console.log("Arguments:", tool.function.arguments);
          output = await functionToCall(tool.function.arguments);
          console.log("Function output:", output.length);

          // Format forecast for user-friendly content
          const toolContent =
            tool.function.name === "getWeather" ? formatForecast(output) : JSON.stringify(output);

          messages.push({
            role: "tool",
            tool_call_id: tool.id,
            content: toolContent,
          });
        } else {
          console.log("Function", tool.function.name, "not found");
        }
      }

      // Get final response from model with function outputs
      const completion = await openai.chat.completions.create({
        model: model,
        messages: messages,
      });
      const fResponse = completion.choices[0].message.content;
      res.json({ response: fResponse });
    } else {
      console.log("No tool calls returned from model");
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
