import { jsPDF } from 'jspdf';
import { getCanvasPixelSize, getEffectivePaperDimensions } from '@/store/useGridStore';
import type { ActivePaperState, PaperSize, GridConfig, ImageState, Dpi } from '@/store/useGridStore';
import { drawSheet, loadImageElement } from '@/lib/renderCanvas';

export interface ExportOptions {
  activePaper: ActivePaperState;
  customPresets: PaperSize[];
  dpi: Dpi;
  grid: GridConfig;
  image: ImageState;
  type: 'png-ref' | 'png-blank' | 'pdf' | 'print';
  calibrationLine?: boolean;
}

export async function handleExport(options: ExportOptions) {
  const { activePaper, customPresets, dpi, grid, image, type, calibrationLine } = options;
  const { widthPx, heightPx } = getCanvasPixelSize(activePaper, customPresets, dpi);
  const { widthMm, heightMm, name: paperName } = getEffectivePaperDimensions(activePaper, customPresets);
  
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = widthPx;
  exportCanvas.height = heightPx;
  const ctx = exportCanvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context');

  const imgEl = (image.src && type !== 'png-blank') ? await loadImageElement(image.src) : null;
  const blankGrid = type === 'png-blank';
  
  drawSheet(ctx, widthPx, heightPx, activePaper, customPresets, grid, image, imgEl, { 
    isExport: true, 
    blankGrid,
    calibrationLine 
  });

  const filenameBase = `gridsketch-${paperName.toLowerCase()}-${dpi}dpi`;

  if (type === 'png-ref' || type === 'png-blank') {
    return new Promise<void>((resolve, reject) => {
      exportCanvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob failed'));
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filenameBase}.png`;
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      }, 'image/png');
    });
  }

  if (type === 'pdf' || type === 'print') {
    // pdf requires physical dimensions. We use orientation and mm.
    const orientation = widthMm > heightMm ? 'l' : 'p';
    
    // Create PDF with exact physical millimeters
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: [widthMm, heightMm],
    });

    // Add image. The PDF dimensions are exactly widthMm x heightMm.
    // The canvas is widthPx x heightPx.
    const imgData = exportCanvas.toDataURL('image/png', 1.0);
    pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');

    if (type === 'pdf') {
      pdf.save(`${filenameBase}.pdf`);
    } else {
      // Print
      pdf.autoPrint();
      const pdfBlobUrl = pdf.output('bloburl');
      // Open in a new tab for printing
      window.open(pdfBlobUrl, '_blank');
    }
    return Promise.resolve();
  }
}
