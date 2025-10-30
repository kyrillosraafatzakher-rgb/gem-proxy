const isImg2Img = document.getElementById('modeImg2Img')?.checked;

// إعدادات Imagen
const config = {
  sampleCount: 1,
  aspectRatio: "3:4",
  // personGeneration: "allow_adult",
  guidanceStrength: 0.6   // يُستخدم في Img2Img فقط
};

const payload = {
  mode: isImg2Img ? "img2img" : "t2i",
  prompt: DEFAULT_PROMPT,
  config
};

if (isImg2Img) {
  if (!uploadedImage) {
    setLoading(false);
    showError(i18n[lang].errors.noImage);
    return;
  }
  payload.referenceImage = {
    mimeType: uploadedImage.mimeType,
    data: uploadedImage.data  // Base64 بدون prefix
  };
}

const res = await fetch(PROXY_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});
