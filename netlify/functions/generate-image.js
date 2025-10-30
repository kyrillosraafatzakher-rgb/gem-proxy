// netlify/functions/generate-image.js

// تقدر تغيّر الموديل لـ "imagen-3.0-generate-002" لو حابب، بنفس الأسلوب:
const MODEL = "imagen-4.0-generate-001";

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return { statusCode: 500, body: "Missing GEMINI_API_KEY env var" };
  }

  try {
    const { prompt, config } = JSON.parse(event.body || "{}");

    if (!prompt || typeof prompt !== "string") {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing prompt" }) };
    }

    // نجهّز جسم الطلب بصيغة Imagen REST (predict)
    const body = {
      instances: [{ prompt }],
      parameters: {
        // قيم افتراضية مع إمكانية override من الواجهة
        sampleCount: 1,
        aspectRatio: "3:4",          // "1:1","3:4","4:3","9:16","16:9"
        personGeneration: "allow_adult", // "dont_allow","allow_adult" (الـ "allow_all" محظور في MENA)
        ...(config || {})
      }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predict`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const text = await resp.text(); // رجّع الرد كما هو (نجاح/خطأ) عشان الواجهة تعرضه
    return {
      statusCode: resp.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err) })
    };
  }
};
