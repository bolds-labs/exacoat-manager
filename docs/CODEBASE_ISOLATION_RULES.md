# Exacoat Codebase Isolation & Reference Adaptation Rules

## Overview & Core Mandate

**Artmatter is strictly an external reference implementation, never a direct source to copy verbatim.**

When developing features for Exacoat (both in `exacoat-manager` and `wordpress-plugin/exacoat-core`), any pattern, algorithm, or component borrowed from Artmatter must be completely adapted, rebranded, and isolated before inclusion in this codebase.

---

## 1. Zero Artmatter Leak Policy

No Artmatter constants, classes, textdomains, table names, or URLs may exist in Exacoat production code. Every ported feature must follow this strict mapping:

### Constants Mapping
| Reference (Forbidden in Exacoat) | Correct Exacoat Constant |
| :--- | :--- |
| `ARTMATTER_CORE_FILE` | `EXACOAT_CORE_FILE` |
| `ARTMATTER_CORE_PATH` | `EXACOAT_CORE_PATH` |
| `ARTMATTER_CORE_URL` | `EXACOAT_CORE_URL` |
| `ARTMATTER_CORE_VERSION` | `EXACOAT_CORE_VERSION` |
| `ARTMATTER_WEB_URL` | `EXACOAT_WEB_URL` |
| `ARTMATTER_MEDIA_URL` | `EXACOAT_MEDIA_URL` |

### PHP Namespaces & Classes
| Reference (Forbidden in Exacoat) | Correct Exacoat Class |
| :--- | :--- |
| `Artmatter_Core` | `Exacoat_Core` |
| `Artmatter_Logger` | `Exacoat_Logger` |
| `Artmatter_Store_Enhancements` | `Exacoat_Store_Enhancements` |
| `Artmatter_Review_Manager` | `Exacoat_Review_Manager` |
| `Artmatter_Checkout_Engine` | `Exacoat_Checkout_Engine` |
| `Artmatter_Shipping_Tracker` | `Exacoat_Shipping_Tracker` |
| `Artmatter_Diagnostics` | `Exacoat_Diagnostics` |
| `Artmatter_Pushover_Service` | `Exacoat_Pushover_Service` |
| `Artmatter_Email_Engine` | `Exacoat_Email_Engine` |
| `Artmatter_Biteship_Engine` | `Exacoat_Biteship_Engine` |

### WordPress & Database Artifacts
| Artifact Type | Reference | Correct Exacoat Standard |
| :--- | :--- | :--- |
| **Plugin Slug** | `artmatter-core` | `exacoat-core` |
| **Text Domain** | `'artmatter-core'` | `'exacoat-core'` |
| **REST Namespace** | `artmatter-core/v1` | `exacoat-core/v1` |
| **Database Tables** | `wp_artmatter_logs`, etc. | `wp_exacoat_logs`, etc. |
| **Option Keys** | `artmatter_core_*` | `exacoat_core_*` |
| **HTTP Request Headers** | `X-Artmatter-*` | `X-Exacoat-*` |
| **CSS / JS Enqueue Handles** | `artmatter-*` | `exacoat-*` |
| **Client Domains** | `artmatter.co` | `exacoat.com` |

---

## 2. Defensive Constant Fallbacks

To protect against unexpected fatal errors on WordPress frontend if an older template or cache references a legacy constant, `exacoat-core.php` defines fallback aliases right after defining `EXACOAT_CORE_*`:

```php
// Safety Fallbacks for legacy references to prevent fatal undefined constant crashes
if ( ! defined( 'ARTMATTER_CORE_FILE' ) ) {
    define( 'ARTMATTER_CORE_FILE', EXACOAT_CORE_FILE );
}
if ( ! defined( 'ARTMATTER_CORE_PATH' ) ) {
    define( 'ARTMATTER_CORE_PATH', EXACOAT_CORE_PATH );
}
if ( ! defined( 'ARTMATTER_CORE_URL' ) ) {
    define( 'ARTMATTER_CORE_URL', EXACOAT_CORE_URL );
}
if ( ! defined( 'ARTMATTER_CORE_VERSION' ) ) {
    define( 'ARTMATTER_CORE_VERSION', EXACOAT_CORE_VERSION );
}
if ( ! defined( 'ARTMATTER_WEB_URL' ) ) {
    define( 'ARTMATTER_WEB_URL', EXACOAT_WEB_URL );
}
```

These definitions act as safety nets, but all actual code inside `includes/` must natively call `EXACOAT_CORE_*`.

---

## 3. Pre-Commit Verification Checklist

Before pushing any commit or releasing a plugin archive:

1. **Bare Constant Scan**:
   Run ripgrep to ensure no bare `ARTMATTER_` constant is called directly without a prior `defined( 'EXACOAT_...' )` check:
   ```bash
   grep -rn "ARTMATTER_CORE_" wordpress-plugin/exacoat-core/includes/
   ```
   *Expectation: 0 direct unguarded calls.*

2. **Text Domain Scan**:
   Ensure all translation strings use the correct text domain:
   ```bash
   grep -rn "'artmatter-core'" wordpress-plugin/exacoat-core/
   ```
   *Expectation: 0 matches.*

3. **PHP Lint Check**:
   Verify clean PHP syntax across all plugin files:
   ```bash
   php -l wordpress-plugin/exacoat-core/exacoat-core.php
   ```

4. **Build & Package**:
   Run `npm run build` to compile TypeScript, build Vite client, and generate release zips.
