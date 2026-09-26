/**
 * Image crop utilities for Exacoat Manager
 * Converts data URLs to File objects and provides aspect ratio calculations.
 */

export interface AspectRatioInfo {
  ratio: number;
  ratioString: string;
  isTargetRatio: boolean;
  deviationPercent: number;
}

export function getImageAspectRatioInfo(width: number, height: number, targetRatio = 0.75): AspectRatioInfo {
  if (!width || !height) {
    return {
      ratio: 1,
      ratioString: 'Unknown',
      isTargetRatio: false,
      deviationPercent: 100,
    };
  }

  const currentRatio = width / height;
  const deviation = Math.abs(currentRatio - targetRatio) / targetRatio;
  const isTargetRatio = deviation <= 0.005;

  return {
    ratio: currentRatio,
    ratioString: `${width}×${height}`,
    isTargetRatio,
    deviationPercent: Number((deviation * 100).toFixed(2)),
  };
}

/**
 * Converts a data URL (Base64) to a File object.
 */
export function dataUrlToFile(dataUrl: string, filename: string, mimeType = 'image/jpeg'): File {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const type = mimeMatch ? mimeMatch[1] : mimeType;
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type });
}
