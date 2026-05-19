# Auth API Reference & Integration Guide

This guide details the authentication subsystem, designed to allow frontend integration for signup, verification, and session persistence using **Bearer Tokens** and/or **HTTP-Only Cookies**.

All authentication routes are prefixed with `/api/auth`.

---

## 🛠️ Authentication Flows

### 1. User Registration / Sign Up
* **Endpoint:** `POST /api/auth/register`
* **Access:** Public
* **Payload:**
  ```json
  {
    "username": "gamer_99",
    "email": "user@example.com",
    "password": "Password123!",
    "birthdate": "2000-01-01"
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Registration successful! Verification code sent to user@example.com"
  }
  ```
* **Process Flow:** Saves user as `isVerified: false` and generates a 6-digit OTP code sent via SMTP (falls back to terminal console if SMTP is unconfigured or fails).

---

### 2. Verify OTP
* **Endpoint:** `POST /api/auth/verify-otp`
* **Access:** Public
* **Payload:**
  ```json
  {
    "email": "user@example.com",
    "otp": "123456"
  }
  ```
* **Success Response (200 OK):**
  Sets an HTTP-only secure cookie named `token` and returns:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "603d29a...",
      "username": "gamer_99",
      "displayName": "gamer_99",
      "email": "user@example.com",
      "avatar": "",
      "systemStatus": "online",
      "userStatusPreference": "online"
    }
  }
  ```

---

### 3. Resend OTP
* **Endpoint:** `POST /api/auth/resend-otp`
* **Access:** Public
* **Payload:**
  ```json
  {
    "email": "user@example.com"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "New verification code sent to user@example.com"
  }
  ```

---

### 4. User Login
* **Endpoint:** `POST /api/auth/login`
* **Access:** Public
* **Payload:**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
* **Success Response (200 OK):**
  Sets an HTTP-only secure cookie named `token` and returns:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "603d29a...",
      "username": "gamer_99",
      "displayName": "gamer_99",
      "email": "user@example.com",
      "avatar": "",
      "systemStatus": "online",
      "userStatusPreference": "online"
    }
  }
  ```

---

### 5. Logout
* **Endpoint:** `POST /api/auth/logout`
* **Access:** Public
* **Payload:** None
* **Success Response (200 OK):**
  Clears the cookie named `token`.
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```

---

### 6. Get Current User Profile
* **Endpoint:** `GET /api/auth/me`
* **Access:** Private (Requires Authorization Header OR `token` Cookie)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "user": {
      "_id": "603d29a...",
      "username": "gamer_99",
      "displayName": "gamer_99",
      "email": "user@example.com",
      "avatar": "",
      "systemStatus": "online",
      "userStatusPreference": "online"
    }
  }
  ```

---

### 7. Get All Verified Users (Directory)
* **Endpoint:** `GET /api/auth/users`
* **Access:** Private (Requires Authorization Header OR `token` Cookie)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "users": [
      {
        "_id": "603d29b...",
        "username": "another_user",
        "displayName": "another_user",
        "avatar": "",
        "systemStatus": "online",
        "userStatusPreference": "online"
      }
    ]
  }
  ```

---

## 🔑 Client Integration Guidelines

To make requests to protected routes, the frontend developer can choose between two methods:

### Option A: Cookie-Based Authentication (Recommended for Browsers)
Since the server automatically sets the `token` cookie upon verification/login, the browser will automatically include this cookie in subsequent requests. 
> [!IMPORTANT]
> The frontend developer **must** include the credentials flag in their requests.
> * For `fetch`: `{ credentials: 'include' }`
> * For `axios`: `axios.defaults.withCredentials = true`

### Option B: Bearer Header Authentication (Recommended for mobile or decoupled clients)
If storing the token in `localStorage`, retrieve the `token` field from the response payload of `/verify-otp` or `/login` and send it as a header:
`Authorization: Bearer <token>`
