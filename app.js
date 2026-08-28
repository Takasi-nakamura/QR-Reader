"use strict";


/* =================================
   Elements
================================= */

const video =
  document.getElementById("camera");

const canvas =
  document.getElementById("canvas");

const ctx =
  canvas.getContext("2d", {
    willReadFrequently: true
  });

const cameraMessage =
  document.getElementById("cameraMessage");

const result =
  document.getElementById("result");

const resultText =
  document.getElementById("resultText");

const copyButton =
  document.getElementById("copyButton");

const openButton =
  document.getElementById("openButton");

const scanAgain =
  document.getElementById("scanAgain");

const toast =
  document.getElementById("toast");


/* =================================
   State
================================= */

let stream = null;

let scanning = false;

let lastResult = "";

let wakeLock = null;

let animationFrame = null;


/*
  QR解析用の最大サイズ。

  カメラ映像そのものは変更しない。
  解析するときだけ縮小する。
*/

const MAX_SCAN_SIZE = 1000;


/* =================================
   Start camera
================================= */

async function startCamera() {

  stopCamera();

  hideResult();

  showCameraMessage(
    "カメラを起動しています"
  );


  try {

    /*
      HTTPSチェック
    */

    if (
      location.protocol !== "https:" &&
      location.hostname !== "localhost" &&
      location.hostname !== "127.0.0.1"
    ) {

      throw new Error(
        "HTTPS_REQUIRED"
      );
    }


    /*
      Camera APIチェック
    */

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      throw new Error(
        "CAMERA_NOT_SUPPORTED"
      );
    }


    /*
      背面カメラを優先。

      exactではなくidealにすることで、
      タブレットごとのカメラ仕様差に対応。
    */

    stream =
      await navigator.mediaDevices.getUserMedia({

        video: {

          facingMode: {
            ideal: "environment"
          },

          width: {
            ideal: 1280
          },

          height: {
            ideal: 720
          },

          /*
            カメラの自動色補正等を
            Web側から無理に指定しない。
          */

          frameRate: {
            ideal: 30
          }
        },

        audio: false
      });


    /*
      videoへ映像をセット
    */

    video.srcObject = stream;


    /*
      iPhone / iPad対応
    */

    video.setAttribute(
      "playsinline",
      ""
    );

    video.setAttribute(
      "webkit-playsinline",
      ""
    );

    video.muted = true;


    await video.play();


    /*
      カメラ表示開始
    */

    cameraMessage.classList.add(
      "hidden"
    );


    scanning = true;


    /*
      スリープ防止
    */

    await requestWakeLock();


    /*
      QR解析開始
    */

    animationFrame =
      requestAnimationFrame(
        scanFrame
      );


  } catch (error) {

    console.error(
      "Camera error:",
      error
    );


    scanning = false;


    /*
      エラー内容に応じて表示
    */

    let message =
      "カメラを使用できませんでした";


    if (
      error.message ===
      "HTTPS_REQUIRED"
    ) {

      message =
        "HTTPS環境で開いてください";

    } else if (
      error.name ===
      "NotAllowedError"
    ) {

      message =
        "カメラの使用を許可してください";

    } else if (
      error.name ===
      "NotFoundError"
    ) {

      message =
        "カメラが見つかりません";

    } else if (
      error.message ===
      "CAMERA_NOT_SUPPORTED"
    ) {

      message =
        "このブラウザはカメラに対応していません";

    }


    showCameraMessage(message);

    showToast(message);
  }
}


/* =================================
   Stop camera
================================= */

function stopCamera() {

  scanning = false;


  if (animationFrame !== null) {

    cancelAnimationFrame(
      animationFrame
    );

    animationFrame = null;
  }


  if (stream) {

    stream
      .getTracks()
      .forEach(track => {

        track.stop();

      });

    stream = null;
  }


  video.srcObject = null;


  releaseWakeLock();
}


/* =================================
   QR scanning
================================= */

function scanFrame() {

  if (!scanning) {
    return;
  }


  /*
    videoが使用可能か確認
  */

  if (
    video.readyState >= 2 &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  ) {

    let width =
      video.videoWidth;

    let height =
      video.videoHeight;


    /*
      QR解析だけ縮小。

      画面に表示されるカメラ映像は
      一切縮小・加工しない。
    */

    if (
      width > MAX_SCAN_SIZE ||
      height > MAX_SCAN_SIZE
    ) {

      const scale =
        MAX_SCAN_SIZE /
        Math.max(
          width,
          height
        );

      width =
        Math.floor(
          width * scale
        );

      height =
        Math.floor(
          height * scale
        );
    }


    canvas.width = width;
    canvas.height = height;


    /*
      カメラフレームをCanvasへコピー。

      filterなし
      色補正なし
      grayscaleなし
      brightness変更なし
    */

    ctx.drawImage(
      video,
      0,
      0,
      width,
      height
    );


    /*
      Pixel data取得
    */

    const imageData =
      ctx.getImageData(
        0,
        0,
        width,
        height
      );


    /*
      QR解析
    */

    const code =
      jsQR(
        imageData.data,
        imageData.width,
        imageData.height,
        {
          inversionAttempts:
            "attemptBoth"
        }
      );


    /*
      QR発見
    */

    if (
      code &&
      code.data
    ) {

      handleResult(
        code.data
      );

      return;
    }
  }


  /*
    次のフレーム
  */

  animationFrame =
    requestAnimationFrame(
      scanFrame
    );
}


/* =================================
   Handle result
================================= */

function handleResult(data) {

  if (!scanning) {
    return;
  }


  scanning = false;


  lastResult = data;


  resultText.textContent =
    data;


  /*
    URLかどうかで
    開くボタンを変更
  */

  if (isURL(data)) {

    openButton.disabled = false;

    openButton.style.opacity =
      "1";

  } else {

    openButton.disabled = true;

    openButton.style.opacity =
      "0.45";
  }


  /*
    カメラ停止
  */

  stopCamera();


  /*
    結果表示
  */

  result.classList.remove(
    "hidden"
  );


  /*
    バイブレーション
  */

  if (
    "vibrate" in navigator
  ) {

    try {

      navigator.vibrate(
        [60, 40, 60]
      );

    } catch {
      // Ignore
    }
  }


  /*
    結果までスクロール
  */

  setTimeout(() => {

    result.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

  }, 100);
}


/* =================================
   Copy
================================= */

copyButton.addEventListener(
  "click",
  async () => {

    if (!lastResult) {
      return;
    }


    /*
      Clipboard API
    */

    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {

      try {

        await navigator.clipboard.writeText(
          lastResult
        );

        showToast(
          "コピーしました"
        );

        return;

      } catch {
        // fallback
      }
    }


    /*
      古いブラウザ用fallback
    */

    try {

      const textarea =
        document.createElement(
          "textarea"
        );

      textarea.value =
        lastResult;

      textarea.style.position =
        "fixed";

      textarea.style.left =
        "-9999px";

      document.body.appendChild(
        textarea
      );

      textarea.focus();

      textarea.select();

      document.execCommand(
        "copy"
      );

      textarea.remove();


      showToast(
        "コピーしました"
      );


    } catch {

      showToast(
        "コピーできませんでした"
      );
    }
  }
);


/* =================================
   Open URL
================================= */

openButton.addEventListener(
  "click",
  () => {

    if (!lastResult) {
      return;
    }


    if (!isURL(lastResult)) {

      showToast(
        "これはURLではありません"
      );

      return;
    }


    /*
      新しいタブで開く
    */

    const newWindow =
      window.open(
        lastResult,
        "_blank",
        "noopener,noreferrer"
      );


    /*
      ポップアップブロック等
    */

    if (!newWindow) {

      showToast(
        "ブラウザで開けませんでした"
      );
    }
  }
);


/* =================================
   Scan again
================================= */

scanAgain.addEventListener(
  "click",
  () => {

    lastResult = "";

    hideResult();

    startCamera();

  }
);


/* =================================
   URL detection
================================= */

function isURL(text) {

  try {

    const url =
      new URL(text);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );

  } catch {

    return false;
  }
}


/* =================================
   Camera message
================================= */

function showCameraMessage(
  message
) {

  cameraMessage
    .querySelector("p")
    .textContent = message;

  cameraMessage.classList.remove(
    "hidden"
  );
}


/* =================================
   Result hide
================================= */

function hideResult() {

  result.classList.add(
    "hidden"
  );
}


/* =================================
   Toast
================================= */

let toastTimer = null;

function showToast(message) {

  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  if (toastTimer) {

    clearTimeout(
      toastTimer
    );
  }


  toastTimer =
    setTimeout(() => {

      toast.classList.remove(
        "show"
      );

    }, 2200);
}


/* =================================
   Wake Lock
================================= */

async function requestWakeLock() {

  if (
    !("wakeLock" in navigator)
  ) {
    return;
  }


  try {

    wakeLock =
      await navigator.wakeLock.request(
        "screen"
      );

  } catch (error) {

    console.log(
      "Wake Lock unavailable:",
      error
    );
  }
}


function releaseWakeLock() {

  if (!wakeLock) {
    return;
  }


  wakeLock
    .release()
    .catch(() => {});


  wakeLock = null;
}


/* =================================
   Visibility change
================================= */

document.addEventListener(
  "visibilitychange",
  async () => {

    if (
      document.visibilityState ===
      "visible" &&
      scanning
    ) {

      await requestWakeLock();
    }
  }
);


/* =================================
   Auto start
================================= */

window.addEventListener(
  "load",
  () => {

    /*
      起動直後に自動でカメラON
    */

    startCamera();

  }
);


/* =================================
   Service Worker
================================= */

if (
  "serviceWorker" in navigator
) {

  window.addEventListener(
    "load",
    () => {

      navigator.serviceWorker
        .register("./sw.js")
        .then(() => {

          console.log(
            "Service Worker registered."
          );

        })
        .catch(error => {

          console.log(
            "Service Worker registration failed:",
            error
          );

        });

    }
  );
}
/*
  QR読み取りを少し軽くするため、
  解析サイズに上限を設ける。
*/

const MAX_SCAN_SIZE = 1000;


/* --------------------------------
   Camera start
-------------------------------- */

async function startCamera() {

  stopCamera();

  cameraMessage.classList.remove("hidden");

  cameraMessage.querySelector("p").textContent =
    "カメラを起動しています";

  try {

    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia) {

      throw new Error(
        "Camera API is not supported"
      );
    }


    /*
      背面カメラを優先。

      exactではなくidealにして、
      タブレットによってカメラ指定で
      エラーになる可能性を下げる。
    */

    stream =
      await navigator.mediaDevices.getUserMedia({

        video: {

          facingMode: {
            ideal: "environment"
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


    /*
      iOS / iPadOS対策
    */

    video.setAttribute(
      "playsinline",
      ""
    );

    video.setAttribute(
      "autoplay",
      ""
    );


    await video.play();


    cameraMessage.classList.add(
      "hidden"
    );


    scanning = true;


    await requestWakeLock();


    requestAnimationFrame(
      scanFrame
    );


  } catch (error) {

    console.error(
      "Camera error:",
      error
    );


    cameraMessage.classList.remove(
      "hidden"
    );


    let message =
      "カメラを使用できませんでした";


    if (
      error.name ===
      "NotAllowedError"
    ) {

      message =
        "カメラの使用を許可してください";

    } else if (
      error.name ===
      "NotFoundError"
    ) {

      message =
        "カメラが見つかりません";

    }


    cameraMessage.querySelector(
      "p"
    ).textContent = message;


    showToast(message);
  }
}


/* --------------------------------
   Stop camera
-------------------------------- */

function stopCamera() {

  scanning = false;


  if (stream) {

    stream
      .getTracks()
      .forEach(track => {
        track.stop();
      });

    stream = null;
  }


  video.srcObject = null;


  releaseWakeLock();
}


/* --------------------------------
   QR scanning
-------------------------------- */

function scanFrame() {

  if (!scanning) {
    return;
  }


  if (
    video.readyState >= 2 &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  ) {

    let width =
      video.videoWidth;

    let height =
      video.videoHeight;


    /*
      大きすぎる映像をそのまま解析すると
      タブレットによっては重くなるので縮小。
    */

    if (
      width > MAX_SCAN_SIZE ||
      height > MAX_SCAN_SIZE
    ) {

      const scale =
        MAX_SCAN_SIZE /
        Math.max(width, height);

      width =
        Math.floor(width * scale);

      height =
        Math.floor(height * scale);
    }


    canvas.width = width;
    canvas.height = height;


    /*
      カメラ映像をCanvasへコピー。

      色補正・フィルター等は一切行わない。
    */

    ctx.drawImage(
      video,
      0,
      0,
      width,
      height
    );


    const imageData =
      ctx.getImageData(
        0,
        0,
        width,
        height
      );


    const code =
      jsQR(
        imageData.data,
        imageData.width,
        imageData.height,
        {
          inversionAttempts:
            "attemptBoth"
        }
      );


    if (
      code &&
      code.data
    ) {

      handleResult(
        code.data
      );

      return;
    }
  }


  requestAnimationFrame(
    scanFrame
  );
}


/* --------------------------------
   Result
-------------------------------- */

function handleResult(data) {

  if (!scanning) {
    return;
  }


  scanning = false;

  lastResult = data;


  resultText.textContent =
    data;


  result.classList.remove(
    "hidden"
  );


  stopCamera();


  /*
    Haptic feedback
  */

  if (
    "vibrate" in navigator
  ) {

    navigator.vibrate(
      [60, 40, 60]
    );
  }


  setTimeout(() => {

    result.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

  }, 100);
}


/* --------------------------------
   Copy
-------------------------------- */

copyButton.addEventListener(
  "click",
  async () => {

    if (!lastResult) {
      return;
    }


    try {

      await navigator.clipboard
        .writeText(lastResult);

      showToast(
        "コピーしました"
      );


    } catch (error) {

      /*
        Clipboard APIが使えない環境向け
      */

      const textarea =
        document.createElement(
          "textarea"
        );

      textarea.value =
        lastResult;

      textarea.style.position =
        "fixed";

      textarea.style.opacity =
        "0";

      document.body.appendChild(
        textarea
      );

      textarea.focus();

      textarea.select();

      document.execCommand(
        "copy"
      );

      textarea.remove();


      showToast(
        "コピーしました"
      );
    }
  }
);


/* --------------------------------
   Open URL
-------------------------------- */

openButton.addEventListener(
  "click",
  () => {

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

      showToast(
        "読み取った内容はURLではありません"
      );
    }
  }
);


/* --------------------------------
   Scan again
-------------------------------- */

scanAgain.addEventListener(
  "click",
  () => {

    result.classList.add(
      "hidden"
    );

    lastResult = "";


    startCamera();
  }
);


/* --------------------------------
   URL detection
-------------------------------- */

function isURL(text) {

  try {

    const url =
      new URL(text);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );

  } catch {

    return false;
  }
}


/* --------------------------------
   Toast
-------------------------------- */

let toastTimer = null;

function showToast(message) {

  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(() => {

      toast.classList.remove(
        "show"
      );

    }, 2200);
}


/* --------------------------------
   Screen Wake Lock
-------------------------------- */

async function requestWakeLock() {

  if (
    !("wakeLock" in navigator)
  ) {
    return;
  }


  try {

    wakeLock =
      await navigator.wakeLock.request(
        "screen"
      );

  } catch (error) {

    console.log(
      "Wake Lock unavailable:",
      error
    );
  }
}


function releaseWakeLock() {

  if (!wakeLock) {
    return;
  }


  wakeLock.release()
    .catch(() => {});


  wakeLock = null;
}


/*
  アプリに戻ってきたときに
  Wake Lockを再取得
*/

document.addEventListener(
  "visibilitychange",
  async () => {

    if (
      document.visibilityState ===
      "visible" &&
      scanning
    ) {

      await requestWakeLock();
    }
  }
);


/* --------------------------------
   Auto start
-------------------------------- */

window.addEventListener(
  "load",
  () => {

    startCamera();

  }
);


/* --------------------------------
   Service Worker
-------------------------------- */

if (
  "serviceWorker" in navigator
) {

  window.addEventListener(
    "load",
    () => {

      navigator.serviceWorker
        .register("./sw.js")
        .catch(error => {

          console.log(
            "Service Worker error:",
            error
          );

        });

    }
  );
}      video: {
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
