# Billing & Rates API

These endpoints handle the core financial transactions, generating estimates, and maintaining the daily metal market rates.

## Rates

### `GET /api/rates/`
Retrieve the latest saved Gold and Silver rates, as well as the default making charges.

**Response (200 OK):**
```json
{
  "id": 1,
  "date": "2026-04-30",
  "rate_22k": "68000.00",
  "rate_24k": "72000.00",
  "rate_silver": "8500.00",
  "default_making_charge_type": "PERCENTAGE",
  "default_making_charge_value": "8.00"
}
```

### `POST /api/rates/`
Update today's rates. The backend will either create a new record for the day or update the existing one.

**Request Payload:**
```json
{
  "rate_22k": "68500.00",
  "rate_24k": "72500.00",
  "rate_silver": "8600.00",
  "default_making_charge_type": "FLAT",
  "default_making_charge_value": "450.00"
}
```

---

## Billing

### `GET /api/billing/invoices/`
List all historical invoices with pagination. Supports query parameters for filtering by customer or date range.

**Response (200 OK):**
```json
{
  "count": 50,
  "results": [
    {
      "id": 105,
      "invoice_number": "INV-2026-105",
      "customer_name": "John Doe",
      "net_total": "125400.00",
      "date": "2026-04-30"
    }
  ]
}
```

### `POST /api/billing/invoices/`
Create a new estimate or invoice. This is a complex nested payload that creates the main billing record, deducts old metal, links items, and records payments.

**Request Payload:**
```json
{
  "type": "INVOICE",
  "customer_id": 42,
  "items": [
    {
      "inventory_item_id": 8,
      "weight": "12.450",
      "making_charge": "4500.00",
      "total": "92500.00"
    }
  ],
  "old_metal": {
    "description": "Old Gold Ring",
    "value_deducted": "15000.00"
  },
  "taxes": {
    "sgst": "1.5",
    "cgst": "1.5"
  },
  "payments": [
    {
      "mode": "UPI",
      "amount": "80000.00"
    }
  ],
  "net_total": "80000.00"
}
```

### `GET /api/billing/invoices/{id}/pdf/`
Generates and returns the URL or Base64 string for the compiled A4 PDF receipt. 

**Response (200 OK):**
```json
{
  "pdf_url": "/media/invoices/INV-2026-105.pdf"
}
```
