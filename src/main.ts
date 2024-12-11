import './style.css'
import init from './test-triangle';
import { assert } from './utils/util';
import { Pane } from 'tweakpane';
import { loadImageBitmap } from 'webgpu-utils';

(async () => {
  if (navigator.gpu === undefined) {
    const h = document.querySelector('#title') as HTMLElement;
    h.innerText = 'WebGPU is not supported in this browser.';
    return;
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (adapter === null) {
    const h = document.querySelector('#title') as HTMLElement;
    h.innerText = 'No adapter is available for WebGPU.';
    return;
  }

  const video = document.getElementById("capture") as HTMLVideoElement;
  navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
  }).then(stream => {
      const track = stream.getVideoTracks()[0];
      video.srcObject = stream;
      video.play()
  }).catch(e => {
    console.log(e)
  })

  const captureCanvas = document.getElementById("capture-canvas") as HTMLCanvasElement;
  const canvasContext = captureCanvas.getContext("2d");
  canvasContext.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
  function _canvasUpdate() {
    const data = canvasContext.getImageData(0, 0, captureCanvas.width, captureCanvas.height,)
    canvasContext.putImageData(data, 0, 0);
    requestAnimationFrame(_canvasUpdate);
  };
  _canvasUpdate();

  const device = await adapter.requestDevice();

  const canvas = document.querySelector<HTMLCanvasElement>('#webgpu-canvas');
  assert(canvas !== null);
  const observer = new ResizeObserver(() => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  });
  observer.observe(canvas);
  const context = canvas.getContext('webgpu') as GPUCanvasContext;

  const PARAMS = {
    level: 0,
    name: 'Test',
    active: true,
  };

  const pane = new Pane({
    title: 'Debug',
    expanded: false,
  });

  pane.addInput(PARAMS, 'level', {min: 0, max: 100});
  pane.addInput(PARAMS, 'name');
  pane.addInput(PARAMS, 'active');

  const imgBitmap = await loadImageBitmap('https://webgpufundamentals.org/webgpu/resources/images/pexels-chevanon-photography-1108099.jpg');
  const imgData = getImageData(imgBitmap);
  const numBins = 256;
  const histogram = computeHistogram(numBins, imgData);
  showImageBitmap(imgBitmap);

  const numEntries = imgData.width * imgData.height;
  drawHistogram(histogram, numEntries, [0, 1, 2]);
  init(context, device);
})();



async function main() {
  const imgBitmap = await loadImageBitmap('https://webgpufundamentals.org/webgpu/resources/images/pexels-chevanon-photography-1108099.jpg');

  const imgData = getImageData(imgBitmap);
  const numBins = 256;
  const histogram = computeHistogram(numBins, imgData);

  showImageBitmap(imgBitmap);

  const numEntries = imgData.width * imgData.height;
  drawHistogram(histogram, numEntries, [0, 1, 2]);
}

function computeHistogram(numBins, imgData) {
  const {width, height, data} = imgData;
  const bins = new Array(numBins * 4).fill(0);
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      const offset = (y * width + x) * 4;

      for (let ch = 0; ch < 4; ++ch) {
        const v = ch < 3
           ? data[offset + ch] / 255
           : srgbLuminance(data[offset + 0] / 255,
                           data[offset + 1] / 255,
                           data[offset + 2] / 255);
        const bin = Math.min(numBins - 1, v * numBins) | 0;
        ++bins[bin * 4 + ch];
      }
    }
  }
  return bins;
}

function drawHistogram(histogram, numEntries, channels, height = 100) {
  // find the highest value for each channel
  const numBins = histogram.length / 4;
  const max = [0, 0, 0, 0];
  histogram.forEach((v, ndx) => {
    const ch = ndx % 4;
    max[ch] = Math.max(max[ch], v);
  });
  const scale = max.map(max => Math.max(1 / max, 0.2 * numBins / numEntries));

  const canvas = document.querySelector<HTMLCanvasElement>('#histogram-canvas');
  canvas.width = numBins;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const colors = [
    'rgb(255, 0, 0)',
    'rgb(0, 255, 0)',
    'rgb(0, 0, 255)',
    'rgb(255, 255, 255)',
  ];

  ctx.globalCompositeOperation = 'screen';

  for (let x = 0; x < numBins; ++x) {
    const offset = x * 4;
    for (const ch of channels) {
      const v = histogram[offset + ch] * scale[ch] * height;
      ctx.fillStyle = colors[ch];
      ctx.fillRect(x, height - v, 1, v);
    }
  }
}

// from: https://www.w3.org/WAI/GL/wiki/Relative_luminance
function srgbLuminance(r, g, b) {
  return r * 0.2126 +
         g * 0.7152 +
         b * 0.0722;
}

function getImageData(imgBitmap) {
  const canvas = document.getElementById('image-data-canvas') as HTMLCanvasElement;

  // make the canvas the same size as the image
  canvas.width = imgBitmap.width;
  canvas.height = imgBitmap.height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgBitmap, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function showImageBitmap(imageBitmap) {
  const canvas = document.getElementById('image-bitmap-canvas') as HTMLCanvasElement;
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;

  const bm = canvas.getContext('bitmaprenderer');
  bm.transferFromImageBitmap(imageBitmap);
}
