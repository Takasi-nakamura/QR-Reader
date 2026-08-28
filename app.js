"use strict";

const video=document.getElementById("camera"),canvas=document.getElementById("canvas"),ctx=canvas.getContext("2d",{willReadFrequently:true});
const scannerScreen=document.getElementById("scannerScreen"),messageScreen=document.getElementById("messageScreen"),resultScreen=document.getElementById("resultScreen");
const statusElement=document.getElementById("status"),messageIcon=document.getElementById("messageIcon"),messageTitle=document.getElementById("messageTitle"),messageText=document.getElementById("messageText");
const startCameraButton=document.getElementById("startCameraButton"),resultUrl=document.getElementById("resultUrl"),resultType=document.getElementById("resultType"),copyButton=document.getElementById("copyButton"),openButton=document.getElementById("openButton"),rescanButton=document.getElementById("rescanButton"),toast=document.getElementById("toast"),cameraSwitch=document.getElementById("cameraSwitch");
let stream=null,animationFrame=null,scanning=false,detected=false,currentValue="",facingMode="environment",lastDetectionTime=0;

document.addEventListener("DOMContentLoaded",initialize);
async function initialize(){
  if(!navigator.mediaDevices?.getUserMedia){showError("このブラウザではカメラを使用できません。","カメラ非対応");return}
  if("serviceWorker" in navigator){try{await navigator.serviceWorker.register("./sw.js")}catch(e){console.warn(e)}}
  startCamera();
}
async function startCamera(){
  stopCamera(); hideAllScreens(); scannerScreen.classList.remove("hidden"); statusElement.textContent="カメラを起動しています…"; detected=false;
  try{
    const constraints={video:{facingMode:{ideal:facingMode},width:{ideal:1280},height:{ideal:720}},audio:false};
    stream=await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject=stream;
    video.style.objectFit="cover";
    await video.play();
    statusElement.textContent="QRコードを探しています"; scanning=true; cameraSwitch.hidden=false; scanFrame();
  }catch(error){console.error(error);handleCameraError(error)}
}
function scanFrame(){
  if(!scanning)return;
  if(video.readyState<video.HAVE_ENOUGH_DATA||!video.videoWidth){animationFrame=requestAnimationFrame(scanFrame);return}
  const w=video.videoWidth,h=video.videoHeight,max=900,ratio=Math.min(1,max/w),tw=Math.round(w*ratio),th=Math.round(h*ratio);
  if(canvas.width!==tw||canvas.height!==th){canvas.width=tw;canvas.height=th}
  // Draw exactly the decoded video frame. No CSS transforms, filters, or color manipulation.
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";ctx.filter="none";ctx.drawImage(video,0,0,tw,th);ctx.restore();
  const image=ctx.getImageData(0,0,tw,th),code=jsQR(image.data,tw,th,{inversionAttempts:"attemptBoth"});
  if(code?.data){const now=Date.now();if(now-lastDetectionTime>1200){lastDetectionTime=now;handleQRCode(code.data)}}
  animationFrame=requestAnimationFrame(scanFrame);
}
function handleQRCode(data){if(detected)return;detected=true;scanning=false;currentValue=normalizeURL(data);stopCamera();showResult(currentValue)}
function normalizeURL(value){const v=value.trim();if(/^https?:\/\//i.test(v))return v;if(/^www\./i.test(v)||/^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(v))return "https://"+v;return v}
function isURL(value){try{const u=new URL(value);return u.protocol==="http:"||u.protocol==="https:"}catch{return false}}
function showResult(value){hideAllScreens();resultScreen.classList.remove("hidden");resultUrl.textContent=value;resultUrl.title=value;const url=isURL(value);resultType.textContent=url?"URL":"TEXT";openButton.disabled=!url}
copyButton.addEventListener("click",async()=>{if(!currentValue)return;try{await navigator.clipboard.writeText(currentValue);showToast("コピーしました")}catch{const t=document.createElement("textarea");t.value=currentValue;t.style.cssText="position:fixed;opacity:0";document.body.appendChild(t);t.select();try{document.execCommand("copy");showToast("コピーしました")}catch{showToast("コピーできませんでした")}t.remove()}});
openButton.addEventListener("click",()=>{if(isURL(currentValue))window.location.href=currentValue});
rescanButton.addEventListener("click",()=>{currentValue="";startCamera()});
startCameraButton.addEventListener("click",startCamera);
cameraSwitch.addEventListener("click",()=>{facingMode=facingMode==="environment"?"user":"environment";startCamera()});
function handleCameraError(error){scannerScreen.classList.add("hidden");messageScreen.classList.remove("hidden");messageIcon.textContent="!";startCameraButton.disabled=false;startCameraButton.textContent="もう一度試す";if(error.name==="NotAllowedError"){messageTitle.textContent="カメラへのアクセスが必要です";messageText.textContent="ブラウザの設定からカメラへのアクセスを許可して、もう一度お試しください。"}else if(error.name==="NotFoundError"){messageTitle.textContent="カメラが見つかりません";messageText.textContent="カメラが接続されているか確認してください。"}else{messageTitle.textContent="カメラを起動できません";messageText.textContent="カメラへのアクセスを確認して、もう一度お試しください。"}}
function showError(text,title){hideAllScreens();messageScreen.classList.remove("hidden");messageIcon.textContent="!";messageTitle.textContent=title;messageText.textContent=text;startCameraButton.disabled=true}
function stopCamera(){scanning=false;if(animationFrame){cancelAnimationFrame(animationFrame);animationFrame=null}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}video.srcObject=null}
function hideAllScreens(){scannerScreen.classList.add("hidden");messageScreen.classList.add("hidden");resultScreen.classList.add("hidden")}
let toastTimer;function showToast(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),1800)}
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopCamera();else if(resultScreen.classList.contains("hidden"))startCamera()});
window.addEventListener("beforeunload",stopCamera);
