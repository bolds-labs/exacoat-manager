# TikTok Shop Scopes Setup and Authorization Guide

This guide explains how to fix the error:
> `Access denied. This app has not been granted any access scope required by this endpoint. Add a required scope to the app, reauthorize it, and retry with a new access token.`

---

## Why this error happens

TikTok Shop Open Platform requires your registered Partner Center application to have specific **OAuth API Scopes** enabled. 

When Exacoat attempts to discover your store's `shop_cipher`, it calls `GET /authorization/202309/shops`. This endpoint requires the scope **`seller.authorization.info`**. If this scope is missing from your app in Partner Center, or if your seller account authorized the app before this scope was added, TikTok returns this error.

Furthermore, order syncing and label printing also require **`seller.order.info`** and **`seller.fulfillment.basic`**.

---

## 3-Step Fix Walkthrough

### Step 1: Add Scopes in TikTok Shop Partner Center

1. Log in to [TikTok Shop Partner Center](https://partner.tiktokshop.com).
2. Go to **App & Service** > **My Services** (or **Custom App** / **App Management**).
3. Click your app:
   - **Service ID**: `7686433028542351124`
   - **App Key**: `6lauu7vv75n01`
4. In the app settings menu, navigate to **API & Permissions** or **Permissions** / **Scopes** (or click **Manage API** / **Categories**).
5. Ensure that the following permission categories / scopes are checked and enabled:

| Required Scope | API Category / Function | Purpose |
| :--- | :--- | :--- |
| **`seller.authorization.info`** | Shop Authorization | Allows retrieving the store's `shop_cipher` and shop details |
| **`seller.order.info`** | Order Management | Allows searching orders, viewing buyer address, items, and status |
| **`seller.fulfillment.basic`** | Fulfillment & Shipping | Allows marking orders shipped and downloading official A6 AWB PDF labels |
| **`seller.product.basic`** *(Optional)* | Product Management | Allows reading product SKU details and inventory levels |

6. Click **Save** / **Submit** to apply the permissions to your app.

---

### Step 2: Re-Authorize the TikTok Seller Account

> **Important**: Adding scopes to an existing app in Partner Center does not automatically grant them to existing tokens. You must generate a new access token by having the seller account re-authorize the app.

1. Open **Exacoat Manager** in your browser (`https://manager.exacoat.com`).
2. Navigate to **Orders** > **TikTok Shop**.
3. Click the **Settings** button (gear icon) in the top-right corner.
4. Click **Connect TikTok Shop** (or **Re-Authorize**):
   - Direct link: [TikTok Partner Authorization](https://services.tiktokshop.com/open/authorize?service_id=7686433028542351124)
5. Log in with your **Exacoat TikTok Shop seller account**.
6. Review the requested permissions on the consent screen:
   - Shop Information
   - Order Management
   - Fulfillment & Shipping
7. Click **Authorize**.
8. A popup confirms that TikTok Shop is connected, and the window closes automatically.

---

### Step 3: Verify and Sync Orders

1. When re-authorization completes, Exacoat automatically calls the authorized shops endpoint with your new token.
2. The official `shop_cipher` (e.g. `ROW_...`) is automatically detected and stored in the WordPress database.
3. In **Orders** > **TikTok Shop**, click **Sync Orders**.
4. Live orders will now sync and display in your orders dashboard without errors.

---

## Alternative: Manual Shop Cipher Entry

If you already have your exact `shop_cipher` from a previous API test or TikTok support:
1. Open **Orders** > **TikTok Shop** > **Settings**.
2. Paste the cipher into the **Shop Cipher** field.
3. Click **Save API Configuration**.

*(Note: Even with a manual cipher, your app in Partner Center still requires `seller.order.info` to fetch orders, so completing Step 1 and Step 2 is recommended.)*
