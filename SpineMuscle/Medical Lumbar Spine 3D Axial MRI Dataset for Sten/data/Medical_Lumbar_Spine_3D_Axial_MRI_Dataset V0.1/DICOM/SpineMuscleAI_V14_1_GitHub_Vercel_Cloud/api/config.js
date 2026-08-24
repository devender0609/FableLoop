export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    inferenceApiUrl: process.env.INFERENCE_API_URL || ""
  });
}
