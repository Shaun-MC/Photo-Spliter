export interface ProcessedImage {
  original: string;
  red: string;
  green: string;
  blue: string;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  // Create an image element to load the file
  const img = new Image();
  const originalUrl = URL.createObjectURL(file);
  
  // Wait for image to load
  await new Promise((resolve) => {
    img.onload = resolve;
    img.src = originalUrl;
  });

  // Create canvas and get context
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;

  // Draw original image
  ctx.drawImage(img, 0, 0);
  
  // Get image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // We have the image data, now upload it to the photo-spliter/original S3 bucket
  

  // Create separate canvases for each channel
  const redCanvas = document.createElement('canvas');
  const greenCanvas = document.createElement('canvas');
  const blueCanvas = document.createElement('canvas');

  [redCanvas, greenCanvas, blueCanvas].forEach(canvas => {
    canvas.width = img.width;
    canvas.height = img.height;
  });

  const redCtx = redCanvas.getContext('2d')!;
  const greenCtx = greenCanvas.getContext('2d')!;
  const blueCtx = blueCanvas.getContext('2d')!;

  // Create ImageData for each channel
  const redImageData = redCtx.createImageData(canvas.width, canvas.height);
  const greenImageData = greenCtx.createImageData(canvas.width, canvas.height);
  const blueImageData = blueCtx.createImageData(canvas.width, canvas.height);

  // Process each pixel
  for (let i = 0; i < data.length; i += 4) {
    // Red channel
    redImageData.data[i] = data[i];     // Red
    redImageData.data[i + 1] = 0;       // Green
    redImageData.data[i + 2] = 0;       // Blue
    redImageData.data[i + 3] = data[i + 3]; // Alpha

    // Green channel
    greenImageData.data[i] = 0;         // Red
    greenImageData.data[i + 1] = data[i + 1]; // Green
    greenImageData.data[i + 2] = 0;     // Blue
    greenImageData.data[i + 3] = data[i + 3]; // Alpha

    // Blue channel
    blueImageData.data[i] = 0;          // Red
    blueImageData.data[i + 1] = 0;      // Green
    blueImageData.data[i + 2] = data[i + 2];  // Blue
    blueImageData.data[i + 3] = data[i + 3];  // Alpha
  }

  // Put the image data back on their respective canvases
  redCtx.putImageData(redImageData, 0, 0);
  greenCtx.putImageData(greenImageData, 0, 0);
  blueCtx.putImageData(blueImageData, 0, 0);

  // Convert canvases to data URLs
  const processed: ProcessedImage = {
    original: originalUrl,
    red: redCanvas.toDataURL(file.type),
    green: greenCanvas.toDataURL(file.type),
    blue: blueCanvas.toDataURL(file.type)
  };

  return processed;
}