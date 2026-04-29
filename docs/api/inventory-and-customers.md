# Inventory & Customers API

These endpoints manage the shop's stock, categories, and the client directory.

## Inventory

### `GET /api/inventory/categories/`
List all inventory categories.

**Response (200 OK):**
```json
[
  { "id": 1, "name": "Chains", "code": "CHN" },
  { "id": 2, "name": "Rings", "code": "RNG" }
]
```

### `GET /api/inventory/items/`
List all inventory items, supporting search queries by `name` or `huid`.

**Response (200 OK):**
```json
{
  "count": 300,
  "results": [
    {
      "id": 14,
      "name": "22K Mens Chain",
      "category": 1,
      "huid": "1A2B3C",
      "gross_weight": "15.000",
      "net_weight": "15.000",
      "quantity": 1
    }
  ]
}
```

### `POST /api/inventory/items/`
Add a new item to stock.

**Request Payload:**
```json
{
  "name": "22K Gold Bangle",
  "category_id": 3,
  "huid": "X9Y8Z7",
  "gross_weight": "24.500",
  "net_weight": "24.500",
  "purity": "22K",
  "quantity": 2
}
```

---

## Customers

### `GET /api/customers/`
Retrieve the customer directory. Supports searching by `phone` or `name`.

**Response (200 OK):**
```json
{
  "count": 120,
  "results": [
    {
      "id": 42,
      "name": "John Doe",
      "phone": "9876543210",
      "address": "123 Main St",
      "balance": "0.00"
    }
  ]
}
```

### `POST /api/customers/`
Create a new customer profile. Often called dynamically during the checkout process if the customer doesn't exist.

**Request Payload:**
```json
{
  "name": "Jane Smith",
  "phone": "9988776655",
  "address": "456 Market Road"
}
```

### `GET /api/customers/{id}/history/`
Retrieve all past invoices and estimates associated with a specific customer ID.

**Response (200 OK):**
```json
[
  {
    "invoice_id": 105,
    "date": "2026-04-30",
    "net_total": "125400.00",
    "type": "INVOICE"
  }
]
```
