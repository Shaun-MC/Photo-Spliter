import axios from 'axios';

export interface ProcessedImage {
  original: string;
  red: string;
  green: string;
  blue: string;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  try {
    // Convert file to base64
    const base64Image = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Send image to backend for processing
    const upload_response = await axios.post('/api/upload-original-image', {
      image: base64Image,
      filename: file.name
    });

    // Extract URLs from response
    const { original } = upload_response.data;

    const retrieve_responce = await axios.post('/api/retrieve-manipulated-images', {
      filename: file.name
    });

    const { red, green, blue } = retrieve_responce.data;

    return {
      original,
      red,
      green,
      blue
    };
  } catch (error) {
    console.error('Error processing image:', error);
    throw new Error('Failed to process image');
  }
}