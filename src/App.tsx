import React, { useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, Download, Clock, ChevronRight, AlertCircle } from 'lucide-react';
import { processImage, ProcessedImage } from './utils/imageProcessing';

// Separate type for storing history items
interface HistoryItem {
  timestamp: number;
  filename: string;
  thumbnail: string; // Small thumbnail only
}

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImages, setProcessedImages] = useState<ProcessedImage | null>(null);
  const [imageHistory, setImageHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Load image history from localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('imageHistory');
      if (savedHistory) {
        setImageHistory(JSON.parse(savedHistory));
      }
    } catch (err) {
      console.error('Failed to load history:', err);
      // If there's an error loading history, start fresh
      setImageHistory([]);
    }
  }, []);

  // Save image history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('imageHistory', JSON.stringify(imageHistory));
    } catch (err) {
      console.error('Failed to save history:', err);
      // If we can't save, remove the oldest items until we can
      if (err instanceof Error && err.name === 'QuotaExceededError' && imageHistory.length > 0) {
        setImageHistory(prev => prev.slice(0, -1));
      }
    }
  }, [imageHistory]);

  // Cleanup URLs when component unmounts or when processedImages changes
  useEffect(() => {
    return () => {
      if (processedImages?.original) {
        URL.revokeObjectURL(processedImages.original);
      }
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [processedImages, preview]);

  const createThumbnail = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      img.onload = () => {
        // Calculate thumbnail size (max 100px)
        const maxSize = 100;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        // Draw scaled image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Get thumbnail as data URL with reduced quality
        resolve(canvas.toDataURL('image/jpeg', 0.5));
        
        // Cleanup
        URL.revokeObjectURL(img.src);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const validateAndProcessFile = async (file: File) => {
    setError(null);
    
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      setError('Please select a JPEG or PNG image.');
      return false;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('File size must be less than 10MB.');
      return false;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    return true;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndProcessFile(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      validateAndProcessFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    try {
      setIsProcessing(true);
      setError(null);
      const processed = await processImage(selectedFile);
      setProcessedImages(processed);
      
      // Create thumbnail for history
      const thumbnail = await createThumbnail(selectedFile);
      
      // Add to history, keeping only the last 5 items
      const historyItem: HistoryItem = {
        timestamp: Date.now(),
        filename: selectedFile.name,
        thumbnail
      };
      
      setImageHistory(prev => {
        const newHistory = [historyItem, ...prev].slice(0, 6);
        return newHistory;
      });
    } catch (err) {
      setError('An error occurred while processing the image. Please try again.');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async (imageUrl: string, channel: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${selectedFile?.name.split('.')[0]}_${channel}.${selectedFile?.name.split('.')[1]}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup blob URL
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (err) {
      setError('Failed to download the image. Please try again.');
      console.error(err);
    }
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setError('History items can only be viewed as thumbnails. Please upload a new image to process it.');
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <header className="py-6 px-4 border-b border-gray-700">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ImageIcon className="w-8 h-8" />
            <h1 className="text-2xl font-bold">Photo Splitter</h1>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
          >
            <Clock className="w-5 h-5" />
            <span>History</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold mb-4">RGB Channel Splitter</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Upload your image and we'll split it into its RGB components. 
            Each channel will be extracted and available for download.
          </p>
        </div>

        {showHistory && imageHistory.length > 0 && (
          <div className="mb-12 bg-gray-800/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Recent Images</h3>
              <div className="flex items-center text-sm text-gray-400">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span>Thumbnails only</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {imageHistory.map((item) => (
                <div
                  key={item.timestamp}
                  className="bg-gray-800 rounded-lg p-4 flex items-center space-x-4"
                >
                  <img
                    src={item.thumbnail}
                    alt={item.filename}
                    className="w-16 h-16 rounded object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-medium truncate">{item.filename}</p>
                    <p className="text-sm text-gray-400">{formatDate(item.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-gray-800 rounded-xl p-8 mb-12">
          <div className="flex flex-col items-center justify-center">
            <label 
              className={`w-full max-w-xl h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                isDragging 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              htmlFor="file-upload"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className={`w-12 h-12 mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-500'}`} />
              <div className="text-center">
                <p className="text-lg">Drop your image here, or click to select</p>
                <p className="text-sm text-gray-500">PNG, JPG or JPEG (max. 10MB)</p>
              </div>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                accept="image/jpeg,image/png"
                onChange={handleFileSelect}
              />
            </label>
            
            {error && (
              <div className="mt-4 text-red-500 text-center">
                {error}
              </div>
            )}
            
            {preview && (
              <div className="mt-8 w-full max-w-xl">
                <img 
                  src={preview} 
                  alt="Preview" 
                  className="w-full h-64 object-cover rounded-lg"
                />
                <button
                  onClick={handleUpload}
                  disabled={isProcessing}
                  className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? 'Processing...' : 'Process Image'}
                </button>
              </div>
            )}
          </div>
        </div>

        {processedImages && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <ImageCard 
              title="Original"
              image={processedImages.original}
              onDownload={() => handleDownload(processedImages.original, 'original')}
            />
            <ImageCard 
              title="Red Channel"
              image={processedImages.red}
              color="red"
              onDownload={() => handleDownload(processedImages.red, 'red')}
            />
            <ImageCard 
              title="Green Channel"
              image={processedImages.green}
              color="green"
              onDownload={() => handleDownload(processedImages.green, 'green')}
            />
            <ImageCard 
              title="Blue Channel"
              image={processedImages.blue}
              color="blue"
              onDownload={() => handleDownload(processedImages.blue, 'blue')}
            />
          </div>
        )}
      </main>

      <footer className="py-6 px-4 border-t border-gray-700">
        <div className="max-w-7xl mx-auto text-center text-gray-400 text-sm">
          © 2024 Photo Splitter. Created by Shaun Cushman, Justin Yapjoco, Shyam Ramesh, Iliya Belyak
        </div>
      </footer>
    </div>
  );
}

interface ImageCardProps {
  title: string;
  image: string;
  color?: 'red' | 'green' | 'blue';
  onDownload: () => void;
}

function ImageCard({ title, image, color, onDownload }: ImageCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="relative aspect-square">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-4">
        <h3 className={`text-lg font-semibold ${color ? `text-${color}-500` : 'text-white'}`}>
          {title}
        </h3>
        <button 
          onClick={onDownload}
          className="mt-2 flex items-center space-x-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Download</span>
        </button>
      </div>
    </div>
  );
}

export default App;