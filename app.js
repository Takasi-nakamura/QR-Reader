"use strict";

/*
 * QR Reader
 * Simple / Fast / PWA-ready
 */

const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", {
  willReadFrequently: true
});

const scannerScreen = document.getElementById("scannerScreen");
const messageScreen = document.getElementById("messageScreen");
const resultScreen = document.getElementById("resultScreen");

const statusElement = document.getElementById("status");

const messageIcon = document.getElementById("messageIcon");
const messageTitle = document.getElementById("messageTitle");
const messageText = document.getElementById("messageText");

const startCameraButton =
  document.getElementById("startCameraButton");

const resultUrl =
  document.getElementById("resultUrl");

const resultType =
  document.getElementById("resultType");

const copyButton =
  document.getElementById("copyButton");

const openButton =
  document.getElementById("openButton");

const rescanButton =
  document.getElementById("rescanButton");

const toast =
  document.getElementById("toast");

const cameraSwitch =
  document.getElementById("cameraSwitch");


let stream = null;
let animationFrame = null;
let scanning = false;
let detected = false;

let currentUrl = "";
let facingMode = "environment";

let lastDetectionTime = 0;


/* =========================================================
   Initialization
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initialize();
});


async function initialize() {

  if (!navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia) {

    showError(
      "このブラウザではカメラを使用できません。",
      "カメラ非対応"
    );

    return;
  }

  // PWA service worker
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (error) {
      console.warn(
        "Service Worker registration failed:",
        error
      );
    }
  }

  startCamera();
}


/* =========================================================
   Camera
========================================================= */

async function startCamera() {

  stopCamera();

  hideAllScreens();

  scannerScreen.classList.remove("hidden");

  statusElement.textContent =
    "カメラを起動しています…";

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

    statusElement.textContent =
      "QRコードを探しています";

    scanning = true;
    detected = false;

    if (facingMode === "environment") {
      cameraSwitch.hidden = false;
    }

    scanFrame();

  } catch (error) {

    console.error(error);

    handleCameraError(error);
  }
}


/* =========================================================
   QR scanning
========================================================= */

function scanFrame() {

  if (!scanning) {
    return;
  }

  if (video.readyState !== video.HAVE_ENOUGH_DATA) {

    animationFrame =
      requestAnimationFrame(scanFrame);

    return;
  }

  const width = video.videoWidth;
  const height = video.videoHeight;

  if (!width || !height) {

    animationFrame =
      requestAnimationFrame(scanFrame);

    return;
  }


  /*
   * Resize processing image for speed.
   * 900px max is more than enough for most QR codes.
   */
  const maxSize = 900;

  let targetWidth = width;
  let targetHeight = height;

  if (width > maxSize) {

    const ratio = maxSize / width;

    targetWidth = Math.round(width * ratio);
    targetHeight = Math.round(height * ratio);
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  ctx.drawImage(
    video,
    0,
    0,
    targetWidth,
    targetHeight
  );

  const imageData =
    ctx.getImageData(
      0,
      0,
      targetWidth,
      targetHeight
    );

  const code =
    jsQR(
      imageData.data,
      imageData.width,
      imageData.height,
      {
        inversionAttempts: "dontInvert"
      }
    );


  if (code && code.data) {

    const now = Date.now();

    /*
     * Avoid accidental duplicate detection.
     */
    if (now - lastDetectionTime > 1000) {

      lastDetectionTime = now;

      handleQRCode(code.data);
    }

  }


  animationFrame =
    requestAnimationFrame(scanFrame);
}


/* =========================================================
   QR result
========================================================= */

function handleQRCode(data) {

  if (detected) {
    return;
  }

  detected = true;
  scanning = false;

  currentUrl = normalizeURL(data);

  stopCamera();

  showResult(currentUrl);
}


/*
 * If a QR contains:
 *
 * example.com
 *
 * convert it to:
 *
 * https://example.com
 */
function normalizeURL(value) {

  const trimmed =
    value.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (
    /^www\./i.test(trimmed) ||
    /^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)
  ) {

    return "https://" + trimmed;
  }

  return trimmed;
}


function isURL(value) {

  try {

    const url =
      new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );

  } catch {

    return false;
  }
}


/* =========================================================
   Result UI
========================================================= */

function showResult(value) {

  hideAllScreens();

  resultScreen.classList.remove("hidden");

  resultUrl.textContent = value;
  resultUrl.title = value;

  if (isURL(value)) {

    resultType.textContent = "URL";

    openButton.disabled = false;

  } else {

    resultType.textContent = "TEXT";

    openButton.disabled = true;
  }
}


/* =========================================================
   Copy
========================================================= */

copyButton.addEventListener("click", async () => {

  if (!currentUrl) {
    return;
  }

  try {

    await navigator.clipboard.writeText(currentUrl);

    showToast("コピーしました");

  } catch {

    /*
     * Fallback for older browsers
     */
    const textarea =
      document.createElement("textarea");

    textarea.value = currentUrl;

    textarea.style.position = "fixed";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    try {
      document.execCommand("copy");
      showToast("コピーしました");
    } catch {
      showToast("コピーできませんでした");
    }

    textarea.remove();
  }

});


/* =========================================================
   Open URL
========================================================= */

openButton.addEventListener("click", () => {

  if (!currentUrl || !isURL(currentUrl)) {
    return;
  }

  /*
   * Only http/https URLs are opened.
   * javascript:, data:, etc. are rejected.
   */

  window.open(
    currentUrl,
    "_blank",
    "noopener,noreferrer"
  );
});


/* =========================================================
   Rescan
========================================================= */

rescanButton.addEventListener("click", () => {

  currentUrl = "";

  resultUrl.textContent = "";

  detected = false;

  startCamera();
});


/* =========================================================
   Start camera button
========================================================= */

startCameraButton.addEventListener(
  "click",
  () => {
    startCamera();
  }
);


/* =========================================================
   Camera switch
========================================================= */

cameraSwitch.addEventListener(
  "click",
  async () => {

    facingMode =
      facingMode === "environment"
        ? "user"
        : "environment";

    await startCamera();
  }
);


/* =========================================================
   Camera errors
========================================================= */

function handleCameraError(error) {

  scannerScreen.classList.add("hidden");

  messageScreen.classList.remove("hidden");

  messageIcon.textContent = "!";
  startCameraButton.disabled = false;

  if (error.name === "NotAllowedError") {

    messageTitle.textContent =
      "カメラへのアクセスが必要です";

    messageText.textContent =
      "QRコードを読み取るには、ブラウザの設定からカメラへのアクセスを許可してください。";

    startCameraButton.textContent =
      "もう一度試す";

  } else if (error.name === "NotFoundError") {

    messageTitle.textContent =
      "カメラが見つかりません";

    messageText.textContent =
      "カメラが接続されているか確認してください。";

    startCameraButton.textContent =
      "再試行";

  } else if (error.name === "NotReadableError") {

    messageTitle.textContent =
      "カメラを使用できません";

    messageText.textContent =
      "他のアプリがカメラを使用している可能性があります。";

    startCameraButton.textContent =
      "再試行";

  } else {

    messageTitle.textContent =
      "カメラを起動できません";

    messageText.textContent =
      "カメラへのアクセスを確認して、もう一度お試しください。";

    startCameraButton.textContent =
      "再試行";
  }
}


function showError(text, title) {

  scannerScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");

  messageScreen.classList.remove("hidden");

  messageIcon.textContent = "!";
  messageTitle.textContent = title;
  messageText.textContent = text;

  startCameraButton.disabled = true;
}


/* =========================================================
   Camera cleanup
========================================================= */

function stopCamera() {

  scanning = false;

  if (animationFrame) {

    cancelAnimationFrame(animationFrame);

    animationFrame = null;
  }

  if (stream) {

    stream.getTracks().forEach(track => {
      track.stop();
    });

    stream = null;
  }

  video.srcObject = null;
}


/* =========================================================
   UI helpers
========================================================= */

function hideAllScreens() {

  scannerScreen.classList.add("hidden");
  messageScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
}


let toastTimer = null;

function showToast(message) {

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer =
    setTimeout(() => {

      toast.classList.remove("show");

    }, 1800);
}


/* =========================================================
   Page visibility
========================================================= */

document.addEventListener(
  "visibilitychange",
  () => {

    if (document.hidden) {

      stopCamera();

    } else if (
      resultScreen.classList.contains("hidden")
    ) {

      startCamera();
    }
  }
);


/* =========================================================
   Page unload
========================================================= */

window.addEventListener(
  "beforeunload",
  () => {
    stopCamera();
  }
);
