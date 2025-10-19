// ScreenShare.jsx
import React, { useRef, useState } from "react";

export default function ScreenShare({ wsUrl, sessionToken }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));
  const [sharing, setSharing] = useState(false);
  const wsRef = useRef(null);
  const captureIntervalRef = useRef(null);

  const startShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false,
      });
      videoRef.current.srcObject = stream;
      videoRef.current.play();

      // Open WebSocket
      wsRef.current = new WebSocket(wsUrl + `?token=${sessionToken}`);
      wsRef.current.onopen = () => {
        console.log("ws open");
      };
      wsRef.current.onmessage = (ev) => {
        // incoming analysis messages
        const msg = JSON.parse(ev.data);
        // show analysis in UI (implement your own handler or event)
        console.log("analysis:", msg);
      };

      // capture frames every N ms
      const fps = 2; // 2 frames per second (tune as needed)
      const intervalMs = 1000 / fps;

      captureIntervalRef.current = setInterval(() => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;

        // downscale to reduce payload
        const w = 800;
        const h = Math.round((video.videoHeight / video.videoWidth) * w);
        canvasRef.current.width = w;
        canvasRef.current.height = h;
        const ctx = canvasRef.current.getContext("2d");
        ctx.drawImage(video, 0, 0, w, h);

        canvasRef.current.toBlob(
          (blob) => {
            if (!blob) return;
            // send as binary (or base64)
            // we prefix with a small JSON header so server knows frame id/time
            const reader = new FileReader();
            reader.onload = () => {
              const b64 = reader.result.split(",")[1]; // remove data:...
              const payload = JSON.stringify({
                t: Date.now(),
                type: "frame",
                image_b64: b64,
              });
              wsRef.current.send(payload);
            };
            reader.readAsDataURL(blob);
          },
          "image/jpeg",
          0.6 // quality
        );
      }, intervalMs);

      // when user stops sharing (clicks browser stop), cleanup
      stream.getVideoTracks()[0].onended = () => stopShare();

      setSharing(true);
    } catch (err) {
      console.error("screen share failed", err);
      alert("Screen share permission denied or failed.");
    }
  };

  const stopShare = () => {
    if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    const video = videoRef.current;
    if (video && video.srcObject) {
      const tracks = video.srcObject.getTracks();
      tracks.forEach((t) => t.stop());
      video.srcObject = null;
    }
    setSharing(false);
  };

  return (
    <div>
      <video ref={videoRef} className="hidden" />
      {!sharing ? (
        <button onClick={startShare} className="bg-green-600 px-3 py-2 rounded">
          Start Screen Share & Live Analysis
        </button>
      ) : (
        <button onClick={stopShare} className="bg-red-600 px-3 py-2 rounded">
          Stop Sharing
        </button>
      )}
    </div>
  );
}
