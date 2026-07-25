export type CustomerType = 'corporate' | 'non_corporate';

export interface Lead {
  id: string;
  fullName: string;
  phone: string;
  customerType: CustomerType;
  email?: string;
  companyName?: string;
  city?: string;
  interestedCategory?: string;
  notes?: string;
  createdAt: string;
  syncedToGoogleSheets?: boolean;
  emailSent?: boolean;
  source: 'QR Scan' | 'Direct Web' | 'Exhibition' | 'Store Kiosk';
}

export interface EmailSubmitConfig {
  recipientEmail: string;
  autoSync: boolean;
  lastSyncedAt?: string;
  totalSyncedCount: number;
  lastEmailError?: string | null;
}
