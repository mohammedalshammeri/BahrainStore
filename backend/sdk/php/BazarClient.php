<?php

/**
 * Bazar PHP SDK
 * Official client for the Bazar e-commerce platform API
 * 
 * Requirements: PHP 7.4+, ext-json, ext-curl
 */

namespace Bazar;

class BazarException extends \RuntimeException
{
    private int $statusCode;
    private array $data;

    public function __construct(string $message, int $statusCode, array $data = [])
    {
        parent::__construct($message);
        $this->statusCode = $statusCode;
        $this->data = $data;
    }

    public function getStatusCode(): int { return $this->statusCode; }
    public function getData(): array { return $this->data; }
}

abstract class BaseResource
{
    protected BazarClient $client;
    protected string $storeId;

    public function __construct(BazarClient $client)
    {
        $this->client = $client;
        $this->storeId = $client->getStoreId();
    }
}

class ProductsResource extends BaseResource
{
    public function list(array $options = []): array
    {
        return $this->client->request('GET', '/products', null, array_merge(
            ['storeId' => $this->storeId],
            $options
        ));
    }

    public function get(string $id): array
    {
        return $this->client->request('GET', "/products/{$id}");
    }

    public function getBySlug(string $slug): array
    {
        return $this->client->request('GET', "/products/slug/{$slug}", null, [
            'storeId' => $this->storeId,
        ]);
    }
}

class OrdersResource extends BaseResource
{
    public function list(array $options = []): array
    {
        return $this->client->request('GET', '/orders', null, array_merge(
            ['storeId' => $this->storeId],
            $options
        ));
    }

    public function get(string $id): array
    {
        return $this->client->request('GET', "/orders/{$id}");
    }

    public function create(array $data): array
    {
        return $this->client->request('POST', '/orders', array_merge(
            ['storeId' => $this->storeId],
            $data
        ));
    }

    public function updateStatus(string $id, string $status): array
    {
        return $this->client->request('PATCH', "/orders/{$id}/status", compact('status'));
    }
}

class CustomersResource extends BaseResource
{
    public function list(array $options = []): array
    {
        return $this->client->request('GET', '/customers', null, array_merge(
            ['storeId' => $this->storeId],
            $options
        ));
    }

    public function get(string $id): array
    {
        return $this->client->request('GET', "/customers/{$id}");
    }
}

class CategoriesResource extends BaseResource
{
    public function list(): array
    {
        return $this->client->request('GET', '/categories', null, ['storeId' => $this->storeId]);
    }
}

class CouponsResource extends BaseResource
{
    public function validate(string $code, float $orderValue): array
    {
        return $this->client->request('POST', '/coupons/validate', [
            'storeId' => $this->storeId,
            'code' => $code,
            'orderValue' => $orderValue,
        ]);
    }
}

class BazarClient
{
    private string $apiKey;
    private string $storeId;
    private string $baseUrl;

    public ProductsResource $products;
    public OrdersResource $orders;
    public CustomersResource $customers;
    public CategoriesResource $categories;
    public CouponsResource $coupons;

    public function __construct(array $config)
    {
        $this->apiKey = $config['api_key'] ?? '';
        $this->storeId = $config['store_id'] ?? '';
        $this->baseUrl = $config['base_url'] ?? 'https://api.bazar.bh';

        $this->products = new ProductsResource($this);
        $this->orders = new OrdersResource($this);
        $this->customers = new CustomersResource($this);
        $this->categories = new CategoriesResource($this);
        $this->coupons = new CouponsResource($this);
    }

    public function getStoreId(): string
    {
        return $this->storeId;
    }

    public function request(string $method, string $path, ?array $body = null, array $params = []): array
    {
        $url = $this->baseUrl . '/api/public/v1' . $path;

        if (!empty($params)) {
            $url .= '?' . http_build_query(array_filter($params, fn($v) => $v !== null));
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Accept: application/json',
                'x-api-key: ' . $this->apiKey,
            ],
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }

        $response = curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            throw new BazarException("cURL error: {$curlError}", 0);
        }

        $data = json_decode($response, true) ?? [];

        if ($statusCode >= 400) {
            throw new BazarException($data['error'] ?? 'API Error', $statusCode, $data);
        }

        return $data;
    }
}

// Example usage:
// $bazar = new \Bazar\BazarClient(['api_key' => 'sk_live_key', 'store_id' => 'store-id']);
// $products = $bazar->products->list(['limit' => 20]);
