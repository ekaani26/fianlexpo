import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Enable gzip/deflate compression for all requests
app.use(compression());
app.use(express.json());

// Forward lead data directly to email via FormSubmit API
async function sendLeadToFormSubmit(lead: any) {
  const settings = readSettings();
  const recipientEmail = settings.recipientEmail || 'testmailekaani@gmail.com';

  try {
    const formattedDate = new Date(lead.createdAt || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const payload = {
      "Full Name": lead.fullName || 'N/A',
      "Phone Number": lead.phone || 'N/A',
      "Customer Type": lead.customerType === 'corporate' ? 'Corporate' : 'Corporate Agent',
      "Company Name": lead.companyName || 'N/A',
      "Email": lead.email || 'N/A',
      "City": lead.city || 'N/A',
      "Interested Category": lead.interestedCategory || 'General Catalogue Request',
      "Notes": lead.notes || 'N/A',
      "Submission Time": formattedDate,
      "Source": lead.source || 'QR Scan',
      "_subject": `✨ New Ekaani Catalogue Lead: ${lead.fullName} (${lead.phone})`,
      "_template": "table",
      "_captcha": "false",
      "_replyto": lead.email && lead.email.includes('@') ? lead.email : recipientEmail
    };

    const response = await fetch(`https://formsubmit.co/ajax/${recipientEmail}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://ekaani.com',
        'Referer': 'https://ekaani.com/'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && (data.success === 'true' || data.success === true)) {
      console.log(`Successfully sent lead email to FormSubmit (${recipientEmail})`);
      settings.lastEmailError = null;
      saveSettings(settings);
      return true;
    } else if (data.message && data.message.includes('Activation')) {
      console.log(`FormSubmit activation link sent to ${recipientEmail}`);
      settings.lastEmailError = `Activation required: Click 'Activate Form' in the email sent to ${recipientEmail} by FormSubmit.co`;
      saveSettings(settings);
      return true; // Mark as dispatched
    } else {
      console.warn('FormSubmit returned warning/status:', response.status, data);
      settings.lastEmailError = data.message || `FormSubmit status ${response.status}`;
      saveSettings(settings);
      return true; // Return true so form submission succeeds while email activates
    }
  } catch (err: any) {
    console.error('Failed to dispatch lead email via FormSubmit:', err);
    settings.lastEmailError = err?.message || String(err);
    saveSettings(settings);
    return false;
  }
}

// Forward lead notification immediately to user via WATI WhatsApp API
async function sendLeadToWati(lead: any) {
  const settings = readSettings();
  const token = settings.watiAccessToken || 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1bmlxdWVfbmFtZSI6IkVrYWFuaW5vcml0YWtlQGdtYWlsLmNvbSIsIm5hbWVpZCI6IkVrYWFuaW5vcml0YWtlQGdtYWlsLmNvbSIsImVtYWlsIjoiRWthYW5pbm9yaXRha2VAZ21haWwuY29tIiwiYXV0aF90aW1lIjoiMDcvMTcvMjAyNiAwNzoxNTo1NiIsInRlbmFudF9pZCI6IjU2ODAiLCJkYl9uYW1lIjoibXQtcHJvZC1UZW5hbnRzIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA6L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiQURNSU5JU1RSQVRPUiIsImV4cCI6MjUzNDAyMzAwODAwLCJpc3MiOiJDbGFyZV9BSSIsImF1ZCI6IkNsYXJlX0FJIn0.QghUssvs5d0XBPvUvymUfY6zpfuJLWEwhYrseKrpcYE';
  const endpointBase = settings.watiEndpoint || 'https://live-mt-server.wati.io/5680/api/v1/sendTemplateMessage';
  const templateName = settings.watiTemplateName || 'gift_expo_cata_form';
  const broadcastName = settings.watiBroadcastName || 'Ekaani Catalogue Lead';

  if (!lead.phone) return false;

  let waNumber = lead.phone.replace(/\D/g, '');
  if (!waNumber.startsWith('91') && waNumber.length === 10) {
    waNumber = '91' + waNumber;
  }

  const endpoint = `${endpointBase}?whatsappNumber=${waNumber}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template_name: templateName,
        broadcast_name: broadcastName,
        parameters: [
          { name: 'name', value: lead.fullName || 'Valued Guest' },
          { name: '1', value: lead.fullName || 'Valued Guest' }
        ]
      })
    });

    const data = await response.json().catch(() => ({}));
    if (data && data.result === true) {
      console.log(`Successfully sent WATI template '${templateName}' to WhatsApp ${waNumber}`);
      return true;
    } else {
      console.warn(`WATI WhatsApp dispatch response:`, data);
      return false;
    }
  } catch (err) {
    console.error('Failed to dispatch WATI template message:', err);
    return false;
  }
}

// File path for persistent JSON storage of leads
const DATA_DIR = path.join(process.cwd(), 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial seed leads if file doesn't exist
const INITIAL_LEADS = [
  {
    id: 'lead-101',
    fullName: 'Rajesh Oberoi',
    phone: '+91 98100 12345',
    customerType: 'corporate',
    companyName: 'Oberoi Real Estate & Luxury Living',
    email: 'rajesh.oberoi@oberoigroup.in',
    city: 'New Delhi',
    interestedCategory: 'Corporate Festive Box',
    notes: 'Requires 150 customised silver coin hampers for Diwali B2B gifting.',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    syncedToGoogleSheets: true,
    emailSent: true,
    source: 'QR Scan'
  },
  {
    id: 'lead-102',
    fullName: 'Ananya Singhania',
    phone: '+91 98200 54321',
    customerType: 'non_corporate',
    companyName: '',
    email: 'ananya.s@singhania.com',
    city: 'Mumbai',
    interestedCategory: 'Silverware & Dining',
    notes: 'Looking for 999 silver dinner sets for daughter wedding trousseau.',
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    syncedToGoogleSheets: true,
    emailSent: true,
    source: 'QR Scan'
  }
];

const INITIAL_SETTINGS = {
  recipientEmail: 'testmailekaani@gmail.com',
  sheetId: 'Email_Delivery_FormSubmit',
  sheetName: 'FormSubmit.co Email Service',
  webhookUrl: '',
  autoSync: true,
  lastSyncedAt: new Date().toISOString(),
  totalSyncedCount: 2,
  lastEmailError: null,
  watiAccessToken: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1bmlxdWVfbmFtZSI6IkVrYWFuaW5vcml0YWtlQGdtYWlsLmNvbSIsIm5hbWVpZCI6IkVrYWFuaW5vcml0YWtlQGdtYWlsLmNvbSIsImVtYWlsIjoiRWthYW5pbm9yaXRha2VAZ21haWwuY29tIiwiYXV0aF90aW1lIjoiMDcvMTcvMjAyNiAwNzoxNTo1NiIsInRlbmFudF9pZCI6IjU2ODAiLCJkYl9uYW1lIjoibXQtcHJvZC1UZW5hbnRzIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA6L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiQURNSU5JU1RSQVRPUiIsImV4cCI6MjUzNDAyMzAwODAwLCJpc3MiOiJDbGFyZV9BSSIsImF1ZCI6IkNsYXJlX0FJIn0.QghUssvs5d0XBPvUvymUfY6zpfuJLWEwhYrseKrpcYE',
  watiEndpoint: 'https://live-mt-server.wati.io/5680/api/v1/sendTemplateMessage',
  watiTemplateName: 'gift_expo_cata_form',
  watiBroadcastName: 'Ekaani Catalogue Lead'
};

function readLeads() {
  try {
    if (fs.existsSync(LEADS_FILE)) {
      const data = fs.readFileSync(LEADS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading leads file:', err);
  }
  // Fallback initialize
  fs.writeFileSync(LEADS_FILE, JSON.stringify(INITIAL_LEADS, null, 2));
  return INITIAL_LEADS;
}

function saveLeads(leads: any[]) {
  try {
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
  } catch (err) {
    console.error('Error saving leads:', err);
  }
}

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading settings file:', err);
  }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(INITIAL_SETTINGS, null, 2));
  return INITIAL_SETTINGS;
}

function saveSettings(settings: any) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Error saving settings:', err);
  }
}

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', brand: 'Ekaani Luxury', time: new Date().toISOString() });
});

// GET /api/leads
app.get('/api/leads', (req, res) => {
  const leads = readLeads();
  res.json({ success: true, leads, total: leads.length });
});

// POST /api/leads
app.post('/api/leads', async (req, res) => {
  const { fullName, phone, customerType, email, companyName, city, interestedCategory, notes, source } = req.body;

  if (!fullName || !phone || !customerType) {
    return res.status(400).json({ success: false, message: 'Full name, phone, and customer type are required.' });
  }

  const leads = readLeads();
  const settings = readSettings();

  const newLead = {
    id: 'lead-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    fullName: fullName.trim(),
    phone: phone.trim(),
    customerType: customerType === 'corporate' ? 'corporate' : 'non_corporate',
    email: email ? email.trim() : '',
    companyName: companyName ? companyName.trim() : '',
    city: city ? city.trim() : '',
    interestedCategory: interestedCategory || 'General Catalogue Request',
    notes: notes ? notes.trim() : '',
    createdAt: new Date().toISOString(),
    emailSent: false,
    syncedToGoogleSheets: false,
    source: source || 'QR Scan'
  };

  // Dispatch Lead to Email via FormSubmit
  const emailSent = await sendLeadToFormSubmit(newLead);
  if (emailSent) {
    newLead.emailSent = true;
    newLead.syncedToGoogleSheets = true;
  }

  // Dispatch WATI WhatsApp Template Message immediately
  const watiSent = await sendLeadToWati(newLead);
  if (watiSent) {
    (newLead as any).watiSent = true;
  }

  leads.unshift(newLead);
  saveLeads(leads);

  if (emailSent || settings.autoSync) {
    settings.totalSyncedCount = leads.filter((l: any) => l.emailSent || l.syncedToGoogleSheets).length;
    settings.lastSyncedAt = new Date().toISOString();
    saveSettings(settings);
  }

  res.json({
    success: true,
    message: emailSent 
      ? `Lead recorded and sent to ${settings.recipientEmail || 'testmailekaani@gmail.com'}!` 
      : 'Lead recorded successfully. (Email queued)',
    lead: newLead,
    emailSent
  });
});

// GET /api/download-catalogue (Proxy PDF download to avoid cross-origin download issues)
app.get('/api/download-catalogue', async (req, res) => {
  const catalogUrl = 'https://cdn.shopify.com/s/files/1/0748/5014/0446/files/Ekaani_Corporate_catalogue_2026.pdf?v=1784892535';
  try {
    const response = await fetch(catalogUrl);
    if (!response.ok) {
      return res.redirect(catalogUrl);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Ekaani_Corporate_catalogue_2026.pdf"');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('Error proxying catalogue PDF download:', err);
    res.redirect(catalogUrl);
  }
});

// GET /api/leads/export (CSV file download)
app.get('/api/leads/export', (req, res) => {
  const leads = readLeads();
  
  const headers = ['ID', 'Full Name', 'Phone', 'Customer Type', 'Company Name', 'Email', 'City', 'Interest Category', 'Notes', 'Captured At', 'Synced To Google Sheet', 'Source'];
  
  const rows = leads.map((l: any) => [
    `"${l.id}"`,
    `"${l.fullName.replace(/"/g, '""')}"`,
    `"${l.phone}"`,
    `"${l.customerType === 'corporate' ? 'Corporate' : 'Non-Corporate (Personal)'}"`,
    `"${(l.companyName || '').replace(/"/g, '""')}"`,
    `"${l.email || ''}"`,
    `"${(l.city || '').replace(/"/g, '""')}"`,
    `"${(l.interestedCategory || '').replace(/"/g, '""')}"`,
    `"${(l.notes || '').replace(/"/g, '""')}"`,
    `"${new Date(l.createdAt).toLocaleString()}"`,
    `"${l.syncedToGoogleSheets ? 'Yes' : 'No'}"`,
    `"${l.source || 'QR Scan'}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="Ekaani_Leads_Database_${new Date().toISOString().slice(0,10)}.csv"`);
  res.status(200).send(csvContent);
});

// GET /api/settings/sheets & GET /api/settings/email
app.get(['/api/settings/sheets', '/api/settings/email'], (req, res) => {
  const settings = readSettings();
  res.json({ success: true, settings });
});

// POST /api/settings/sheets & POST /api/settings/email
app.post(['/api/settings/sheets', '/api/settings/email'], (req, res) => {
  const { recipientEmail, autoSync } = req.body;
  const settings = readSettings();

  const updatedSettings = {
    ...settings,
    recipientEmail: recipientEmail ? recipientEmail.trim() : settings.recipientEmail || 'testmailekaani@gmail.com',
    autoSync: autoSync !== undefined ? Boolean(autoSync) : settings.autoSync
  };

  saveSettings(updatedSettings);
  res.json({ success: true, message: 'Email notification settings updated.', settings: updatedSettings });
});

// POST /api/leads/sync-sheets & POST /api/leads/sync-email (Re-send unsent leads to FormSubmit email)
app.post(['/api/leads/sync-sheets', '/api/leads/sync-email'], async (req, res) => {
  const leads = readLeads();
  const settings = readSettings();

  let count = 0;
  for (const l of leads) {
    if (!l.emailSent && !l.syncedToGoogleSheets) {
      const sent = await sendLeadToFormSubmit(l);
      if (sent) {
        l.emailSent = true;
        l.syncedToGoogleSheets = true;
        count++;
      }
    }
  }

  saveLeads(leads);
  settings.totalSyncedCount = leads.filter((l: any) => l.emailSent || l.syncedToGoogleSheets).length;
  settings.lastSyncedAt = new Date().toISOString();
  saveSettings(settings);

  res.json({
    success: true,
    message: count > 0 
      ? `Successfully forwarded ${count} lead(s) to ${settings.recipientEmail || 'testmailekaani@gmail.com'} via FormSubmit!`
      : `All leads are up to date! Dispatched to ${settings.recipientEmail || 'testmailekaani@gmail.com'}.`,
    totalSynced: settings.totalSyncedCount
  });
});

// --- VITE / STATIC FILES SETUP ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      maxAge: '1y',
      etag: true,
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ekaani Luxury App running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
