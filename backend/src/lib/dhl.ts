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

export async function createDhlShipment(
  params: DhlShipmentParams,
  config: DhlConfig
): Promise<DhlShipmentResult> {
  const baseUrl = config.environment === 'sandbox'
    ? 'https://express.api.dhl.com/mydhlapi/test'
    : 'https://express.api.dhl.com/mydhlapi'

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
