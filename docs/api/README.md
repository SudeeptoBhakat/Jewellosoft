# REST API Reference

The JewelloSoft backend exposes a local REST API built using Django REST Framework (DRF). The React frontend communicates exclusively through these endpoints.

## Base URL
When running locally or bundled in production, the API is available at:
```text
http://localhost:8000/api/
```

## Authentication
All endpoints (except login) require JWT (JSON Web Token) authentication. You must include the token in the HTTP `Authorization` header.

**Header Format:**
```text
Authorization: Bearer <your_access_token>
```

If a token is expired or invalid, the API will return a `401 Unauthorized` response.

## Standard Responses

### Success
Standard GET requests return paginated JSON objects if they list multiple items.
```json
{
  "count": 142,
  "next": "http://localhost:8000/api/inventory/items/?page=2",
  "previous": null,
  "results": [
    { ... }
  ]
}
```

### Errors
If a request fails validation, the API returns a `400 Bad Request` with a standard error dictionary indicating the field at fault.
```json
{
  "weight": ["This field must be a positive number."],
  "huid": ["Item with this HUID already exists."]
}
```

## API Modules

The API documentation is broken down into specific operational areas:

- [Accounts & Auth](./accounts-and-auth.md)
- [Billing & Rates](./billing-and-rates.md)
- [Inventory & Customers](./inventory-and-customers.md)
