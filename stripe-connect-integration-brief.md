# Stripe Connect Integration Brief

## Project Overview

**Platform**: Poker tournament ticket resale marketplace  
**Payout Model**: Manual payouts controlled by platform admin  
**Backend**: Supabase (PostgreSQL + Edge Functions)

---

## Transaction Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TRANSACTION FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. PURCHASE                                                                 │
│     ├── Buyer selects ticket                                                │
│     ├── Buyer provides identity (name, DOB, casino alias)                   │
│     ├── Buyer pays via Stripe (ticket price + 8% platform fee)              │
│     └── Ticket status → "pending" (reserved)                                │
│                                                                              │
│  2. CASINO VERIFICATION (24-hour deadline)                                  │
│     ├── Casino partner reviews buyer/seller identity                        │
│     ├── Casino approves → Transaction finalizes                             │
│     │   ├── Seller wallet credited                                          │
│     │   ├── Platform fee recorded                                           │
│     │   ├── Venue fee recorded (if applicable)                              │
│     │   └── Ticket status → "sold"                                          │
│     └── Casino declines → Ticket reverts to "available"                     │
│                                                                              │
│  3. PAYOUT REQUEST                                                          │
│     ├── Seller requests payout from wallet balance                          │
│     ├── Payout enters "pending" status                                      │
│     └── Admin reviews in dashboard                                          │
│                                                                              │
│  4. PAYOUT EXECUTION                                                        │
│     ├── Admin approves → Stripe Transfer to seller's connected account     │
│     ├── Payout status → "completed"                                         │
│     └── Wallet balance decremented                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Stripe Connect Requirements

### Account Type
- **Recommended**: Stripe Connect Express
- Simplified onboarding for sellers
- Stripe handles identity verification and tax reporting
- Platform controls payout timing

### Seller Onboarding Flow
1. Seller clicks "Connect Stripe Account" in their dashboard
2. Redirect to Stripe Connect onboarding
3. Seller completes identity verification
4. Stripe account ID stored in database
5. Seller can now receive payouts

### Payment Capture
- Use **PaymentIntents** with `capture_method: 'manual'` OR
- Use standard capture and hold funds in platform account
- Funds released only after casino verification passes

### Payout Control
- **CRITICAL**: Disable automatic payouts to connected accounts
- Platform maintains internal wallet/ledger system
- Admin manually triggers Stripe Transfers on approval
- Use `stripe.transfers.create()` when admin clicks "Complete Payout"

---

## Fee Structure

| Fee Type | Percentage | Recipient | Notes |
|----------|------------|-----------|-------|
| Platform Service Fee | 8% | Platform | Charged to buyer on top of ticket price |
| Venue/Casino Fee | 10-20% | Casino Partner | Deducted from seller proceeds, configurable per organization |

### Example Transaction
- Ticket price: $1,000
- Platform fee (8%): $80 (paid by buyer)
- Buyer total: $1,080
- Venue fee (10%): $100 (deducted from seller)
- Seller receives: $900

---

## Existing Database Schema

### Key Tables

```sql
-- Seller wallet balances
wallets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  balance integer NOT NULL DEFAULT 0,  -- stored in cents
  currency text DEFAULT 'USD'
)

-- Transaction ledger
transactions (
  id uuid PRIMARY KEY,
  user_id uuid,
  type enum ('sale', 'payout', 'fee', 'refund'),
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  reference_id uuid,
  reference_type text,
  description text
)

-- Payout requests
payouts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  amount integer NOT NULL,  -- in cents
  status enum ('pending', 'processing', 'completed', 'failed', 'cancelled'),
  method text NOT NULL,
  method_details jsonb,
  requested_at timestamp,
  processed_at timestamp,
  completed_at timestamp,
  notes text
)

-- Platform earnings (service fees)
platform_earnings (
  id uuid PRIMARY KEY,
  amount integer NOT NULL,
  source text,
  reference_id uuid,
  reference_type text
)

-- Casino/venue earnings
organization_earnings (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  amount integer NOT NULL,
  source text,
  reference_id uuid
)

-- User profiles (add stripe_account_id here)
profiles (
  id uuid PRIMARY KEY,
  username text,
  email text,
  stripe_account_id text  -- NEW: Connected account ID
)
```

---

## Integration Points

### 1. Seller Onboarding (New Edge Function)
```
POST /functions/v1/stripe-connect-onboard
- Creates Stripe Connect account link
- Returns URL for seller to complete onboarding
```

### 2. Onboarding Callback (New Edge Function)
```
GET /functions/v1/stripe-connect-callback
- Handles return from Stripe onboarding
- Stores stripe_account_id in profiles table
```

### 3. Payment Processing (New Edge Function)
```
POST /functions/v1/create-checkout
- Creates Stripe PaymentIntent/Checkout Session
- Includes ticket price + platform fee
```

### 4. Payment Webhook (New Edge Function)
```
POST /functions/v1/stripe-webhook
- Handles payment_intent.succeeded
- Triggers existing purchase flow
```

### 5. Execute Payout (Modify Existing Admin Flow)
```
POST /functions/v1/execute-payout
- Called when admin approves payout
- Creates Stripe Transfer to connected account
- Updates payout status to 'completed'
```

---

## Admin Dashboard Integration

### Current Payout Flow
Admin dashboard already has:
- View pending payout requests
- Approve/decline buttons
- Status tracking (pending → processing → completed)

### Required Changes
1. On "Approve" click → Call edge function to execute Stripe Transfer
2. Display seller's Stripe connection status
3. Show transfer ID after successful payout

---

## Webhook Events to Handle

| Event | Action |
|-------|--------|
| `payment_intent.succeeded` | Create purchase record, trigger casino verification |
| `payment_intent.payment_failed` | Notify buyer, revert ticket to available |
| `account.updated` | Update seller's Stripe account status |
| `transfer.created` | Log successful payout transfer |
| `transfer.failed` | Mark payout as failed, notify admin |

---

## Security Considerations

1. **Stripe Secret Key**: Store in Supabase secrets, never expose client-side
2. **Webhook Signature**: Verify all incoming webhooks with signing secret
3. **Connected Account Verification**: Check account status before allowing payouts
4. **Idempotency**: Use idempotency keys for all Stripe API calls

---

## Environment Variables Needed

```
STRIPE_SECRET_KEY=sk_live_xxx        # Platform's Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_xxx      # Webhook signing secret
STRIPE_CONNECT_CLIENT_ID=ca_xxx      # For OAuth Connect flow (if using)
```

---

## Testing Checklist

- [ ] Seller can connect Stripe account
- [ ] Buyer can complete checkout
- [ ] Payment webhook updates purchase record
- [ ] Casino can approve/decline verification
- [ ] Seller wallet balance updates correctly
- [ ] Seller can request payout
- [ ] Admin can approve payout
- [ ] Stripe Transfer executes successfully
- [ ] Payout status updates to completed
- [ ] Failed transfers handled gracefully

---

## Questions for Developer

1. Prefer Stripe Connect Express or Standard accounts?
2. Use Stripe Checkout or custom PaymentIntent flow?
3. Hold funds via manual capture or platform balance?
4. Need refund handling for declined verifications?

---

## Contact

For questions about existing codebase or database schema, refer to:
- `src/pages/AdminDashboard.tsx` - Admin payout management
- `src/pages/Checkout.tsx` - Current checkout flow
- `supabase/functions/` - Existing edge functions
