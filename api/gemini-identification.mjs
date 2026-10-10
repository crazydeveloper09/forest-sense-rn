import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const responseSchema = {
  type: "OBJECT",
  properties: {
    identified: { type: "BOOLEAN" },
    name: { type: "STRING" },
    confidence: { type: "NUMBER" },
    description: { type: "STRING" },
    habitat: { type: "STRING" },
    alternatives: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          confidence: { type: "NUMBER" },
        },
        required: ["name", "confidence"],
      },
    },
  },
  required: [
    "identified",
    "name",
    "confidence",
    "description",
    "habitat",
    "alternatives",
  ],
};

export const MODEL_NAME = MODEL;
export const isGeminiConfigured = Boolean(gemini);

function normalizeIdentification(value) {
  const alternatives = Array.isArray(value.alternatives)
    ? value.alternatives.slice(0, 3)
    : [];
  return {
    identified: value.identified === true,
    name:
      value.identified === true
        ? String(value.name || "Nieznany gatunek")
        : "Nie udało się rozpoznać grzyba",
    confidence: Math.max(
      0,
      Math.min(100, Math.round(Number(value.confidence) || 0)),
    ),
    description: String(value.description || "Model nie podał opisu."),
    habitat: String(
      value.habitat || "Nie oceniono siedliska na podstawie tego zdjęcia.",
    ),
    alternatives: alternatives.map((candidate) => ({
      name: String(candidate.name || "Nieznany gatunek"),
      confidence: Math.max(
        0,
        Math.min(100, Math.round(Number(candidate.confidence) || 0)),
      ),
    })),
  };
}

export async function identifyMushroomImage(imageBase64, mimeType) {
  if (!gemini)
    throw new Error(
      "Serwer AI nie ma ustawionego GEMINI_API_KEY. Skonfiguruj klucz po stronie API.",
    );

  const prompt = [
    "You are a cautious visual assistant for mushroom identification. Analyze the supplied photo.",
    "Return only the requested JSON fields. Do not claim certainty from an image alone.",
    'If the image is not clearly a mushroom, set identified=false, confidence=0, name="Nie rozpoznano" and explain why.',
    "If it might be a mushroom but visual details are insufficient, keep confidence at or below 35 and state that it cannot be identified reliably.",
    "For an identified candidate, use the common Polish name when known, give a concise visible-feature description, and only provide habitat if it can be described as general species knowledge. Do not infer the actual location or habitat from the photo.",
    "Confidence is a subjective visual similarity estimate, not a calibrated probability. Keep it conservative. Give up to 3 alternatives.",
    "Never say that a mushroom is safe to eat. Explicitly say expert verification is required before handling or consumption.",
  ].join(" ");

  const interaction = await gemini.interactions.create({
    model: MODEL,
    input: [
      { type: "text", text: prompt },
      { type: "image", mime_type: mimeType, data: imageBase64 },
    ],
    response_format: [
      { type: "text", mime_type: "application/json", schema: responseSchema },
    ],
    generation_config: { temperature: 0.1 },
    store: false,
  });

  if (!interaction.output_text)
    throw new Error(
      "Model AI nie zwrócił wyniku. Spróbuj wybrać wyraźniejsze zdjęcie.",
    );
  return normalizeIdentification(JSON.parse(interaction.output_text));
}
