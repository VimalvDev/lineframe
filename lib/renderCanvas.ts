import { getEffectivePaperDimensions, getCellSizeMm } from '@/store/useGridStore';
import type { ActivePaperState, GridConfig, ImageState, PaperSize } from '@/store/useGridStore';

const BASELINE_PX_PER_MM = 3.7795; // 96 DPI reference (96 / 25.4)

export function drawSheet(
  ctx: CanvasRenderingContext2D,
  widthPx: number,
  heightPx: number,
  paper: ActivePaperState,
  presets: PaperSize[],
  grid: GridConfig,
  image: ImageState,
  imgEl: HTMLImageElement | null,
  options?: {
    isExport?: boolean;
    blankGrid?: boolean;
    calibrationLine?: boolean;
  }
) {
  const { widthMm, heightMm } = getEffectivePaperDimensions(paper, presets);
  
  // Calculate scale factor from physical mm to pixels of the target canvas
  const scale = widthPx / widthMm;

  ctx.clearRect(0, 0, widthPx, heightPx);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);

  if (imgEl && image.src && !options?.blankGrid) {
    ctx.save();
    
    // The image bounding box (crop box) in pixels
    const boxX = image.xMm * scale;
    const boxY = image.yMm * scale;
    const boxW = image.widthMm * scale;
    const boxH = image.heightMm * scale;
    
    // Create the clipping mask for the bounding box
    ctx.beginPath();
    ctx.rect(boxX, boxY, boxW, boxH);
    ctx.clip();

    ctx.translate(boxX + boxW / 2, boxY + boxH / 2);
    ctx.translate(image.panXMm * scale, image.panYMm * scale);
    ctx.rotate((image.rotation * Math.PI) / 180);
    ctx.scale(image.flipH ? -1 : 1, image.flipV ? -1 : 1);
    
    if (image.blackAndWhite) {
      ctx.filter = `grayscale(100%) brightness(${image.threshold}%) contrast(1000%) invert(${image.invert ? 100 : 0}%)`;
    } else {
      ctx.filter = `brightness(${image.brightness}%) contrast(${image.contrast}%) grayscale(${image.grayscale ? 100 : 0}%) invert(${image.invert ? 100 : 0}%)`;
    }
    
    const isRotated = image.rotation === 90 || image.rotation === 270;
    
    // The dimensions of the clipping box *in the rotated local space*
    const holeW = isRotated ? boxH : boxW;
    const holeH = isRotated ? boxW : boxH;
    
    const imgAspect = imgEl.naturalWidth / imgEl.naturalHeight;
    const holeAspect = holeW / holeH;
    
    let drawW = holeW;
    let drawH = holeH;
    
    if (image.fitMode === 'crop-to-paper' || image.fitMode === 'cover') {
      if (imgAspect > holeAspect) {
        drawH = holeH;
        drawW = drawH * imgAspect;
      } else {
        drawW = holeW;
        drawH = drawW / imgAspect;
      }
    } else if (image.fitMode === 'contain') {
      if (imgAspect > holeAspect) {
        drawW = holeW;
        drawH = drawW / imgAspect;
      } else {
        drawH = holeH;
        drawW = drawH * imgAspect;
      }
    } else {
      // Original
      drawW = imgEl.naturalWidth;
      drawH = imgEl.naturalHeight;
    }
    
    drawW *= image.scale;
    drawH *= image.scale;
    
    ctx.drawImage(imgEl, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.filter = 'none';
    ctx.restore();
  }

  // Draw margins and grid
  const { top, right, bottom, left } = paper.margins;
  const mt = top * scale;
  const mr = right * scale;
  const mb = bottom * scale;
  const ml = left * scale;

  if (grid.visible) {
    ctx.save();
    ctx.globalAlpha = grid.opacity;
    ctx.strokeStyle = grid.lineColor;
    ctx.fillStyle = grid.lineColor;
    
    const baseLineWidth = Math.max(1, grid.lineWidth * (scale / BASELINE_PX_PER_MM));
    ctx.lineWidth = baseLineWidth;

    const { cellWidthMm, cellHeightMm, usableW: usableWMm, usableH: usableHMm } = getCellSizeMm(paper, presets, grid);
    const cellW = cellWidthMm * scale;
    const cellH = cellHeightMm * scale;
    const usableW = usableWMm * scale;
    const usableH = usableHMm * scale;
    
    if (usableW > 0 && usableH > 0 && cellW > 0 && cellH > 0) {
      // Draw the bounding box for the grid (if margins exist)
      if (top > 0 || right > 0 || bottom > 0 || left > 0) {
         ctx.beginPath();
         ctx.rect(ml, mt, usableW, usableH);
         ctx.stroke();
      }

      // Draw columns
      for (let x = cellW, c = 1; x < usableW - 0.1; x += cellW, c++) {
        const isMajor = grid.majorLineFrequency > 0 && c % grid.majorLineFrequency === 0;
        ctx.beginPath();
        ctx.moveTo(ml + x, mt);
        ctx.lineTo(ml + x, mt + usableH);
        ctx.lineWidth = isMajor ? baseLineWidth * 2 : baseLineWidth;
        ctx.stroke();
      }

      // Draw rows
      for (let y = cellH, r = 1; y < usableH - 0.1; y += cellH, r++) {
        const isMajor = grid.majorLineFrequency > 0 && r % grid.majorLineFrequency === 0;
        ctx.beginPath();
        ctx.moveTo(ml, mt + y);
        ctx.lineTo(ml + usableW, mt + y);
        ctx.lineWidth = isMajor ? baseLineWidth * 2 : baseLineWidth;
        ctx.stroke();
      }
      
      // Draw center lines
      if (grid.centerLines) {
         ctx.beginPath();
         ctx.moveTo(ml + usableW / 2, mt);
         ctx.lineTo(ml + usableW / 2, mt + usableH);
         ctx.moveTo(ml, mt + usableH / 2);
         ctx.lineTo(ml + usableW, mt + usableH / 2);
         ctx.lineWidth = baseLineWidth * 1.5;
         ctx.setLineDash([baseLineWidth * 4, baseLineWidth * 4]);
         ctx.stroke();
         ctx.setLineDash([]);
      }

      // Draw labels
      if (grid.showLabels) {
        ctx.font = `${Math.max(10, cellH * 0.12)}px sans-serif`;
        ctx.textAlign = grid.labelPosition === 'center' ? 'center' : grid.labelPosition === 'bottom-right' ? 'right' : 'left';
        ctx.textBaseline = grid.labelPosition === 'center' ? 'middle' : grid.labelPosition === 'bottom-right' ? 'bottom' : 'top';
        
        const cols = Math.ceil(usableW / cellW);
        const rows = Math.ceil(usableH / cellH);
        
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const label = `${String.fromCharCode(65 + (c % 26))}${r + 1}`;
            
            let lx = ml + c * cellW;
            let ly = mt + r * cellH;
            
            // Constrain text within fractional cells at the edges
            const currentCellW = Math.min(cellW, usableW - c * cellW);
            const currentCellH = Math.min(cellH, usableH - r * cellH);
            
            if (grid.labelPosition === 'center') {
               lx += currentCellW / 2;
               ly += currentCellH / 2;
            } else if (grid.labelPosition === 'bottom-right') {
               lx += currentCellW - 4;
               ly += currentCellH - 4;
            } else {
               lx += 4;
               ly += 4;
            }
            
            ctx.fillText(label, lx, ly);
          }
        }
      }
    }
    ctx.restore();
  }
  
  if (options?.calibrationLine) {
    ctx.save();
    // 100mm = 100 * scale (pixels)
    const lineW = 100 * scale;
    // position at bottom left margin, or just inside bottom left if no margin
    const ml = paper.margins.left * scale;
    const mb = paper.margins.bottom * scale;
    const padding = 10;
    const lx = ml > padding ? ml : padding;
    const ly = heightPx - (mb > padding ? mb : padding) - 10;
    
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + lineW, ly);
    ctx.lineWidth = 2 * (widthPx / 2000); // scale line width slightly with resolution
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    
    // Add end ticks
    ctx.beginPath();
    ctx.moveTo(lx, ly - 5); ctx.lineTo(lx, ly + 5);
    ctx.moveTo(lx + lineW, ly - 5); ctx.lineTo(lx + lineW, ly + 5);
    ctx.stroke();
    
    ctx.font = `${Math.max(10, 12 * (widthPx / 2000))}px sans-serif`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('100mm Calibration Line - Print at 100% Actual Size', lx, ly - 8);
    ctx.restore();
  }
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}