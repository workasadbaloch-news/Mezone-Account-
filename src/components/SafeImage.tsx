import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { extractGoogleDriveFileId } from '../lib/mezoneDb';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function SafeImage({ src, alt, className = '', fallbackTitle }: SafeImageProps) {
  const [hasError, setHasError] = useState(false);
  const [activeSrc, setActiveSrc] = useState(src);
  const [triedDriveFallback, setTriedDriveFallback] = useState(false);

  useEffect(() => {
    setHasError(false);
    setTriedDriveFallback(false);
    setActiveSrc(src);
  }, [src]);

  const handleImageError = () => {
    const fileId = extractGoogleDriveFileId(activeSrc || src);
    if (fileId && !triedDriveFallback) {
      setTriedDriveFallback(true);
      const fallback = activeSrc.includes('thumbnail?')
        ? `https://lh3.googleusercontent.com/d/${fileId}=w1200`
        : `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
      setActiveSrc(fallback);
      return;
    }

    setHasError(true);
  };

  if (hasError || !activeSrc) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#EFECE5] text-[#57534E] p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Package className="w-7 h-7 mb-2 opacity-60" />
        <span className="text-xs font-medium leading-snug max-w-[18ch]">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={handleImageError}
      className={className}
    />
  );
}
