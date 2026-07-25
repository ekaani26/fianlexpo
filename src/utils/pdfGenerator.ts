import { Lead } from '../types';

export const EKAANI_CATALOGUE_PDF_URL = 'https://cdn.shopify.com/s/files/1/0748/5014/0446/files/Ekaani_Corporate_catalogue_2026.pdf?v=1784892535';

export function generateCataloguePDF(_lead?: Partial<Lead>): void {
  try {
    const link = document.createElement('a');
    link.href = EKAANI_CATALOGUE_PDF_URL;
    link.download = 'Ekaani_Corporate_catalogue_2026.pdf';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Trigger download error, falling back to window.open:', err);
    window.open(EKAANI_CATALOGUE_PDF_URL, '_blank');
  }
}


