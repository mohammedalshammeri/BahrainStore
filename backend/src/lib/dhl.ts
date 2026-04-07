// DHL Express API integration
// Docs: https://developer.dhl.com/api-reference/dhl-express

export interface DhlConfig {
  apiKey: string
  accountNumber: string
  environment?: 'sandbox' | 'production'
}

export interface DhlShipmentParams {
  shipper: {
    name: string
    phone: string
    email?: string
    address: {
      city: string
      countryCode: string
      postalCode?: string
      addressLine1: string
    }
  }
  consignee: {
    name: string
    phone: string
    email?: string
    address: {
      city: string
      countryCode: string
      postalCode?: string
      addressLine1: string
    }
  }
  reference: string
  description: string
  weightKg: number
  lengthCm?: number
  widthCm?: number
  heightCm?: number
}

export interface DhlShipmentResult {
  shipmentTrackingNumber: string
  labelUrl?: string
  success: boolean
  error?: string
}

export interface DhlTrackingResult {
  success: boolean
  status?: string
  description?: string
  checkedAt?: string
  raw?: unknown
  error?: string
}

function getDhlBaseUrl(config: DhlConfig) {
  return config.environment === 'sandbox'
    ? 'https://express.api.dhl.com/mydhlapi/test'
    : 'https://express.api.dhl.com/mydhlapi'
}

export async function createDhlShipment(
  params: DhlShipmentParams,
  config: DhlConfig
): Promise<DhlShipmentResult> {
  const baseUrl = getDhlBaseUrl(config)

  const shipDate = new Date().toISOString().split('T')[0] + 'T10:00:00 GMT+0300'

  const payload = {
    plannedShippingDateAndTime: shipDate,
    pickup: { isRequested: false },
    productCode: 'P',
    accounts: [{ typeCode: 'shipper', number: config.accountNumber }],
    shipper: {
      name: params.shipper.name,
      phone: params.shipper.phone,
      email: params.shipper.email ?? '',
      address: {
        addressLine1: params.shipper.address.addressLine1,
        cityName: params.shipper.address.city,
        countryCode: params.shipper.address.countryCode,
        postalCode: params.shipper.address.postalCode ?? '00000',
      },
    },
    recipient: {
      name: params.consignee.name,
      phone: params.consignee.phone,
      email: params.consignee.email ?? '',
      address: {
        addressLine1: params.consignee.address.addressLine1,
        cityName: params.consignee.address.city,
        countryCode: params.consignee.address.countryCode,
        postalCode: params.consignee.address.postalCode ?? '00000',
      },
    },
    content: {
      packages: [
        {
          weight: params.weightKg,
          dimensions: {
            length: params.lengthCm ?? 20,
            width: params.widthCm ?? 15,
            height: params.heightCm ?? 10,
          },
        },
      ],
      isCustomsDeclarable: false,
      declaredValue: 0,
      declaredValueCurrency: 'BHD',
      description: params.description,
      incoterm: 'DAP',
      unitOfMeasurement: 'metric',
    },
    outputImageProperties: {
      encodingFormat: 'pdf',
      labelTemplate: 'ECOM26_84_001',
    },
  }

  try {
    const res = await fetch(`${baseUrl}/shipments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DHL-API-Key': config.apiKey,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json()
      const msg = (err as { detail?: string }).detail ?? 'DHL API error'
      console.error('[DHL]', msg)
      return { shipmentTrackingNumber: '', success: false, error: msg }
    }

    const data = await res.json() as {
      shipmentTrackingNumber: string
      documents?: Array<{ content: string }>
    }

    return {
      shipmentTrackingNumber: data.shipmentTrackingNumber,
      labelUrl: data.documents?.[0]?.content,
      success: true,
    }
  } catch (err) {
    console.error('[DHL] Network error:', err)
    return { shipmentTrackingNumber: '', success: false, error: 'Network error' }
  }
}

export async function trackDhlShipment(
  trackingNumber: string,
  config: DhlConfig
): Promise<DhlTrackingResult> {
  const baseUrl = getDhlBaseUrl(config)

  try {
    const res = await fetch(`${baseUrl}/shipments/${encodeURIComponent(trackingNumber)}/tracking`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'DHL-API-Key': config.apiKey,
      },
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[DHL tracking]', text)
      return { success: false, error: 'DHL tracking API error' }
    }

    const data = await res.json() as any
    const shipment = Array.isArray(data?.shipments) ? data.shipments[0] : data?.shipments
    const events = Array.isArray(shipment?.events)
      ? shipment.events
      : Array.isArray(shipment?.checkpoints)
        ? shipment.checkpoints
        : Array.isArray(data?.events)
          ? data.events
          : []
    const latestEvent = events[0]

    const status = shipment?.status?.statusCode
      ?? shipment?.status?.status
      ?? shipment?.status
      ?? latestEvent?.statusCode
      ?? latestEvent?.status
      ?? latestEvent?.description
      ?? 'IN_TRANSIT'

    const description = latestEvent?.description
      ?? latestEvent?.status
      ?? shipment?.status?.description
      ?? shipment?.status?.statusText
      ?? 'Shipment is in progress'

    const checkedAt = latestEvent?.timestamp
      ?? latestEvent?.date
      ?? new Date().toISOString()

    return {
      success: true,
      status: String(status),
      description: String(description),
      checkedAt: String(checkedAt),
      raw: data,
    }
  } catch (err) {
    console.error('[DHL tracking] Network error:', err)
    return { success: false, error: 'Network error' }
  }
}
