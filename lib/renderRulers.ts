import type { ActivePaperState } from '@/store/useGridStore';
import type { MeasurementUnit } from '@/lib/units';
import { unitToMm, mmToUnit } from '@/lib/units';

const MM_TO_PX = 3.7795;
const RULER_THICKNESS = 24;
const RULER_GAP = 12; // Gap between paper and ruler

export function drawRulers(
  ctx: CanvasRenderingContext2D,
  widthMm: number,
  heightMm: number,
  zoom: number,
  panX: number,
  panY: number,
  paper: ActivePaperState,
  unit: MeasurementUnit,
  pointerMmX: number | null,
  pointerMmY: number | null
) {
  // We draw in screen space but we are ALREADY inside ctx.translate(panX, panY) and ctx.scale(zoom, zoom).
  // Wait, if we are inside ctx.scale(zoom), then 1 unit = 1 pixel / zoom.
  // We want the ruler text to remain constant size on screen, so we need to inverse scale the fonts and line widths.
  
  const invZoom = 1 / zoom;
  const t = RULER_THICKNESS * invZoom;
  const g = RULER_GAP * invZoom;
  
  const paperW = widthMm * MM_TO_PX;
  const paperH = heightMm * MM_TO_PX;
  
  ctx.save();
  
  // Set up common text/line styles
  ctx.fillStyle = '#1e1e1e'; // dark graphite background
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 1 * invZoom;
  ctx.font = `${11 * invZoom}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // 1. Top Ruler
  ctx.fillRect(0, -t - g, paperW, t);
  
  // 2. Bottom Ruler
  ctx.fillRect(0, paperH + g, paperW, t);
  
  // 3. Left Ruler
  ctx.fillRect(-t - g, 0, t, paperH);
  
  // 4. Right Ruler
  ctx.fillRect(paperW + g, 0, t, paperH);

  // Function to draw tick marks
  const drawTicks = (
    isVertical: boolean,
    lengthMm: number,
    marginStart: number,
    marginEnd: number,
    offsetStart: number, // offset perpendicular to axis
    direction: 1 | -1 // direction ticks face
  ) => {
    // Determine tick intervals based on zoom and unit
    let majorUnitVal = 1;
    let minorUnitVal = 0.1;
    
    if (unit === 'in') {
      if (zoom < 0.5) {
        majorUnitVal = 1;
        minorUnitVal = 0.5;
      } else if (zoom < 1) {
        majorUnitVal = 1;
        minorUnitVal = 0.25;
      } else {
        majorUnitVal = 1;
        minorUnitVal = 0.125;
      }
    } else if (unit === 'cm') {
      if (zoom < 0.4) {
        majorUnitVal = 5;
        minorUnitVal = 1;
      } else {
        majorUnitVal = 1;
        minorUnitVal = 0.1;
      }
    } else {
      // mm
      if (zoom < 0.4) {
        majorUnitVal = 50;
        minorUnitVal = 10;
      } else {
        majorUnitVal = 10;
        minorUnitVal = 1;
      }
    }
    
    const majorMm = unitToMm(majorUnitVal, unit);
    const minorMm = unitToMm(minorUnitVal, unit);
    
    ctx.beginPath();
    
    // Margin highlighting
    if (marginStart > 0) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'; // subtle blue
      if (isVertical) {
        ctx.fillRect(offsetStart, 0, t * direction, marginStart * MM_TO_PX);
      } else {
        ctx.fillRect(0, offsetStart, marginStart * MM_TO_PX, t * direction);
      }
    }
    
    if (marginEnd > 0) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      if (isVertical) {
        ctx.fillRect(offsetStart, paperH - (marginEnd * MM_TO_PX), t * direction, marginEnd * MM_TO_PX);
      } else {
        ctx.fillRect(paperW - (marginEnd * MM_TO_PX), offsetStart, marginEnd * MM_TO_PX, t * direction);
      }
    }
    
    ctx.fillStyle = '#b3b3b3'; // text color
    ctx.strokeStyle = '#5a5a5a'; // minor tick color

    for (let m = 0; m <= lengthMm; m += minorMm) {
      const isMajor = Math.abs((m % majorMm)) < 0.01 || Math.abs((m % majorMm) - majorMm) < 0.01;
      // Reverse direction for vertical: 0 is at the bottom
      const physicalMm = isVertical ? lengthMm - m : m;
      const posPx = physicalMm * MM_TO_PX;
      const tickSize = isMajor ? t : t * 0.4;
      
      const startX = isVertical ? offsetStart + (direction === 1 ? t - tickSize : 0) : posPx;
      const startY = isVertical ? posPx : offsetStart + (direction === 1 ? t - tickSize : 0);
      
      const endX = isVertical ? startX + tickSize : posPx;
      const endY = isVertical ? posPx : startY + tickSize;
      
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      
      if (isMajor) {
        const val = mmToUnit(m, unit);
        // Clean formatting for floats like 0.25, 0.5, 1, 10
        let valStr = val.toString();
        if (valStr.length > 5) valStr = val.toFixed(2).replace(/\.?0+$/, '');
        
        ctx.save();
        if (isVertical) {
          ctx.translate(offsetStart + (t / 2), posPx);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(valStr, 0, 0);
        } else {
          ctx.fillText(valStr, posPx, offsetStart + (t / 2));
        }
        ctx.restore();
      }
    }
    ctx.stroke();
  };

  // Top
  drawTicks(false, widthMm, paper.margins.left, paper.margins.right, -t - g, 1);
  // Bottom
  drawTicks(false, widthMm, paper.margins.left, paper.margins.right, paperH + g, -1);
  // Left
  drawTicks(true, heightMm, paper.margins.top, paper.margins.bottom, -t - g, 1);
  // Right
  drawTicks(true, heightMm, paper.margins.top, paper.margins.bottom, paperW + g, -1);

  // Draw pointer tracker
  if (pointerMmX !== null && pointerMmY !== null) {
    ctx.fillStyle = '#ef4444'; // Subtle red tracker
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5 * invZoom;
    
    const pxX = pointerMmX * MM_TO_PX;
    const pxY = pointerMmY * MM_TO_PX;
    
    // Top tracker
    if (pointerMmX >= 0 && pointerMmX <= widthMm) {
      ctx.beginPath();
      ctx.moveTo(pxX, -g);
      ctx.lineTo(pxX, -t - g);
      ctx.stroke();
    }
    // Left tracker
    if (pointerMmY >= 0 && pointerMmY <= heightMm) {
      ctx.beginPath();
      ctx.moveTo(-g, pxY);
      ctx.lineTo(-t - g, pxY);
      ctx.stroke();
    }
    
    // Coordinates tooltip floating near cursor
    // Only draw if pointer is over the paper or rulers
    const tooltipX = pxX + (16 * invZoom);
    const tooltipY = pxY + (24 * invZoom);
    
    const valX = mmToUnit(pointerMmX, unit);
    const valY = mmToUnit(heightMm - pointerMmY, unit);
    
    let strX = valX.toFixed(2);
    let strY = valY.toFixed(2);
    if (unit === 'px') {
        strX = Math.round(valX).toString();
        strY = Math.round(valY).toString();
    }
    
    const text = `X: ${strX} ${unit} | Y: ${strY} ${unit}`;
    const textWidth = ctx.measureText(text).width;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(tooltipX - (6 * invZoom), tooltipY - (12 * invZoom), textWidth + (12 * invZoom), 24 * invZoom);
    
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(text, tooltipX, tooltipY);
  }

  ctx.restore();
}
