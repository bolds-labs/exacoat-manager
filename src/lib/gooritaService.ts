/**
 * Goorita USA Logistics Integration Service
 * Base: https://goosend-dev.on-forge.com/api
 * Handles rate calculation, sandbox order/AWB booking, tracking, and AWB downloads.
 */

export const GOORITA_CONFIG = {
  DEV_BASE_URL: 'https://goosend-dev.on-forge.com/api',
  DEV_API_KEY: 'iO9TyZTLFPD9xv1JJpzPLNWO6FPT0QDB',
  ORIGIN_DISTRICT_ID: '9d70d21b-870e-4da9-a284-3905da004bbd', // Bekasi Barat
  ORIGIN_POSTAL_CODE: '17142', // Summarecon Bekasi / Marga Mulya
  ORIGIN_ADDRESS: {
    name: 'Exacoat',
    email: 'support@exacoat.com',
    phone: '628975556000',
    address_line_1: 'Ruby Commercial TB12, Jl. Bulevar Selatan',
    address_line_2: null,
    subdistrict: 'Marga Mulya',
    city: 'Kota Bekasi',
    province: 'Jawa Barat',
    country: 'Indonesia',
    postal_code: '17142',
    is_business: true,
  },
  US_COUNTRY_ID: '9d4e2dae-34cc-498a-860e-609bd81bf6e2',
  ITEM_TYPE_SMALL_PACKAGE: 'e8a11d5a-31ae-4f03-b9da-1ce4cd90f7d2', // Small Package/Envelope (< 2kg)
  ITEM_TYPE_BOX_PACKAGE: '80fb61fd-41d0-45ea-9e75-e4ca61bc46aa', // Box Package (> 2kg)
  DEFAULT_ITEM_TYPE_ID: 'e8a11d5a-31ae-4f03-b9da-1ce4cd90f7d2', // Small Package/Envelope (< 2kg)
  DEFAULT_CATEGORY_ID: '9f876651-092e-49e7-919b-c7c220ccdda0', // VINYL (HS: 8523.49.20)
};

// US State code to Goorita state_id map
export const GOORITA_US_STATES: Record<string, { id: string; name: string }> = {
  AL: { id: '9d863f20-87ce-4831-98b2-21e7e1f93458', name: 'Alabama' },
  AZ: { id: '9d863f5d-923a-4187-b9a9-b4e6e3c03ad5', name: 'Arizona' },
  AR: { id: '9d60c7ff-c89b-437c-8bfa-ea945b93af37', name: 'Arkansas' },
  CA: { id: '9d60c7ff-c92d-409e-9661-8dc1b8720cdb', name: 'California' },
  CO: { id: '9d60c7ff-ca54-4752-99e3-b15605542532', name: 'Colorado' },
  CT: { id: '9d60c7ff-cb94-4321-9f4f-6e34e0e41306', name: 'Connecticut' },
  DE: { id: '9d60c7ff-cca3-4b40-87f9-8a0cde84743e', name: 'Delaware' },
  DC: { id: '9d60c7ff-ce8f-481c-985e-f8a3653464f9', name: 'District Of Columbia' },
  FL: { id: '9d60c7ff-d0bc-4996-b7a7-18db96e73388', name: 'Florida' },
  GA: { id: '9d60c7ff-d278-4283-8926-4789ba473174', name: 'Georgia' },
  ID: { id: '9d60c7ff-d766-4d87-8f52-7ee1636f19e8', name: 'Idaho' },
  IL: { id: '9d60c7ff-d909-462b-8f94-63283b40f946', name: 'Illinois' },
  IN: { id: '9d60c7ff-da96-4c94-8713-d29f208f1439', name: 'Indiana' },
  IA: { id: '9d60c7ff-dbc0-48c8-92c6-749b6934edde', name: 'Iowa' },
  KS: { id: '9d60c7ff-dda5-4b39-a7b3-b1d581916693', name: 'Kansas' },
  KY: { id: '9d60c7ff-df52-464d-b9d3-169ff50aa90a', name: 'Kentucky' },
  LA: { id: '9d60c7ff-e173-4c75-a44d-1e7c5cb6ba87', name: 'Louisiana' },
  ME: { id: '9d60c7ff-e379-47a2-be59-973612b783a7', name: 'Maine' },
  MD: { id: '9d60c7ff-e70c-4ea8-9a71-6202425653ef', name: 'Maryland' },
  MA: { id: '9d60c7ff-e8d0-45b4-8596-3aee5e0c533b', name: 'Massachusetts' },
  MI: { id: '9d60c7ff-ea99-4e01-a097-000e287fd77b', name: 'Michigan' },
  MN: { id: '9d60c7ff-ec36-4824-a3da-79d449a8b272', name: 'Minnesota' },
  MS: { id: '9d60c7ff-ee52-48af-9e5e-17c4ce12702c', name: 'Mississippi' },
  MO: { id: '9d60c7ff-ef78-404f-9a42-dd3281d10be2', name: 'Missouri' },
  MT: { id: '9d60c7ff-f157-4172-8c27-cabd522ba147', name: 'Montana' },
  NE: { id: '9d60c7ff-f1da-40c0-b8b4-978b93294c58', name: 'Nebraska' },
  NV: { id: '9d60c7ff-f292-43a0-bf61-aa3ce750cb77', name: 'Nevada' },
  NH: { id: '9d60c7ff-f402-4bf3-a5f7-7bc7e984e79e', name: 'New Hampshire' },
  NJ: { id: '9d60c7ff-f525-49b9-a3b1-42c859e29951', name: 'New Jersey' },
  NM: { id: '9d60c7ff-f655-414b-b266-769771cc7358', name: 'New Mexico' },
  NY: { id: '9d60c7ff-f7f9-4066-b5e6-0d428eac0ff9', name: 'New York' },
  NC: { id: '9d60c7ff-f907-4244-86f8-d548b1c5ebf2', name: 'North Carolina' },
  ND: { id: '9d60c7ff-fa97-462b-b3ae-00146524ad44', name: 'North Dakota' },
  OH: { id: '9d60c7ff-fe89-4ba0-b9f8-bfa50949932d', name: 'Ohio' },
  OK: { id: '9d60c7ff-ffeb-421e-8196-0ab0e3bc76f6', name: 'Oklahoma' },
  OR: { id: '9d60c800-0186-4866-9d86-538ba656b176', name: 'Oregon' },
  PA: { id: '9d60c800-04c7-4162-b40a-793c124ac4df', name: 'Pennsylvania' },
  RI: { id: '9d60c800-07ad-4193-8992-25dacaa4d070', name: 'Rhode Island' },
  SC: { id: '9d60c800-08fa-4175-a837-3f68279163fc', name: 'South Carolina' },
  SD: { id: '9d60c800-0ad1-4822-a421-122ec6acb6f8', name: 'South Dakota' },
  TN: { id: '9d60c800-0c88-43da-9f84-78084249187d', name: 'Tennessee' },
  TX: { id: '9fd761de-3803-4bd3-b1d6-7aa0b70b5f5a', name: 'Texas' },
  UT: { id: '9d60c800-1099-4ea9-958e-44931f4cc671', name: 'Utah' },
  VT: { id: '9d60c800-1202-4803-ab0d-0229af27d470', name: 'Vermont' },
  VA: { id: '9d60c800-1575-44a0-b877-6865e2d4a014', name: 'Virginia' },
  WA: { id: '9d60c800-170b-4d25-8111-f143365472dc', name: 'Washington' },
  WV: { id: '9d60c800-18ce-446b-b13e-865291aa07d5', name: 'West Virginia' },
  WI: { id: '9d60c800-19da-4400-b980-d88cd3becbe1', name: 'Wisconsin' },
  WY: { id: '9d60c800-1b98-4c63-94f6-bc1d8f9d52a6', name: 'Wyoming' },
};

/**
 * Weight rule calculation:
 * - 1 standard skin = 50g (0.05kg), 2 skins = 100g (0.10kg), n skins = n * 50g
 * - 1 laptop skin = 200g (0.20kg), each additional laptop skin = +100g
 * Returns weight in kilograms.
 */
export function calculateGooritaShipmentWeight(skinCount: number, laptopSkinCount: number): number {
  let weightGrams = 0;
  if (skinCount > 0) {
    weightGrams += skinCount * 50;
  }
  if (laptopSkinCount > 0) {
    weightGrams += 200 + (laptopSkinCount - 1) * 100;
  }
  if (weightGrams <= 0) {
    weightGrams = 50;
  }
  return Math.round((weightGrams / 1000) * 100) / 100;
}

/**
 * Dimension rules:
 * - Phone skins: 25 × 15 × 1 cm
 * - Laptop skins: 40 × 28 × 1 cm (height increases by 0.5cm per extra laptop skin)
 */
export function calculateGooritaDimensions(skinCount: number, laptopSkinCount: number): {
  length: number;
  width: number;
  height: number;
} {
  if (laptopSkinCount > 0) {
    return {
      length: 40,
      width: 28,
      height: Math.max(1, Math.ceil(1 + (laptopSkinCount - 1) * 0.5)),
    };
  }
  return {
    length: 25,
    width: 15,
    height: Math.max(1, Math.ceil(skinCount * 0.2)),
  };
}

export interface GooritaPackageRate {
  id: string;
  name: string;
  price: {
    raw: number;
    format: string;
  };
  basic_rate: {
    raw: number;
    format: string;
  };
  surcharges: Array<{
    key?: string;
    description: string;
    amount: number | string;
  }>;
  surcharges_total?: number;
  delivery_time?: {
    raw: number;
    format: string;
  };
}

export interface GooritaRateResult {
  success: boolean;
  message?: string;
  packages: GooritaPackageRate[];
  calculatedWeightKg: number;
  dimensions: { length: number; width: number; height: number };
  raw?: any;
}

export interface GooritaOrderCreationResult {
  success: boolean;
  message?: string;
  orderUuid?: string;
  orderId?: string;
  status?: string;
  awbUrl?: string;
  awbImage?: string;
  service?: string;
  trackingNumber?: string;
  raw?: any;
}

export interface GooritaTrackingEvent {
  location: string;
  datetime: string;
  remarks?: string;
  status: string;
  status_code?: string;
  event?: string;
}

async function gooritaFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${GOORITA_CONFIG.DEV_BASE_URL}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${GOORITA_CONFIG.DEV_API_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  const status = response.status;
  const rawText = await response.text();

  let json: any = null;
  try {
    json = JSON.parse(rawText);
  } catch {
    json = { raw: rawText };
  }

  return { ok: response.ok, status, data: json };
}

/**
 * Validate & lookup US Zipcode
 */
export async function lookupGooritaZipcode(zipcode: string): Promise<{
  success: boolean;
  city?: string;
  state?: string;
  stateCode?: string;
  stateId?: string;
  error?: string;
}> {
  try {
    const res = await gooritaFetch(`/miscellaneous/zipcode?codes=${encodeURIComponent(zipcode.trim())}&country=US`);
    if (!res.ok || !res.data) {
      return { success: false, error: res.data?.message || 'Zipcode lookup failed' };
    }

    const item = res.data?.results?.[zipcode]?.[0];
    if (!item) {
      return { success: false, error: 'Zipcode not found in database' };
    }

    const stateCode = item.state_code ? item.state_code.toUpperCase() : '';
    const stateInfo = GOORITA_US_STATES[stateCode];

    return {
      success: true,
      city: item.city || item.city_en,
      state: item.state || item.state_en,
      stateCode,
      stateId: stateInfo ? stateInfo.id : undefined,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Check Goorita Shipping Rates
 */
export async function checkGooritaRates(params: {
  postalCode: string;
  stateId?: string;
  skinCount: number;
  laptopSkinCount: number;
  declaredValueUsd?: number;
  packageType?: 'small' | 'box';
}): Promise<GooritaRateResult> {
  const weightKg = calculateGooritaShipmentWeight(params.skinCount, params.laptopSkinCount);
  const dims = calculateGooritaDimensions(params.skinCount, params.laptopSkinCount);
  const stateId = params.stateId || GOORITA_US_STATES.CA.id;
  const itemTypeId = params.packageType === 'box'
    ? GOORITA_CONFIG.ITEM_TYPE_BOX_PACKAGE
    : GOORITA_CONFIG.ITEM_TYPE_SMALL_PACKAGE;

  const payload = {
    district_id: GOORITA_CONFIG.ORIGIN_DISTRICT_ID,
    destination: {
      country_id: GOORITA_CONFIG.US_COUNTRY_ID,
      state_id: stateId,
      postal_code: params.postalCode.trim(),
    },
    items: [
      {
        type: itemTypeId,
        length: dims.length,
        width: dims.width,
        height: dims.height,
        weight: weightKg,
        value: params.declaredValueUsd || 25,
      },
    ],
  };

  try {
    const res = await gooritaFetch('/business/order/check-rate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.data?.success) {
      return {
        success: false,
        message: res.data?.message || `HTTP ${res.status} Rate calculation error`,
        packages: [],
        calculatedWeightKg: weightKg,
        dimensions: dims,
        raw: res.data,
      };
    }

    const packages = res.data?.data?.packages || [];
    return {
      success: true,
      message: 'Rates calculated successfully',
      packages,
      calculatedWeightKg: weightKg,
      dimensions: dims,
      raw: res.data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message,
      packages: [],
      calculatedWeightKg: weightKg,
      dimensions: dims,
    };
  }
}

/**
 * Create Goorita Sandbox Order & Generate AWB
 */
export async function createGooritaSandboxOrder(params: {
  packageId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateId: string;
  postalCode: string;
  skinCount: number;
  laptopSkinCount: number;
  declaredValueUsd?: number;
  customTrackingNumber?: string;
  packageType?: 'small' | 'box';
}): Promise<GooritaOrderCreationResult> {
  const weightKg = calculateGooritaShipmentWeight(params.skinCount, params.laptopSkinCount);
  const dims = calculateGooritaDimensions(params.skinCount, params.laptopSkinCount);
  const trackingNumber = params.customTrackingNumber || `EXA-US-${Date.now()}`;
  const totalValue = params.declaredValueUsd || (params.laptopSkinCount > 0 ? 45 : 25);
  const itemType = params.packageType === 'box' ? 'box' : 'small';
  const itemTypeId = params.packageType === 'box'
    ? GOORITA_CONFIG.ITEM_TYPE_BOX_PACKAGE
    : GOORITA_CONFIG.ITEM_TYPE_SMALL_PACKAGE;

  const cleanPhoneStr = (params.customerPhone || '14155550192').replace(/\D/g, '');
  const phoneNum = parseInt(cleanPhoneStr, 10) || 14155550192;

  const payload = {
    package_id: params.packageId,
    item_type: itemType,
    tracking_number: trackingNumber,
    origin: {
      name: GOORITA_CONFIG.ORIGIN_ADDRESS.name,
      email: GOORITA_CONFIG.ORIGIN_ADDRESS.email,
      phone: 628975556000,
      address_line_1: GOORITA_CONFIG.ORIGIN_ADDRESS.address_line_1,
      address_line_2: GOORITA_CONFIG.ORIGIN_ADDRESS.address_line_2,
      district_id: GOORITA_CONFIG.ORIGIN_DISTRICT_ID,
      subdistrict: GOORITA_CONFIG.ORIGIN_ADDRESS.subdistrict,
      city: GOORITA_CONFIG.ORIGIN_ADDRESS.city,
      province: GOORITA_CONFIG.ORIGIN_ADDRESS.province,
      country: GOORITA_CONFIG.ORIGIN_ADDRESS.country,
      postal_code: GOORITA_CONFIG.ORIGIN_POSTAL_CODE,
      is_business: true,
    },
    destination: {
      name: params.customerName.trim(),
      email: params.customerEmail.trim(),
      phone: phoneNum,
      address_line_1: params.addressLine1.trim(),
      address_line_2: params.addressLine2 ? params.addressLine2.trim() : null,
      city: params.city.trim(),
      state_id: params.stateId,
      country_id: GOORITA_CONFIG.US_COUNTRY_ID,
      postal_code: params.postalCode.trim(),
      is_business: false,
    },
    content: {
      value: totalValue,
      description: 'Mobile / Laptop Protective Decal Skin',
      category_id: GOORITA_CONFIG.DEFAULT_CATEGORY_ID,
    },
    items: [
      {
        type: itemTypeId,
        weight: weightKg,
        height: dims.height,
        width: dims.width,
        length: dims.length,
        value: totalValue,
        hs_code: '852349',
      },
    ],
  };

  try {
    const res = await gooritaFetch('/business/order/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.data?.success) {
      return {
        success: false,
        message: res.data?.message || `HTTP ${res.status} Order creation failed`,
        raw: res.data,
      };
    }

    const orderData = res.data.data;
    const firstItem = orderData.items?.[0];

    return {
      success: true,
      message: 'Goorita AWB created successfully',
      orderUuid: orderData.id,
      orderId: orderData.order_id,
      status: orderData.status,
      awbUrl: firstItem?.awb_url,
      awbImage: firstItem?.awb_image,
      service: orderData.service || orderData.package,
      trackingNumber,
      raw: orderData,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message,
    };
  }
}

/**
 * Track an order by Goorita Order Code
 */
export async function trackGooritaOrder(orderId: string): Promise<{
  success: boolean;
  message?: string;
  events: GooritaTrackingEvent[];
  raw?: any;
}> {
  try {
    const res = await gooritaFetch('/business/order/track', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId.trim() }),
    });

    if (!res.ok || !res.data?.success) {
      return {
        success: false,
        message: res.data?.message || `HTTP ${res.status} Order tracking failed`,
        events: [],
        raw: res.data,
      };
    }

    const events = Array.isArray(res.data.data) ? res.data.data : [];
    return {
      success: true,
      message: res.data.message || 'Tracking retrieved',
      events,
      raw: res.data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message,
      events: [],
    };
  }
}

/**
 * List past business transactions / orders
 */
export async function fetchGooritaTransactions(): Promise<{
  success: boolean;
  orders: any[];
  error?: string;
}> {
  try {
    const res = await gooritaFetch('/business/order/transaction');
    if (!res.ok || !res.data?.success) {
      return { success: false, orders: [], error: res.data?.message || 'Failed to list transactions' };
    }
    return {
      success: true,
      orders: Array.isArray(res.data.data) ? res.data.data : [],
    };
  } catch (err: any) {
    return { success: false, orders: [], error: err.message };
  }
}

/**
 * Download AWB PDF binary using Bearer token and trigger download or view
 */
export async function downloadGooritaAwbPdf(awbUrl: string, filename = 'goorita-awb.pdf'): Promise<boolean> {
  try {
    const res = await fetch(awbUrl, {
      headers: {
        Authorization: `Bearer ${GOORITA_CONFIG.DEV_API_KEY}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to download AWB: HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    // Open in a new tab for instant viewing/printing
    window.open(blobUrl, '_blank');
    return true;
  } catch (err) {
    console.error('Goorita AWB Download Error:', err);
    return false;
  }
}

/**
 * Simulate an incoming Goorita Webhook payload (useful for testing webhook handlers)
 */
export function buildSampleGooritaWebhookPayload(
  orderId: string,
  status = 'In Transit',
  location = 'Jakarta Delivery Hub',
  remarks = 'Package scanned at sorting facility and scheduled for export linehaul'
) {
  return {
    event: 'tracking.updated',
    order_id: orderId,
    success: true,
    statusCode: 200,
    message: 'OK',
    data: [
      {
        location,
        datetime: new Date().toISOString().replace('T', ' ').substring(0, 19),
        remarks,
        status,
        status_code: '103 - Arrive at Hub',
        event: 'ARRIVAL',
      },
    ],
  };
}

/**
 * Dispatch simulated webhook to WordPress endpoint or custom URL
 */
export async function simulateGooritaWebhook(
  targetUrl: string,
  payload: any,
  token = GOORITA_CONFIG.DEV_API_KEY
): Promise<{ success: boolean; status: number; data: any }> {
  try {
    let res: Response;
    try {
      // 1. First attempt: Standard webhook headers (mirroring Goorita's server-to-server dispatch)
      res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goorita-Event': 'tracking.updated',
          'X-Goorita-Token': token,
        },
        body: JSON.stringify(payload),
      });
    } catch (corsErr: any) {
      // 2. Fallback for browser execution: if browser CORS blocks custom X-Goorita-* preflight headers,
      // pass token via query parameter with standard Content-Type to complete the browser simulation
      let fallbackUrl = targetUrl;
      try {
        const u = new URL(targetUrl, typeof window !== 'undefined' ? window.location.href : undefined);
        u.searchParams.set('token', token);
        fallbackUrl = u.toString();
      } catch {}

      res = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...payload, token }),
      });
    }

    const status = res.status;
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { success: res.ok, status, data };
  } catch (err: any) {
    return { success: false, status: 0, data: err.message };
  }
}

