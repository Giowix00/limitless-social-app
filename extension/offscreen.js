import { FilesetResolver, FaceDetector, HandLandmarker, ObjectDetector } from './vendor/vision_bundle.mjs';

const url = (p) => chrome.runtime.getURL(p);
const send = (m) => chrome.runtime.sendMessage(m).catch(() => {});

try {
  const fileset = await FilesetResolver.forVisionTasks(url('vendor/wasm'));
  const opts = (f) => ({ baseOptions: { modelAssetPath: url('vendor/models/' + f), delegate: 'CPU' }, runningMode: 'IMAGE' });
  const face = await FaceDetector.createFromOptions(fileset, { ...opts('blaze_face_short_range.tflite'), minDetectionConfidence: 0.5 });
  const hands = await HandLandmarker.createFromOptions(fileset, { ...opts('hand_landmarker.task'), numHands: 2 });
  const obj = await ObjectDetector.createFromOptions(fileset, { ...opts('efficientdet_lite0.tflite'), scoreThreshold: 0.35, categoryAllowlist: ['cell phone'] });

  const video = document.getElementById('v');
  video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
  await video.play();

  const overlap = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
  setInterval(() => {
    try {
      const W = video.videoWidth, H = video.videoHeight;
      if (!W) return;
      const f = face.detect(video).detections.length > 0;
      const hl = hands.detect(video).landmarks;
      const handBoxes = hl.map((pts) => {
        const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
        const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
        const px = (x2 - x1) * 0.4, py = (y2 - y1) * 0.4; // expand: a held phone extends past the fingers
        return { x1: x1 - px, x2: x2 + px, y1: y1 - py, y2: y2 + py };
      });
      const phones = obj.detect(video).detections.map((d) => {
        const b = d.boundingBox;
        return { x1: b.originX / W, y1: b.originY / H, x2: (b.originX + b.width) / W, y2: (b.originY + b.height) / H };
      });
      const phoneHeld = phones.some((p) => handBoxes.some((h) => overlap(p, h)));
      send({ type: 'vision', face: f, hands: hl.length, phoneSeen: phones.length > 0, phoneHeld });
    } catch (e) { send({ type: 'visionError', error: String(e) }); }
  }, 1500);
} catch (e) {
  send({ type: 'visionError', error: String(e) });
}
