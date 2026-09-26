export interface EmailTemplateItem {
  key: string;
  name: string;
  category: string;
  badge: string;
  badgeVariant?: 'lime' | 'amber' | 'rose' | 'zinc';
  subject: string;
  trigger: string;
  payload: string;
  defaults?: Record<string, any>;
}

export const EMAIL_TEMPLATES_CATALOG: { category: string; items: EmailTemplateItem[] }[] = [
  {
    category: '🛒 Abandoned Cart Recovery',
    items: [
      {
        key: 'customer_cart_abandoned_1',
        name: 'Abandoned Cart (1-Hour Reminder)',
        category: '🛒 Abandoned Cart Recovery',
        badge: 'Cart Saved',
        badgeVariant: 'amber',
        subject: 'Something was left in your bag...',
        trigger: 'Dispatched 1 hour after customer leaves checkout with unpurchased items.',
        payload: '{ "event": "customer_cart_abandoned_1", "recipient_email": "customer@gmail.com", "customer_first_name": "Alex" }',
        defaults: {
          customer_first_name: 'Alex',
          customer_email: 'alex@example.com',
          cart_token: 'mock_cart_token_98234',
          restore_url: 'https://exacoat.com/checkout/?restore_cart=mock_cart_token_98234',
          unsubscribe_url: 'https://exacoat.com/cart/?unsubscribe_cart=mock_cart_token_98234',
          items: [
            {
              name: 'iPhone 16 Pro Skins',
              image_url: 'https://exacoat.com/wp-content/uploads/Black-Camo-Texture-Thumbnail.jpg',
              quantity: 1,
              price: 'Rp 149.000',
              meta: 'Coverage: Model Cut\nTexture: Black Camo',
            },
          ],
          item_count: 1,
          subtotal: 'Rp 149.000',
          total: 'Rp 149.000',
          currency: 'IDR',
          sequence: '1',
        },
      },
      {
        key: 'customer_cart_abandoned_2',
        name: 'Abandoned Cart (24-Hour Final Reminder)',
        category: '🛒 Abandoned Cart Recovery',
        badge: 'Expiring Soon',
        badgeVariant: 'rose',
        subject: 'Before your cart clears...',
        trigger: 'Dispatched 24 hours after abandonment before the cart reservation expires.',
        payload: '{ "event": "customer_cart_abandoned_2", "recipient_email": "customer@gmail.com", "customer_first_name": "Alex" }',
        defaults: {
          customer_first_name: 'Alex',
          customer_email: 'alex@example.com',
          cart_token: 'mock_cart_token_98234',
          restore_url: 'https://exacoat.com/checkout/?restore_cart=mock_cart_token_98234',
          unsubscribe_url: 'https://exacoat.com/cart/?unsubscribe_cart=mock_cart_token_98234',
          items: [
            {
              name: 'iPhone 16 Pro Skins',
              image_url: 'https://exacoat.com/wp-content/uploads/Black-Camo-Texture-Thumbnail.jpg',
              quantity: 1,
              price: 'Rp 149.000',
              meta: 'Coverage: Model Cut\nTexture: Black Camo',
            },
          ],
          item_count: 1,
          subtotal: 'Rp 149.000',
          total: 'Rp 149.000',
          currency: 'IDR',
          sequence: '2',
        },
      },
    ],
  },
  {
    category: '📦 Orders & Fulfillment',
    items: [
      {
        key: 'customer_order_processing',
        name: 'Order Confirmed',
        category: '📦 Orders & Fulfillment',
        badge: 'Confirmed',
        badgeVariant: 'lime',
        subject: 'Your Exacoat order #{{order_number}} is confirmed',
        trigger: 'Dispatched when customer completes checkout and order enters processing stage.',
        payload: '{ "event": "customer_order_processing", "recipient_email": "customer@gmail.com", "order_number": "14589", "customer_first_name": "William" }',
        defaults: { order_number: '14589', customer_first_name: 'William' }
      },
      {
        key: 'customer_order_in_production',
        name: 'In Production',
        category: '📦 Orders & Fulfillment',
        badge: 'In Production',
        badgeVariant: 'amber',
        subject: 'Your Exacoat order #{{order_number}} is in production',
        trigger: 'Dispatched when order moves to custom precision-cut skin manufacturing.',
        payload: '{ "event": "customer_order_in_production", "recipient_email": "customer@gmail.com", "order_number": "14589", "customer_first_name": "William" }',
        defaults: { order_number: '14589', customer_first_name: 'William' }
      },
      {
        key: 'customer_order_awaiting_pickup',
        name: 'Ready to Ship',
        category: '📦 Orders & Fulfillment',
        badge: 'Ready to Ship',
        badgeVariant: 'amber',
        subject: 'Your Exacoat order #{{order_number}} is packaged and ready to ship',
        trigger: 'Dispatched when order is boxed, labeled, and awaiting courier pickup.',
        payload: '{ "event": "customer_order_awaiting_pickup", "recipient_email": "customer@gmail.com", "order_number": "14589", "customer_first_name": "William" }',
        defaults: { order_number: '14589', customer_first_name: 'William' }
      },
      {
        key: 'customer_order_shipped',
        name: 'Shipped (Tracking Dispatched)',
        category: '📦 Orders & Fulfillment',
        badge: 'Shipped',
        badgeVariant: 'lime',
        subject: 'Your Exacoat order #{{order_number}} is on its way',
        trigger: 'Dispatched when order is dispatched with courier tracking link.',
        payload: '{ "event": "customer_order_shipped", "recipient_email": "customer@gmail.com", "order_number": "14589", "customer_first_name": "William", "courier": "JNE Express", "tracking_number": "JNE9842194829" }',
        defaults: { order_number: '14589', customer_first_name: 'William', courier: 'JNE Express', tracking_number: 'JNE9842194829' }
      },
      {
        key: 'customer_order_completed',
        name: 'Delivered',
        category: '📦 Orders & Fulfillment',
        badge: 'Delivered',
        badgeVariant: 'lime',
        subject: 'Your Exacoat order #{{order_number}} has arrived',
        trigger: 'Dispatched when courier confirms delivery or order status is marked completed.',
        payload: '{ "event": "customer_order_completed", "recipient_email": "customer@gmail.com", "order_number": "14589", "customer_first_name": "William" }',
        defaults: { order_number: '14589', customer_first_name: 'William' }
      },
      {
        key: 'customer_order_store_pickup_ready',
        name: 'Store Pickup Ready (SMB)',
        category: '📦 Orders & Fulfillment',
        badge: 'Ready for Pickup',
        badgeVariant: 'amber',
        subject: '{{customer_first_name}}, your order (#{{order_number}}) is ready for pick up',
        trigger: 'Dispatched when store pickup order is packaged and ready at Exacoat Store Bekasi.',
        payload: '{ "event": "customer_order_store_pickup_ready", "recipient_email": "customer@gmail.com", "order_number": "14589", "customer_first_name": "William", "is_store_pickup": true, "pickup_ready": true, "shipping_total": "Rp 0", "shipping_method_name": "Store Pickup (Summarecon Bekasi)", "courier": "", "tracking_number": "" }',
        defaults: {
          order_number: '14589',
          customer_first_name: 'William',
          is_store_pickup: true,
          pickup_ready: true,
          shipping_total: 'Rp 0',
          shipping_method_name: 'Store Pickup (Summarecon Bekasi)',
          courier: '',
          tracking_number: '',
          tracking_url: '',
        }
      },
      {
        key: 'customer_order_store_pickup_completed',
        name: 'Store Pickup Completed',
        category: '📦 Orders & Fulfillment',
        badge: 'Picked Up',
        badgeVariant: 'lime',
        subject: '{{customer_first_name}}, your order has been picked up',
        trigger: 'Dispatched when customer picks up order at Exacoat Store Bekasi.',
        payload: '{ "event": "customer_order_store_pickup_completed", "recipient_email": "customer@gmail.com", "order_number": "14589", "customer_first_name": "William", "is_store_pickup": true, "pickup_review": true, "shipping_total": "Rp 0", "shipping_method_name": "Store Pickup (Summarecon Bekasi)", "courier": "", "tracking_number": "" }',
        defaults: {
          order_number: '14589',
          customer_first_name: 'William',
          is_store_pickup: true,
          pickup_review: true,
          shipping_total: 'Rp 0',
          shipping_method_name: 'Store Pickup (Summarecon Bekasi)',
          courier: '',
          tracking_number: '',
          tracking_url: '',
        }
      },
      {
        key: 'customer_order_refunded',
        name: 'Refund Processed',
        category: '📦 Orders & Fulfillment',
        badge: 'Refunded',
        badgeVariant: 'rose',
        subject: 'Refund confirmation for order #{{order_number}}',
        trigger: 'Dispatched when an order refund is processed.',
        payload: '{ "event": "customer_order_refunded", "recipient_email": "customer@gmail.com", "order_number": "14589", "customer_first_name": "William", "refund_amount": "Rp 189.000" }',
        defaults: { order_number: '14589', customer_first_name: 'William', refund_amount: 'Rp 189.000' }
      },
      {
        key: 'customer_order_on_hold',
        name: 'Order On Hold (Payment Pending)',
        category: '📦 Orders & Fulfillment',
        badge: 'On Hold',
        badgeVariant: 'amber',
        subject: 'Your Exacoat order #{{order_number}} is on hold',
        trigger: 'Dispatched when order is placed and awaiting payment confirmation or transfer verification.',
        payload: '{ "event": "customer_order_on_hold", "recipient_email": "customer@gmail.com", "order_number": "14589", "customer_first_name": "William" }',
        defaults: { order_number: '14589', customer_first_name: 'William' }
      },
      {
        key: 'customer_order_failed',
        name: 'Payment Failed',
        category: '📦 Orders & Fulfillment',
        badge: 'Payment Failed',
        badgeVariant: 'rose',
        subject: 'Payment incomplete for order #{{order_number}}',
        trigger: 'Dispatched when a customer payment attempt fails or expires.',
        payload: '{ "event": "customer_order_failed", "recipient_email": "customer@gmail.com", "order_number": "14589", "customer_first_name": "William" }',
        defaults: { order_number: '14589', customer_first_name: 'William' }
      },
      {
        key: 'customer_order_note',
        name: 'Order Update Note',
        category: '📦 Orders & Fulfillment',
        badge: 'Order Note',
        badgeVariant: 'zinc',
        subject: 'Update regarding your Exacoat order #{{order_number}}',
        trigger: 'Dispatched when support staff appends a customer-visible update note.',
        payload: '{ "event": "customer_order_note", "recipient_email": "customer@gmail.com", "order_number": "14589", "customer_first_name": "William", "customer_note": "Your custom device skin has completed precision-cut inspection." }',
        defaults: { order_number: '14589', customer_first_name: 'William', customer_note: 'Your custom device skin has completed precision-cut inspection.' }
      },
      {
        key: 'customer_order_invoice',
        name: 'Order Summary / Invoice Resend',
        category: '📦 Orders & Fulfillment',
        badge: 'Invoice Resend',
        badgeVariant: 'zinc',
        subject: 'Order summary for order #{{order_number}}',
        trigger: 'Dispatched when staff manually resends the order invoice or summary to the customer.',
        payload: '{ "event": "customer_order_invoice", "recipient_email": "customer@gmail.com", "order_number": "14589", "customer_first_name": "William" }',
        defaults: { order_number: '14589', customer_first_name: 'William' }
      }
    ]
  },
  {
    category: '⭐ Customer Reviews & Rewards',
    items: [
      {
        key: 'customer_order_review_invitation',
        name: 'Customer Review Invitation',
        category: '⭐ Customer Reviews & Rewards',
        badge: 'Review Invite',
        badgeVariant: 'zinc',
        subject: 'How is your new Exacoat skin? Review {{product_title}}',
        trigger: 'Dispatched after order delivery, inviting the customer to review their product and share photos.',
        payload: '{ "event": "customer_order_review_invitation", "recipient_email": "customer@gmail.com", "order_number": "14589", "customer_first_name": "William", "product_title": "iPhone 16 Pro Full Skin - Matrix Black" }',
        defaults: { order_number: '14589', customer_first_name: 'William', product_title: 'iPhone 16 Pro Full Skin - Matrix Black', review_url: 'https://exacoat.com/review?order_id=14589' }
      },
      {
        key: 'customer_order_review_reward',
        name: 'Customer Perks Reward Promo Code',
        category: '⭐ Customer Reviews & Rewards',
        badge: 'Perks Reward 🎁',
        badgeVariant: 'lime',
        subject: 'Your Exacoat perks promo code is here 🎁',
        trigger: 'Dispatched immediately when a customer submits a verified review with device photo.',
        payload: '{ "event": "customer_order_review_reward", "recipient_email": "customer@gmail.com", "customer_first_name": "William", "coupon_code": "EXAPERK-20-X8K9P", "discount_percent": "20", "expiry_date": "October 6, 2026" }',
        defaults: { customer_first_name: 'William', coupon_code: 'EXAPERK-20-X8K9P', discount_percent: '20', discount_amount: '20%', expiry_date: 'October 6, 2026', product_title: 'iPhone 16 Pro Full Skin - Matrix Black', shop_url: 'https://exacoat.com/shop/' }
      }
    ]
  },
  {
    category: '👤 Customer Account & Security',
    items: [
      {
        key: 'customer_reset_password',
        name: 'Customer Password Reset',
        category: '👤 Customer Account & Security',
        badge: 'Password Reset',
        badgeVariant: 'zinc',
        subject: 'Password reset request for Exacoat',
        trigger: 'Dispatched when a store customer requests a password reset link.',
        payload: '{ "event": "customer_reset_password", "recipient_email": "customer@gmail.com", "customer_first_name": "William", "reset_url": "https://exacoat.com/my-account/lost-password/?key=sample_key" }',
        defaults: { customer_first_name: 'William', reset_url: 'https://exacoat.com/my-account/lost-password/?key=sample_key' }
      },
      {
        key: 'customer_new_account',
        name: 'Customer Account Created (Welcome)',
        category: '👤 Customer Account & Security',
        badge: 'Account Created',
        badgeVariant: 'lime',
        subject: 'Welcome to Exacoat',
        trigger: 'Dispatched when a new customer registers an account on the store.',
        payload: '{ "event": "customer_new_account", "recipient_email": "customer@gmail.com", "customer_first_name": "William", "account_url": "https://exacoat.com/my-account" }',
        defaults: { customer_first_name: 'William', account_url: 'https://exacoat.com/my-account' }
      }
    ]
  },
  {
    category: '💳 Store Credit & Cashback',
    items: [
      {
        key: 'customer_cashback_earned',
        name: 'Cashback Credited (Store Credit)',
        category: '💳 Store Credit & Cashback',
        badge: 'Store Credit',
        badgeVariant: 'lime',
        subject: 'You received {{cashback_amount}} cashback on order #{{order_number}}',
        trigger: 'Dispatched immediately when an order earning cashback reaches completed status. Mentions 1-year validity period.',
        payload: '{ "event": "customer_cashback_earned", "recipient_email": "customer@gmail.com", "customer_first_name": "William", "order_number": "14589", "cashback_amount": "Rp 25.000", "store_credit_balance": "Rp 50.000", "expiry_date": "September 24, 2027", "shop_url": "https://exacoat.com/shop/" }',
        defaults: {
          customer_first_name: 'William',
          order_number: '14589',
          cashback_amount: 'Rp 25.000',
          store_credit_balance: 'Rp 50.000',
          expiry_date: 'September 24, 2027',
          shop_url: 'https://exacoat.com/shop/',
        }
      },
      {
        key: 'customer_store_credit_pre_expiry',
        name: 'Store Credit Pre-Expiry Alert (30 Days Left)',
        category: '💳 Store Credit & Cashback',
        badge: 'Expiring Soon',
        badgeVariant: 'amber',
        subject: 'Your {{store_credit_balance}} store credit expires in 30 days',
        trigger: 'Dispatched 335 days after issuance (30 days before 1-year expiry) to alert customer before credit lapses.',
        payload: '{ "event": "customer_store_credit_pre_expiry", "recipient_email": "customer@gmail.com", "customer_first_name": "William", "store_credit_balance": "Rp 50.000", "expiry_date": "October 24, 2027", "shop_url": "https://exacoat.com/shop/" }',
        defaults: {
          customer_first_name: 'William',
          store_credit_balance: 'Rp 50.000',
          expiry_date: 'October 24, 2027',
          shop_url: 'https://exacoat.com/shop/',
        }
      },
      {
        key: 'customer_store_credit_reminder',
        name: 'Store Credit Balance Reminder (7-Day Follow-Up)',
        category: '💳 Store Credit & Cashback',
        badge: 'Reminder',
        badgeVariant: 'amber',
        subject: 'You have {{store_credit_balance}} store credit waiting in your Exacoat account',
        trigger: 'Dispatched 7 days post-purchase to remind customer of their available balance while intent is high.',
        payload: '{ "event": "customer_store_credit_reminder", "recipient_email": "customer@gmail.com", "customer_first_name": "William", "store_credit_balance": "Rp 50.000", "expiry_date": "September 24, 2027", "shop_url": "https://exacoat.com/shop/" }',
        defaults: {
          customer_first_name: 'William',
          store_credit_balance: 'Rp 50.000',
          expiry_date: 'September 24, 2027',
          shop_url: 'https://exacoat.com/shop/',
        }
      }
    ]
  },
  {
    category: '🤝 Affiliate & Creator Program',
    items: [
      {
        key: 'creator_commission_available',
        name: 'Commission Available to Withdraw',
        category: '🤝 Affiliate & Creator Program',
        badge: 'Commission Available',
        badgeVariant: 'lime',
        subject: 'Commission Available: {commission_amount} from Order #{order_number}',
        trigger: 'Dispatched when an order commission clears the 7-day post-delivery grace period and becomes withdrawable.',
        payload: '{ "event": "creator_commission_available", "recipient_email": "creator@example.com", "creator_name": "Creator Partner", "commission_amount": "Rp 74.500", "order_number": "14890", "unpaid_balance": "Rp 324.500" }',
        defaults: {
          creator_name: 'Creator Partner',
          commission_amount: 'Rp 74.500',
          order_number: '14890',
          unpaid_balance: 'Rp 324.500',
          dashboard_url: 'https://exacoat.com/?portal=affiliate',
        },
      },
      {
        key: 'creator_commission_recorded',
        name: 'New Referral Sale Recorded',
        category: '🤝 Affiliate & Creator Program',
        badge: 'Referral Sale',
        badgeVariant: 'amber',
        subject: 'New Referral Sale Recorded: Order #{order_number}',
        trigger: 'Dispatched immediately when a customer completes an order using the creator referral link or coupon.',
        payload: '{ "event": "creator_commission_recorded", "recipient_email": "creator@example.com", "creator_name": "Creator Partner", "commission_amount": "Rp 74.500", "order_number": "14890" }',
        defaults: {
          creator_name: 'Creator Partner',
          commission_amount: 'Rp 74.500',
          order_number: '14890',
          unpaid_balance: 'Rp 250.000',
          dashboard_url: 'https://exacoat.com/?portal=affiliate',
        },
      },
      {
        key: 'creator_payout_requested',
        name: 'Creator Payout Request Received',
        category: '🤝 Affiliate & Creator Program',
        badge: 'Payout Requested',
        badgeVariant: 'amber',
        subject: 'Payout Request Received: {payout_amount}',
        trigger: 'Dispatched to creator when a payout withdrawal request is submitted and queued for finance processing.',
        payload: '{ "event": "creator_payout_requested", "recipient_email": "creator@example.com", "creator_name": "Creator Partner", "payout_amount": "Rp 500.000", "bank_name": "BCA", "bank_account_number": "8830192831" }',
        defaults: {
          creator_name: 'Creator Partner',
          payout_amount: 'Rp 500.000',
          bank_name: 'BCA',
          bank_account_number: '8830192831',
          bank_account_name: 'Creator Partner',
          dashboard_url: 'https://exacoat.com/?portal=affiliate',
        },
      },
      {
        key: 'creator_payout_transferred',
        name: 'Creator Payout Transferred',
        category: '🤝 Affiliate & Creator Program',
        badge: 'Payout Sent',
        badgeVariant: 'lime',
        subject: 'Payout Transferred: {payout_amount} sent to your bank account',
        trigger: 'Dispatched when a creator payout request is approved and funds are transferred via BCA or Mandiri.',
        payload: '{ "event": "creator_payout_transferred", "recipient_email": "creator@example.com", "creator_name": "Creator Partner", "payout_amount": "Rp 500.000", "bank_name": "BCA", "bank_account_number": "8830192831", "transfer_reference": "TRX-BCA-8921" }',
        defaults: {
          creator_name: 'Creator Partner',
          payout_amount: 'Rp 500.000',
          bank_name: 'BCA',
          bank_account_number: '8830192831',
          bank_account_name: 'Creator Partner',
          transfer_reference: 'TRX-BCA-8921',
          dashboard_url: 'https://exacoat.com/?portal=affiliate',
        },
      },
    ],
  }
];

export const ALL_EMAIL_TEMPLATES: EmailTemplateItem[] = EMAIL_TEMPLATES_CATALOG.flatMap(c => c.items);
