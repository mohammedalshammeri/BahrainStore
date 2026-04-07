"""
Bazar Python SDK
Official client for the Bazar e-commerce platform API
"""
import hashlib
import hmac
import json
import urllib.request
import urllib.parse
from typing import Optional, Dict, Any, List
from dataclasses import dataclass


class BazarError(Exception):
    def __init__(self, message: str, status: int, data: Any = None):
        super().__init__(message)
        self.status = status
        self.data = data


@dataclass
class BazarConfig:
    api_key: str
    store_id: str
    base_url: str = "https://api.bazar.bh"


class BaseResource:
    def __init__(self, client: "BazarClient"):
        self._client = client
        self._store_id = client.config.store_id


class ProductsResource(BaseResource):
    def list(self, page: int = 1, limit: int = 20, search: Optional[str] = None, **kwargs):
        params = {"page": page, "limit": limit}
        if search:
            params["search"] = search
        params.update(kwargs)
        return self._client.request("GET", "/products", params=params)

    def get(self, slug: str) -> Dict:
        return self._client.request("GET", f"/products/{slug}")

    def get_by_slug(self, slug: str) -> Dict:
        return self.get(slug)


class OrdersResource(BaseResource):
    def list(self, page: int = 1, limit: int = 20, status: Optional[str] = None, **kwargs):
        params = {"page": page, "limit": limit}
        if status:
            params["status"] = status
        params.update(kwargs)
        return self._client.request("GET", "/orders", params=params)

    def get(self, order_number: str) -> Dict:
        return self._client.request("GET", f"/orders/{order_number}")

    def get_by_order_number(self, order_number: str) -> Dict:
        return self.get(order_number)

    def create(self, data: Dict) -> Dict:
        return self._client.request("POST", "/orders", body=data)


class CustomersResource(BaseResource):
    def list(self, page: int = 1, limit: int = 20, search: Optional[str] = None):
        params = {"page": page, "limit": limit}
        if search:
            params["search"] = search
        return self._client.request("GET", "/customers", params=params)

    def get(self, phone: str) -> Dict:
        return self._client.request("GET", f"/customers/{phone}")

    def get_by_phone(self, phone: str) -> Dict:
        return self.get(phone)

    def upsert(self, first_name: str, phone: str, last_name: str = "", email: Optional[str] = None) -> Dict:
        return self._client.request("POST", "/customers", body={
            "firstName": first_name,
            "lastName": last_name,
            "phone": phone,
            "email": email,
        })


class CategoriesResource(BaseResource):
    def list(self) -> List[Dict]:
        return self._client.request("GET", "/categories")


class CouponsResource(BaseResource):
    def validate(self, code: str, order_value: float) -> Dict:
        return self._client.request("POST", "/coupons/validate", body={
            "code": code,
            "orderValue": order_value,
        })


class InventoryResource(BaseResource):
    def get_stock(self, product_id: str, variant_id: Optional[str] = None) -> Dict:
        params = {"productId": product_id}
        if variant_id:
            params["variantId"] = variant_id
        return self._client.request("GET", "/inventory/stock", params=params)


def verify_webhook_signature(payload: Any, signature: str, secret: str) -> bool:
    payload_bytes = payload.encode("utf-8") if isinstance(payload, str) else payload
    provided_signature = signature.replace("sha256=", "")
    expected_signature = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
    return hmac.compare_digest(provided_signature, expected_signature)


class BazarClient:
    """Bazar API Client"""

    def __init__(self, api_key: str, store_id: str, base_url: str = "https://api.bazar.bh"):
        self.config = BazarConfig(api_key=api_key, store_id=store_id, base_url=base_url.rstrip("/"))
        self.products = ProductsResource(self)
        self.orders = OrdersResource(self)
        self.customers = CustomersResource(self)
        self.categories = CategoriesResource(self)
        self.coupons = CouponsResource(self)
        self.inventory = InventoryResource(self)

    def info(self) -> Any:
        return self.request("GET", "/")

    def contract(self) -> Any:
        return self.request("GET", "/contract")

    def changelog(self) -> Any:
        return self.request("GET", "/changelog")

    def request(
        self,
        method: str,
        path: str,
        body: Optional[Dict] = None,
        params: Optional[Dict] = None,
    ) -> Any:
        url = f"{self.config.base_url}/api/public/v1{path}"

        if params:
            query_string = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
            url = f"{url}?{query_string}"

        data = json.dumps(body).encode("utf-8") if body else None

        req = urllib.request.Request(
            url,
            data=data,
            method=method,
            headers={
                "Content-Type": "application/json",
                "x-api-key": self.config.api_key,
                "Accept": "application/json",
            },
        )

        try:
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                error_data = json.loads(e.read().decode("utf-8"))
                raise BazarError(error_data.get("error", str(e)), e.code, error_data)
            except (json.JSONDecodeError, AttributeError):
                raise BazarError(str(e), e.code)


# Example usage
if __name__ == "__main__":
    bazar = BazarClient(api_key="sk_live_your_key", store_id="your_store_id")
    products = bazar.products.list(limit=10)
    print(products)
