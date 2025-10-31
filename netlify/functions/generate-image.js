// netlify/functions/generate-image.js

// موديلات قابلة للتعديل من بيئة نتلايف إن حبيت:
const T2I_MODEL = process.env.IMAGEN_T2I_MODEL || "imagen-4.0-generate-001";
// جرّب اسم موديل Img2Img لما يتفعل عندك (اتركه كما هو مؤقتًا)
const IMG2IMG_MODEL = process.env.IMAGEN_IMG2IMG_MODEL || "imagen-4.0-edit-001";

exports.handler = async (event) => {
  // CORS
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
    const req = JSON.parse(event.body || "{}");
    const mode   = req.mode || "t2i";
    const prompt = req.prompt;
    const config = req.config || {};
    const refImg = req.referenceImage;

    if (!prompt || typeof prompt !== "string") {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing prompt" }) };
    }

    // أجسام الطلب
    const t2iBody = {
      instances: [{ prompt }],
      parameters: {
        sampleCount: config.sampleCount ?? 1,
        aspectRatio: config.aspectRatio ?? "3:4",
        personGeneration: config.personGeneration ?? "allow_adult"
      }
    };

    const img2imgBody = {
      instances: [{
        prompt,
        // الصيغة التقريبية لنسخ Img2Img؛ قد تحتاج تعديلًا بسيطًا عند تفعيل الموديل لديك
        referenceImage: refImg ? {
          bytesBase64Encoded: refImg.data,
          mimeType: refImg.mimeType
        } : undefined,
        guidanceStrength: config.guidanceStrength ?? 0.6
      }],
      parameters: {
        sampleCount: config.sampleCount ?? 1,
        aspectRatio:  config.aspectRatio  ?? "3:4",
        personGeneration: config.personGeneration ?? "allow_adult"
      }
    };

    async function callPredict(model, body) {
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
      return { status: resp.status, body: text };
    }

    if (mode === "img2img") {
      // لو مفيش صورة مرجعية نرجع مباشرةً لـ t2i
      if (!refImg?.data || !refImg?.mimeType) {
        const { status, body } = await callPredict(T2I_MODEL, t2iBody);
        return {
          statusCode: status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "X-Imagen-Fallback": "t2i_no_reference"
          },
          body
        };
      }

      // جرب Img2Img أولًا
      const first = await callPredict(IMG2IMG_MODEL, img2imgBody);

      // لو الموديل غير متاح/غير مدعوم → Fallback لـ T2I تلقائيًا
      const notFound =
        first.status === 404 ||
        (first.status === 400 && /NOT_FOUND|unsupported|not\s+supported/i.test(first.body));

      if (notFound) {
        const { status, body } = await callPredict(T2I_MODEL, t2iBody);
        return {
          statusCode: status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "X-Imagen-Fallback": "t2i_from_img2img"
          },
          body
        };
      }

      // غير ذلك رجّع نتيجة Img2Img كما هي
      return {
        statusCode: first.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
      },
        body: first.body
      };
    }

    // وضع T2I العادي
    const out = await callPredict(T2I_MODEL, t2iBody);
    return {
      statusCode: out.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: out.body
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
