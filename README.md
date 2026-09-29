# FixMate

FixMate is a MERN home-services platform. Feature 1 is the role-based authentication foundation for homeowners and admins.

## Current feature

- Responsive signup and login experience for customer and admin roles
- Standard email/password signup with bcrypt hashing
- Email verification token flow through Nodemailer
- Google and Facebook provider endpoints with same-email account merging
- JWT sessions after verified login
- Customer dashboard with service categories, booking shortcuts, activity, and profile management
- Profile picture upload stored in Cloudinary and displayed as a user thumbnail
- Stripe-powered Free, Plus, and Pro pricing plans with webhook-confirmed access upgrades

## Run locally

1. Start MongoDB locally, or provide a hosted MongoDB connection string.
2. Copy `server/.env.example` to `server/.env` and fill in `MONGODB_URI`, `JWT_SECRET`, and SMTP values when email delivery is needed. Add the Cloudinary values for profile pictures.
3. Start the API in one terminal:

   ```bash
   cd server
   npm run dev
   ```

4. Start the client in another terminal:

   ```bash
   cd client
   npm run dev
   ```

The client runs at `http://localhost:5173` and the API health check is `http://localhost:5000/api/health`.

When SMTP is not configured, verification links are printed by the API as an email preview for local development. OAuth provider credentials must be added to `.env` before connecting Google or Facebook provider callbacks.

### Facebook signup

1. Create an app at [Meta for Developers](https://developers.facebook.com/) and add the **Facebook Login** product.
2. In Facebook Login settings, add this exact valid OAuth redirect URI:

   ```text
   http://localhost:5000/api/auth/facebook/callback
   ```

3. Copy the App ID and App Secret into `server/.env`:

   ```env
   FACEBOOK_APP_ID=your-facebook-app-id
   FACEBOOK_APP_SECRET=your-facebook-app-secret
   FACEBOOK_GRAPH_API_VERSION=v23.0
   ```

4. Restart the API after changing `.env`, then use the Facebook button on the signup page. Facebook users are created as verified customer accounts and redirected to the dashboard. The app requests `public_profile` only because some Meta app configurations reject the optional `email` scope; users without a returned email receive a stable internal account email based on their Facebook ID.

### Cloudinary profile pictures

Create a free Cloudinary account, then find the Cloud name, API Key, and API Secret in the Cloudinary dashboard. Add them to `server/.env`:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

The API stores uploaded images in the `fixmate/avatars` folder and saves the secure URL on the user record. Do not commit `.env` or expose the API secret in the client.

### Stripe payments

Create a Stripe account and use **test mode** while developing. Add the secret key to `server/.env`:

```env
STRIPE_SECRET_KEY=sk_test_your-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
```

For local webhook delivery, install the Stripe CLI, sign in, and run:

```bash
stripe listen --forward-to localhost:5000/api/payments/webhook
```

Copy the `whsec_...` value printed by the CLI into `STRIPE_WEBHOOK_SECRET`, then restart the API. Use Stripe's test card `4242 4242 4242 4242`, any future expiry date, and any three-digit CVC. The webhook upgrades the account only after Stripe confirms the checkout session.