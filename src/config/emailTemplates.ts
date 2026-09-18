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
  }
];

export const ALL_EMAIL_TEMPLATES: EmailTemplateItem[] = EMAIL_TEMPLATES_CATALOG.flatMap(c => c.items);
