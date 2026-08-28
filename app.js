const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", {
  willReadFrequently: true
});

const startButton = document.getElementById("startButton");
const cameraMessage = document.getElementById("cameraMessage");
const cameraSwitch = document.getElementById("cameraSwitch");

const result = document.getElementById("result");
const resultText = document.getElementById("resultText");

const copyButton = document.getElementById("copyButton");
const openButton = document.getElementById("openButton");
const scanAgain = document.getElementById("scanAgain");

const toast = document.getElementById("toast");

let stream = null;
let scanning = false;
let facingMode = "environment";
let lastResult = "";


// -----------------------------
// Camera
// -----------------------------

async function startCamera() {

  stopCamera();

  try {

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: facingMode
        },
        width: {
          ideal: 1280
        },
        height: {
          ideal: 720
        }
      },
      audio: false
    });

    video.srcObject = stream;

    await video.play();

    cameraMessage.classList.add("hidden");

    startButton.classList.add("hidden");

    scanning = true;

    requestAnimationFrame(scanFrame);

  } catch (error) {

    console.error(error);

    cameraMessage.classList.remove("hidden");

    cameraMessage.querySelector("p").textContent =
      "カメラを使用できませんでした";

    startButton.classList.remove("hidden");

    showToast("カメラの使用を許可してください");

  }
}


// -----------------------------
// Stop camera
// -----------------------------

function stopCamera() {

  scanning = false;

  if (stream) {

    stream.getTracks().forEach(track => {
      track.stop();
    });

    stream = null;
  }

  video.srcObject = null;
}


// -----------------------------
// Scan QR
// -----------------------------

function scanFrame() {

  if (!scanning) {
    return;
  }

  if (
    video.readyState >= 2 &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  ) {

    const width = video.videoWidth;
    const height = video.videoHeight;

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(
      video,
      0,
      0,
      width,
      height
    );

    const imageData = ctx.getImageData(
      0,
      0,
      width,
      height
    );

    const code = jsQR(
      imageData.data,
      imageData.width,
      imageData.height,
      {
        inversionAttempts: "attemptBoth"
      }
    );

    if (code && code.data) {

      handleResult(code.data);

      return;
    }
  }

  requestAnimationFrame(scanFrame);
}


// -----------------------------
// Result
// -----------------------------

function handleResult(data) {

  if (!scanning) {
    return;
  }

  scanning = false;

  lastResult = data;

  resultText.textContent = data;

  result.classList.remove("hidden");

  stopCamera();

  // Vibration
  if ("vibrate" in navigator) {
    navigator.vibrate(120);
  }

  // Auto scroll
  setTimeout(() => {
    result.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }, 100);
}


// -----------------------------
// Copy
// -----------------------------

copyButton.addEventListener("click", async () => {

  if (!lastResult) {
    return;
  }

  try {

    await navigator.clipboard.writeText(lastResult);

    showToast("コピーしました");

  } catch (error) {

    // Fallback
    const textarea = document.createElement("textarea");

    textarea.value = lastResult;

    document.body.appendChild(textarea);

    textarea.select();

    document.execCommand("copy");

    textarea.remove();

    showToast("コピーしました");
  }

});


// -----------------------------
// Open URL
// -----------------------------

openButton.addEventListener("click", () => {

  if (!lastResult) {
    return;
  }

  if (isURL(lastResult)) {

    window.open(
      lastResult,
      "_blank",
      "noopener,noreferrer"
    );

  } else {

    showToast("これはURLではありません");

  }

});


// -----------------------------
// Scan again
// -----------------------------

scanAgain.addEventListener("click", () => {

  result.classList.add("hidden");

  lastResult = "";

  startCamera();

});


// -----------------------------
// Start button
// -----------------------------

startButton.addEventListener("click", () => {
  startCamera();
});


// -----------------------------
// Switch camera
// -----------------------------

cameraSwitch.addEventListener("click", () => {

  if (facingMode === "environment") {
    facingMode = "user";
  } else {
    facingMode = "environment";
  }

  if (scanning) {
    startCamera();
  }

});


// -----------------------------
// URL detection
// -----------------------------

function isURL(text) {

  try {

    const url = new URL(text);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );

  } catch {

    return false;
  }

}


// -----------------------------
// Toast
// -----------------------------

let toastTimer;

function showToast(message) {

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {

    toast.classList.remove("show");

  }, 2200);

}


// -----------------------------
// Service Worker
// -----------------------------

if ("serviceWorker" in navigator) {

  window.addEventListener("load", () => {

    navigator.serviceWorker.register("sw.js")
      .catch(error => {
        console.log(
          "Service Worker registration failed:",
          error
        );
      });

  });

}
