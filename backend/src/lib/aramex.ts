// Aramex Shipping API integration
// Docs: https://www.aramex.com/us/en/developers/development-tools/api-reference

export interface AramexConfig {
  user: string
  password: string
  accountNumber: string
  pinCode: string
  version?: string
}

export interface AramexShipmentParams {
  shipper: {
    name: string
    phone: string
    address: { city: string; countryCode: string; line1: string }
  }
  consignee: {
    name: string
    phone: string
    address: { city: string; countryCode: string; line1: string }
  }
  reference: string       // e.g. order number
  description: string
  weight: number          // kg
  numberOfPieces?: number
  serviceType?: string    // e.g. 'DPX' (Express)
}

export interface AramexShipmentResult {
  awbNumber: string
  labelUrl?: string
  success: boolean
  error?: string
}

export async function createAramexShipment(
  params: AramexShipmentParams,
  config: AramexConfig
): Promise<AramexShipmentResult> {
  const body = {
    ClientInfo: {
      UserName: config.user,
      Password: config.password,
      Version: config.version ?? 'v1.0',
      AccountNumber: config.accountNumber,
      AccountPin: config.pinCode,
      AccountEntity: 'BAH',
      AccountCountryCode: 'BH',
      Source: 24,
    },
    Transaction: {
      Reference1: params.reference,
      Reference2: '',
      Reference3: '',
      Reference4: '',
      Reference5: '',
    },
    Shipments: [
      {
        Shipper: {
          Reference1: params.reference,
          PartyAddress: {
            Line1: params.shipper.address.line1,
            City: params.shipper.address.city,
            CountryCode: params.shipper.address.countryCode,
          },
          Contact: {
            PersonName: params.shipper.name,
            PhoneNumber1: params.shipper.phone,
          },
        },
        Consignee: {
          Reference1: params.reference,
          PartyAddress: {
            Line1: params.consignee.address.line1,
            City: params.consignee.address.city,
            CountryCode: params.consignee.address.countryCode,
          },
          Contact: {
            PersonName: params.consignee.name,
            PhoneNumber1: params.consignee.phone,
          },
        },
        ShippingDateTime: new Date().toISOString(),
        DueDate: new Date(Date.now() + 3 * 86400 * 1000).toISOString(),
        Details: {
          Dimensions: { Length: 20, Width: 15, Height: 10, Unit: 'CM' },
          ActualWeight: { Value: params.weight, Unit: 'KG' },
          DescriptionOfGoods: params.description,
          GoodsOriginCountry: 'BH',
          NumberOfPieces: params.numberOfPieces ?? 1,
          ProductGroup: 'DOM',
          ProductType: 'PDX',
          PaymentType: 'P',
        },
      },
    ],
  }

  try {
    const res = await fetch('https://ws.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CreateShipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json() as {
      HasErrors: boolean
      Shipments?: Array<{ ID: string; Notifications: Array<{ Message: string }> }>
      Notifications?: Array<{ Message: string }>
    }

    if (data.HasErrors || !data.Shipments?.length) {
      const msg = data.Notifications?.[0]?.Message ?? 'Aramex error'
      console.error('[Aramex]', msg)
      return { awbNumber: '', success: false, error: msg }
    }

    const awb = data.Shipments[0].ID
    return { awbNumber: awb, success: true }
  } catch (err) {
    console.error('[Aramex] Network error:', err)
    return { awbNumber: '', success: false, error: 'Network error' }
  }
}

export async function trackAramexShipment(awbNumber: string, config: AramexConfig): Promise<string> {
  const body = {
    ClientInfo: {
      UserName: config.user,
      Password: config.password,
      Version: 'v1.0',
      AccountNumber: config.accountNumber,
      AccountPin: config.pinCode,
      AccountEntity: 'BAH',
      AccountCountryCode: 'BH',
      Source: 24,
    },
    Shipments: { ShipmentNumber: awbNumber },
  }
  try {
    const res = await fetch('https://ws.aramex.net/ShippingAPI.V2/Tracking/Service_1_0.svc/json/TrackShipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json() as {
      TrackingResults?: Array<{
        Value?: Array<{ WaybillNumber: string; UpdateDescription: string }>
      }>
    }
    const latest = data.TrackingResults?.[0]?.Value?.[0]
    return latest?.UpdateDescription ?? 'تعذر الحصول على تفاصيل التتبع'
  } catch {
    return 'تعذر الاتصال بسيرفر Aramex'
  }
}
