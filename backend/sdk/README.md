# Bazar SDK

Official client SDKs for the Bazar e-commerce platform API.

## Contract Endpoints

- `GET /api/public/v1/contract` — explicit public API surface and version contract.
- `GET /api/v1/webhooks/contract` — webhook headers, signature format, retry semantics.

## Available SDKs

- **JavaScript/TypeScript** — `sdk/js/`
- **Python** — `sdk/python/`
- **PHP** — `sdk/php/`

## Theme Package CLI

يوجد الآن CLI بسيط لحزم الثيم داخل `sdk/js/theme-cli.mjs` لدعم المرحلة الرابعة عملياً.

### Validate Package

```bash
node sdk/js/theme-cli.mjs validate ./my-theme.zip https://api.example.com <jwt-token>
```

### Import Package

```bash
node sdk/js/theme-cli.mjs import ./my-theme.zip https://api.example.com <jwt-token>
```

### Export Package

```bash
node sdk/js/theme-cli.mjs export my-theme ./my-theme.zip https://api.example.com
```

## Quick Start

### JavaScript

```bash
npm install @bazar/sdk
```

```javascript
import { BazarClient, verifyWebhookSignature } from '@bazar/sdk'

const bazar = new BazarClient({
  apiKey: 'sk_live_your_api_key',
  storeId: 'your_store_id',
})

// List products
const products = await bazar.products.list({ limit: 20 })

// Get order by order number
const order = await bazar.orders.get('BZR-ORDER-NUMBER')

// Read the explicit contract published by the API
const contract = await bazar.contract()

// Verify incoming webhook payloads
const isValid = verifyWebhookSignature(rawBody, signatureHeader, webhookSecret)
```

### Python

```bash
pip install bazar-sdk
```

```python
from bazar import BazarClient, verify_webhook_signature

bazar = BazarClient(api_key='sk_live_your_api_key', store_id='your_store_id')

# List products
products = bazar.products.list(limit=20)

# Get order by order number
order = bazar.orders.get('BZR-ORDER-NUMBER')

# Inspect the API contract
contract = bazar.contract()

# Verify an incoming webhook
is_valid = verify_webhook_signature(raw_body, signature_header, webhook_secret)
```

### PHP

```bash
composer require bazar/sdk
```

```php
use Bazar\BazarClient;

$bazar = new BazarClient([
    'api_key' => 'sk_live_your_api_key',
    'store_id' => 'your_store_id',
]);

$products = $bazar->products->list(['limit' => 20]);
```
