import { Injectable } from '@angular/core';
import { toDataURL } from 'qrcode';

@Injectable({
  providedIn: 'root'
})
export class QrCodeGeneratorService {

  async generateQrCodeWithText(qrData: string, topText: string, bottomText: string): Promise<void> {
    const qrDataUrl = await toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      width: 256,
      margin: 3
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const qrImage = new Image();
    qrImage.src = qrDataUrl;
    
    await new Promise((resolve) => { qrImage.onload = resolve; });

    const padding = 10;
    const fontSize = 20;
    const lineHeight = 25;
    
    ctx.font = `bold ${fontSize}px Arial`;
    
    const wrapText = (text: string): string[] => {
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width > qrImage.width && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    };
    
    const topLines = wrapText(topText);
    const bottomLines = wrapText(bottomText);
    const textHeight = (topLines.length + bottomLines.length) * lineHeight + 10;
    
    canvas.width = qrImage.width + padding * 2;
    canvas.height = qrImage.height + textHeight + padding * 2;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(qrImage, padding, padding);

    ctx.fillStyle = 'black';
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    
    let yPosition = qrImage.height + padding + lineHeight;
    [...topLines, ...bottomLines].forEach(line => {
      ctx.fillText(line, canvas.width / 2, yPosition);
      yPosition += lineHeight;
    });

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${topText}-${bottomText}.png`;
    a.click();
  }
}
