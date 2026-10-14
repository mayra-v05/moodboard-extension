import { putMedia, getItem, putItem } from './lib/db.js';

// Running recordings, by key (mediaKey or itemId), so they can also be stopped on command.
const recorders = new Map();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== 'offscreen') return;
  if (msg.type === 'record') {
    record(msg).then(() => sendResponse({ ok: true }), e => sendResponse({ ok: false, error: String(e?.message || e) }));
    return true;
  }
  if (msg.type === 'stop') {
    const rec = recorders.get(msg.key);
    if (rec && rec.state !== 'inactive') rec.stop();
    sendResponse({ ok: !!rec });
  }
});

async function finish({ itemId, mediaKey }, blob) {
  if (mediaKey) {
    if (blob) await putMedia(blob, mediaKey);
    if (!itemId) return;
    // item already points to mediaKey (e.g. videoKey of a navigation); only update the status
    const item = await getItem(itemId);
    if (item) { item.pendingRecording = false; if (!blob) delete item.videoKey; await putItem(item); }
    return;
  }
  const item = await getItem(itemId);
  if (!item) return;
  if (blob) {
    item.mediaKey = await putMedia(blob);
    item.mediaType = 'video';
    item.recording = true;
  }
  item.pendingRecording = false;
  await putItem(item);
}

// Resolves as soon as the recording is running; saving then happens in the background.
// With mediaKey the video is only stored under that key (e.g. for navigations).
// Crops every frame to `crop` (CSS pixels relative to the viewport), so only that section ends up in the video.
function cropStream(stream, crop) {
  if (!crop || !('MediaStreamTrackProcessor' in window) || !('MediaStreamTrackGenerator' in window)) return stream;
  const [track] = stream.getVideoTracks();
  const processor = new MediaStreamTrackProcessor({ track });
  const generator = new MediaStreamTrackGenerator({ kind: 'video' });
  const even = n => Math.max(0, Math.floor(n / 2) * 2);
  processor.readable.pipeThrough(new TransformStream({
    transform(frame, controller) {
      const scale = frame.displayWidth / crop.vw;
      const x = even(crop.x * scale), y = even(crop.y * scale);
      const width = even(Math.min(crop.w * scale, frame.displayWidth - x));
      const height = even(Math.min(crop.h * scale, frame.displayHeight - y));
      if (width < 2 || height < 2) { controller.enqueue(frame); return; }
      try { controller.enqueue(new VideoFrame(frame, { visibleRect: { x, y, width, height } })); frame.close(); }
      catch { controller.enqueue(frame); }
    },
  })).pipeTo(generator.writable).catch(() => {});
  const out = new MediaStream([generator]);
  out._source = stream;
  return out;
}

async function record({ streamId, itemId, mediaKey, seconds = 8, crop }) {
  const key = mediaKey || itemId;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId, maxWidth: 1920, maxHeight: 1080, maxFrameRate: 30 } },
    });
  } catch (e) {
    await finish({ itemId, mediaKey }, null);
    throw e;
  }

  const source = stream;
  stream = cropStream(stream, crop);
  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    source.getTracks().forEach(t => t.stop());
    recorders.delete(key);
    let ok = true;
    try { await finish({ itemId, mediaKey }, new Blob(chunks, { type: 'video/webm' })); }
    catch (e) { ok = false; console.error(e); }
    chrome.runtime.sendMessage({ type: 'recording-done', ok, key });
    if (!recorders.size) setTimeout(() => { if (!recorders.size) window.close(); }, 300);
  };
  recorders.set(key, recorder);
  recorder.start(500);
  setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), Math.min(30, seconds) * 1000);
}
