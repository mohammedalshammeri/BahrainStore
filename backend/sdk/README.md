# Bazar SDK

Official client SDKs for the Bazar e-commerce platform API.

## Available SDKs

- **JavaScript/TypeScript** — `sdk/js/`
- **Python** — `sdk/python/`
- **PHP** — `sdk/php/`

## Quick Start

### JavaScript

```bash
npm install @bazar/sdk
```

```javascript
import { BazarClient } from '@bazar/sdk'

const bazar = new BazarClient({
  apiKey: 'sk_live_your_api_key',
  storeId: 'your_store_id',
})

// List products
const products = await bazar.products.list({ limit: 20 })

// Get order
const order = await bazar.orders.get('order_id')
```

### Python

```bash
pip install bazar-sdk
```

```python
from bazar import BazarClient

bazar = BazarClient(api_key='sk_live_your_api_key', store_id='your_store_id')

# List products
products = bazar.products.list(limit=20)

# Create order
order = bazar.orders.get('order_id')
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
