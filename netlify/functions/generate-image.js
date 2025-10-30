// netlify/functions/generate-image.js
// CommonJS for Netlify
const T2I_MODEL   = process.env.IMAGEN_T2I_MODEL   || "imagen-4.0-generate-001";
// ملاحظة: غيّر السطر التالي لاسم الموديل الصحيح لما جوجل يفعّل Img2Img عندك
const IMG2IMG_MODEL = process.env.IMAGEN_IMG2IMG_MODEL || "imagen-3.0-edit-001";

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
    const { mode = "t2i", prompt, config, referenceImage } = JSON.parse(event.body || "{}");

    if (!prompt || typeof prompt !== "string") {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing prompt" }) };
    }

    let model = T2I_MODEL;
    let body  = null;

    if (mode === "img2img") {
      // ==== Img2Img (مفعّل عندك لاحقًا) ====
      if (!referenceImage?.data || !referenceImage?.mimeType) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing referenceImage {data,mimeType}" }) };
      }

      model = IMG2IMG_MODEL;

      // صيغة شائعة لواجهات Imagen Img2Img عبر :predict
      // ⚠️ قد تختلف المفاتيح بدِقّة حسب الإصدار الذي سيفتح لك — عدّلها إن لزم عند التفعيل.
      body = {
        instances: [{
          prompt,
          referenceImage: {
            // بعض الإصدارات تقبل bytesBase64Encoded مباشرةً:
            bytesBase64Encoded: referenceImage.data,
            mimeType: referenceImage.mimeType
          },
          // تحكم في مدى الالتزام بالصورة مقابل البرومبت (0..1)
          guidanceStrength: config?.guidanceStrength ?? 0.6
        }],
        parameters: {
          sampleCount: config?.sampleCount ?? 1,
          aspectRatio:  config?.aspectRatio  ?? "3:4",
          personGeneration: config?.personGeneration ?? "allow_adult"
        }
      };
    } else {
      // ==== Text→Image ====
      body = {
        instances: [{ prompt }],
        parameters: {
          sampleCount: config?.sampleCount ?? 1,
          aspectRatio:  config?.aspectRatio  ?? "3:4",
          personGeneration: config?.personGeneration ?? "allow_adult"
        }
      };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const text = await resp.text();
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
