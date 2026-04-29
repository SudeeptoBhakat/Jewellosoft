# Accounts & Authentication API

These endpoints handle user logins and the configuration of the Shop Profile.

---

### `POST /api/auth/token/`
Obtain a new JWT access and refresh token pair.

**Request Payload:**
```json
{
  "phone_number": "9876543210",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "refresh": "eyJhbGciOiJIUzI1Ni...",
  "access": "eyJhbGciOiJIUzI1Ni..."
}
```

---

### `POST /api/auth/token/refresh/`
Generate a new access token using a valid refresh token.

**Request Payload:**
```json
{
  "refresh": "eyJhbGciOiJIUzI1Ni..."
}
```

---

### `GET /api/accounts/shop/`
Retrieve the current shop profile settings.

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "JewelloSoft Gold",
  "address": "Main Market, City",
  "phone": "9876543210",
  "gst_number": "22AAAAA0000A1Z5",
  "pan_number": "AAAAA0000A",
  "watermark_logo_url": "/media/logos/watermark.png"
}
```

---

### `PUT /api/accounts/shop/`
Update the shop profile settings.

**Request Payload:**
Fields match the GET response. You can omit `watermark_logo_url` if not updating the image.

**Response (200 OK):**
Returns the updated Shop object.
