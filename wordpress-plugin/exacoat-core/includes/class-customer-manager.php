<?php
/**
 * Exacoat Customer & User Analytics Manager
 * 
 * High-performance database aggregation engine for Exacoat Manager ERP.
 * Seamlessly handles 65,000+ registered WordPress users and 18,000+ WooCommerce orders,
 * supporting HPOS, WooCommerce Analytics lookup tables, and classic CPT storage.
 * 
 * Provides:
 * - Instant storewide customer analytics (AOV, LTV, repeat rates, top spenders)
 * - Server-side paginated customer directory with live search and filter tabs
 * - Inactive user detection (users with no orders or logins in 2+ years)
 * - Single customer profile & full order history drilldown
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Exacoat_Customer_Manager' ) ) {

class Exacoat_Customer_Manager {

	private const SUMMARY_CACHE_KEY = 'exacoat_customer_analytics_summary_v2';
	private const SUMMARY_CACHE_TTL = 300; // 5 minutes

	private const EXCLUDED_EMAILS = [
		'exaorder@gmail.com',
		'orderexa@gmail.com',
		'order@exacoat.com',
	];

	/**
	 * Get list of excluded internal bridge/test emails
	 */
	public static function get_excluded_emails(): array {
		return self::EXCLUDED_EMAILS;
	}

	/**
	 * Get all valid paid order statuses across standard WooCommerce and custom fulfillment states
	 */
	public static function get_paid_order_statuses(): array {
		return [
			'wc-processing', 'wc-completed', 'wc-in-production', 'wc-quality-check',
			'wc-awaiting-pickup', 'wc-preparing-order', 'wc-ready-to-ship', 'wc-smb-ready',
			'wc-smb-picked', 'wc-shipped', 'processing', 'completed', 'in-production',
			'quality-check', 'awaiting-pickup', 'preparing-order', 'ready-to-ship',
			'smb-ready', 'smb-picked', 'shipped',
		];
	}

	/**
	 * Generate SQL clause to exclude internal bridge emails
	 */
	private static function get_excluded_emails_sql( string $column ): string {
		$escaped = array_map( function( $email ) {
			return "'" . esc_sql( strtolower( trim( $email ) ) ) . "'";
		}, self::EXCLUDED_EMAILS );
		return "LOWER(TRIM({$column})) NOT IN (" . implode( ',', $escaped ) . ")";
	}

	public static function init(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );
	}

	public static function register_rest_routes(): void {
		$namespaces = [ 'exacoat-core/v1', 'artmatter-core/v1' ];

		foreach ( $namespaces as $ns ) {
			register_rest_route( $ns, '/customers', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_get_customers' ],
				'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
			] );

			register_rest_route( $ns, '/customers/summary', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_get_summary' ],
				'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
			] );

			register_rest_route( $ns, '/customers/inactive-preview', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_get_inactive_preview' ],
				'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
			] );

			register_rest_route( $ns, '/customers/(?P<id_or_email>[a-zA-Z0-9_.+@-]+)', [
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_get_customer_detail' ],
				'permission_callback' => [ 'Exacoat_Core', 'verify_bridge_permission' ],
			] );
		}
	}

	/**
	 * Detect active storage architecture (HPOS vs Analytics Lookup vs Classic CPT)
	 */
	public static function get_storage_mode(): string {
		global $wpdb;
		$hpos_table = "{$wpdb->prefix}wc_orders";
		if ( $wpdb->get_var( "SHOW TABLES LIKE '{$hpos_table}'" ) === $hpos_table ) {
			return 'hpos';
		}

		$lookup_table = "{$wpdb->prefix}wc_customer_lookup";
		$stats_table  = "{$wpdb->prefix}wc_order_stats";
		if ( $wpdb->get_var( "SHOW TABLES LIKE '{$lookup_table}'" ) === $lookup_table &&
		     $wpdb->get_var( "SHOW TABLES LIKE '{$stats_table}'" ) === $stats_table ) {
			return 'lookup';
		}

		return 'classic';
	}

	/**
	 * GET /customers/summary
	 * Storewide analytics across 65k users and 18k orders
	 */
	public static function rest_get_summary( WP_REST_Request $request ) {
		$force_refresh = (bool) $request->get_param( 'refresh' );
		if ( ! $force_refresh ) {
			$cached = get_transient( self::SUMMARY_CACHE_KEY );
			if ( is_array( $cached ) && ! empty( $cached ) ) {
				return rest_ensure_response( array_merge( [ 'success' => true, 'from_cache' => true ], $cached ) );
			}
		}

		$summary = self::compute_storewide_summary();
		set_transient( self::SUMMARY_CACHE_KEY, $summary, self::SUMMARY_CACHE_TTL );

		return rest_ensure_response( array_merge( [ 'success' => true, 'from_cache' => false ], $summary ) );
	}

	/**
	 * Compute storewide metrics via direct SQL
	 */
	public static function compute_storewide_summary(): array {
		global $wpdb;

		// 1. Total registered WordPress users (excluding internal bridge emails)
		$excluded_users_u_sql = self::get_excluded_emails_sql( 'u.user_email' );
		$total_registered_users = (int) $wpdb->get_var( "SELECT COUNT(u.ID) FROM {$wpdb->users} u WHERE {$excluded_users_u_sql}" );

		// 2. Inactive Users (> 2 years without orders or activity)
		$two_years_ago = gmdate( 'Y-m-d H:i:s', strtotime( '-2 years' ) );
		$mode = self::get_storage_mode();

		$inactive_2yr_users = 0;
		$total_revenue      = 0.0;
		$total_orders       = 0;
		$paying_customers   = 0;
		$repeat_customers   = 0;
		$top_customers      = [];

		$valid_statuses = self::get_paid_order_statuses();
		$status_placeholders = implode( ',', array_fill( 0, count( $valid_statuses ), '%s' ) );

		$excluded_orders_sql   = self::get_excluded_emails_sql( 'billing_email' );
		$excluded_orders_o_sql = self::get_excluded_emails_sql( 'o.billing_email' );

		if ( 'hpos' === $mode ) {
			$orders_table = "{$wpdb->prefix}wc_orders";

			// Revenue & Orders count (excluding internal bridge emails)
			$rev_sql = $wpdb->prepare(
				"SELECT COUNT(id) as total_orders, COALESCE(SUM(total_amount), 0) as total_revenue 
				 FROM {$orders_table} 
				 WHERE status IN ({$status_placeholders})
				   AND {$excluded_orders_sql}",
				...$valid_statuses
			);
			$rev_row = $wpdb->get_row( $rev_sql, ARRAY_A );
			$total_orders  = (int) ( $rev_row['total_orders'] ?? 0 );
			$total_revenue = (float) ( $rev_row['total_revenue'] ?? 0.0 );

			// Unique paying customers & repeat count (excluding internal bridge emails)
			$cust_sql = $wpdb->prepare(
				"SELECT 
					COUNT(id) as order_count,
					LOWER(TRIM(billing_email)) as email
				 FROM {$orders_table}
				 WHERE status IN ({$status_placeholders})
				   AND billing_email IS NOT NULL AND billing_email != ''
				   AND {$excluded_orders_sql}
				 GROUP BY LOWER(TRIM(billing_email))",
				...$valid_statuses
			);
			$cust_rows = $wpdb->get_results( $cust_sql, ARRAY_A ) ?: [];
			$paying_customers = count( $cust_rows );
			foreach ( $cust_rows as $row ) {
				if ( (int) $row['order_count'] >= 2 ) {
					$repeat_customers++;
				}
			}

			// Inactive 2+ years: registered users with no orders in last 2 years (excluding internal bridge emails)
			$inactive_sql = $wpdb->prepare(
				"SELECT COUNT(u.ID) FROM {$wpdb->users} u
				 WHERE u.user_registered < %s
				   AND {$excluded_users_u_sql}
				   AND LOWER(TRIM(u.user_email)) NOT IN (
					 SELECT DISTINCT LOWER(TRIM(billing_email)) 
					 FROM {$orders_table} 
					 WHERE date_created_gmt >= %s 
					   AND billing_email IS NOT NULL AND billing_email != ''
					   AND {$excluded_orders_sql}
				   )",
				$two_years_ago,
				$two_years_ago
			);
			$inactive_2yr_users = (int) $wpdb->get_var( $inactive_sql );

			// Top 5 spenders (excluding internal bridge emails)
			$top_sql = $wpdb->prepare(
				"SELECT 
					LOWER(TRIM(o.billing_email)) as email,
					MAX(o.customer_id) as user_id,
					COUNT(o.id) as orders_count,
					COALESCE(SUM(o.total_amount), 0) as total_spent,
					MAX(o.date_created_gmt) as last_order_date
				 FROM {$orders_table} o
				 WHERE o.status IN ({$status_placeholders})
				   AND o.billing_email IS NOT NULL AND o.billing_email != ''
				   AND {$excluded_orders_o_sql}
				 GROUP BY LOWER(TRIM(o.billing_email))
				 ORDER BY total_spent DESC
				 LIMIT 5",
				...$valid_statuses
			);
			$top_rows = $wpdb->get_results( $top_sql, ARRAY_A ) ?: [];

			// Enrich top spenders with names
			$addr_table = "{$wpdb->prefix}wc_order_addresses";
			$has_addr = ( $wpdb->get_var( "SHOW TABLES LIKE '{$addr_table}'" ) === $addr_table );

			foreach ( $top_rows as $top ) {
				$name = '';
				if ( (int) $top['user_id'] > 0 ) {
					$u = get_userdata( (int) $top['user_id'] );
					if ( $u ) {
						$fn = get_user_meta( $u->ID, 'first_name', true );
						$ln = get_user_meta( $u->ID, 'last_name', true );
						$name = trim( "{$fn} {$ln}" ) ?: $u->display_name;
					}
				}
				if ( empty( $name ) && $has_addr ) {
					$addr_row = $wpdb->get_row( $wpdb->prepare(
						"SELECT first_name, last_name FROM {$addr_table} WHERE email = %s AND address_type = 'billing' ORDER BY id DESC LIMIT 1",
						$top['email']
					), ARRAY_A );
					if ( $addr_row ) {
						$name = trim( ( $addr_row['first_name'] ?? '' ) . ' ' . ( $addr_row['last_name'] ?? '' ) );
					}
				}
				if ( empty( $name ) ) {
					$name = explode( '@', $top['email'] )[0];
				}

				$spent  = (float) $top['total_spent'];
				$orders = (int) $top['orders_count'];
				$aov    = $orders > 0 ? round( $spent / $orders, 2 ) : 0.0;

				$top_customers[] = [
					'id'              => (int) $top['user_id'],
					'email'           => $top['email'],
					'name'            => $name,
					'orders_count'    => $orders,
					'total_spent'     => $spent,
					'avg_order_value' => $aov,
					'last_order_date' => $top['last_order_date'],
				];
			}

		} elseif ( 'lookup' === $mode ) {
			// WooCommerce Analytics Lookup Table
			$stats_table  = "{$wpdb->prefix}wc_order_stats";
			$lookup_table = "{$wpdb->prefix}wc_customer_lookup";
			$excluded_cust_c_sql = self::get_excluded_emails_sql( 'c.email' );

			$rev_row = $wpdb->get_row( $wpdb->prepare(
				"SELECT COUNT(s.order_id) as total_orders, COALESCE(SUM(s.total_sales), 0) as total_revenue
				 FROM {$stats_table} s
				 LEFT JOIN {$lookup_table} c ON s.customer_id = c.customer_id
				 WHERE s.status IN ({$status_placeholders})
				   AND (c.email IS NULL OR {$excluded_cust_c_sql})",
				...$valid_statuses
			), ARRAY_A );
			$total_orders  = (int) ( $rev_row['total_orders'] ?? 0 );
			$total_revenue = (float) ( $rev_row['total_revenue'] ?? 0.0 );

			$cust_rows = $wpdb->get_results( $wpdb->prepare(
				"SELECT s.customer_id, COUNT(s.order_id) as order_count 
				 FROM {$stats_table} s
				 JOIN {$lookup_table} c ON s.customer_id = c.customer_id
				 WHERE s.status IN ({$status_placeholders}) 
				   AND {$excluded_cust_c_sql}
				 GROUP BY s.customer_id",
				...$valid_statuses
			), ARRAY_A ) ?: [];
			$paying_customers = count( $cust_rows );
			foreach ( $cust_rows as $row ) {
				if ( (int) $row['order_count'] >= 2 ) {
					$repeat_customers++;
				}
			}

			$inactive_sql = $wpdb->prepare(
				"SELECT COUNT(u.ID) FROM {$wpdb->users} u
				 WHERE u.user_registered < %s
				   AND {$excluded_users_u_sql}
				   AND u.user_email NOT IN (
					 SELECT DISTINCT c.email FROM {$lookup_table} c
					 JOIN {$stats_table} s ON c.customer_id = s.customer_id
					 WHERE s.date_created >= %s
					   AND {$excluded_cust_c_sql}
				   )",
				$two_years_ago,
				$two_years_ago
			);
			$inactive_2yr_users = (int) $wpdb->get_var( $inactive_sql );

			$top_rows = $wpdb->get_results( $wpdb->prepare(
				"SELECT 
					c.email,
					c.user_id,
					CONCAT(c.first_name, ' ', c.last_name) as name,
					COUNT(s.order_id) as orders_count,
					COALESCE(SUM(s.total_sales), 0) as total_spent,
					MAX(s.date_created) as last_order_date
				 FROM {$lookup_table} c
				 JOIN {$stats_table} s ON c.customer_id = s.customer_id
				 WHERE s.status IN ({$status_placeholders})
				   AND c.email IS NOT NULL AND c.email != ''
				   AND {$excluded_cust_c_sql}
				 GROUP BY c.customer_id
				 ORDER BY total_spent DESC
				 LIMIT 5",
				...$valid_statuses
			), ARRAY_A ) ?: [];

			foreach ( $top_rows as $top ) {
				$spent  = (float) $top['total_spent'];
				$orders = (int) $top['orders_count'];
				$top_customers[] = [
					'id'              => (int) $top['user_id'],
					'email'           => $top['email'],
					'name'            => trim( $top['name'] ) ?: explode( '@', $top['email'] )[0],
					'orders_count'    => $orders,
					'total_spent'     => $spent,
					'avg_order_value' => $orders > 0 ? round( $spent / $orders, 2 ) : 0.0,
					'last_order_date' => $top['last_order_date'],
				];
			}
		} else {
			// Classic fallback
			$excluded_meta_sql = self::get_excluded_emails_sql( 'pm_email.meta_value' );
			$rev_row = $wpdb->get_row( $wpdb->prepare(
				"SELECT COUNT(p.ID) as total_orders, COALESCE(SUM(CAST(pm.meta_value AS DECIMAL(12,2))), 0) as total_revenue
				 FROM {$wpdb->posts} p
				 LEFT JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id AND pm.meta_key = '_order_total'
				 LEFT JOIN {$wpdb->postmeta} pm_email ON p.ID = pm_email.post_id AND pm_email.meta_key = '_billing_email'
				 WHERE p.post_type = 'shop_order'
				   AND p.post_status IN ({$status_placeholders})
				   AND (pm_email.meta_value IS NULL OR {$excluded_meta_sql})",
				...$valid_statuses
			), ARRAY_A );
			$total_orders  = (int) ( $rev_row['total_orders'] ?? 0 );
			$total_revenue = (float) ( $rev_row['total_revenue'] ?? 0.0 );

			$paying_customers = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(DISTINCT pm.meta_value)
				 FROM {$wpdb->posts} p
				 JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id AND pm.meta_key = '_billing_email'
				 WHERE p.post_type = 'shop_order'
				   AND p.post_status IN ({$status_placeholders})
				   AND pm.meta_value IS NOT NULL AND pm.meta_value != ''
				   AND " . self::get_excluded_emails_sql( 'pm.meta_value' ),
				...$valid_statuses
			) );

			$inactive_2yr_users = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(ID) FROM {$wpdb->users} WHERE user_registered < %s AND " . self::get_excluded_emails_sql( 'user_email' ),
				$two_years_ago
			) );
		}

		$aov = $total_orders > 0 ? round( $total_revenue / $total_orders, 2 ) : 0.0;
		$repeat_rate = $paying_customers > 0 ? round( ( $repeat_customers / $paying_customers ) * 100, 1 ) : 0.0;

		return [
			'total_users'        => $total_registered_users,
			'total_customers'    => max( $total_registered_users, $paying_customers ),
			'paying_customers'   => $paying_customers,
			'repeat_customers'   => $repeat_customers,
			'inactive_2yr_users' => $inactive_2yr_users,
			'total_revenue'      => $total_revenue,
			'total_orders'       => $total_orders,
			'avg_order_value'    => $aov,
			'repeat_rate'        => $repeat_rate,
			'top_customers'      => $top_customers,
			'storage_mode'       => $mode,
		];
	}

	/**
	 * GET /customers
	 * Paginated customer directory with search and filter tabs
	 */
	public static function rest_get_customers( WP_REST_Request $request ) {
		global $wpdb;

		$page     = max( 1, (int) $request->get_param( 'page' ) ?: 1 );
		$per_page = min( 100, max( 10, (int) $request->get_param( 'per_page' ) ?: 25 ) );
		$offset   = ( $page - 1 ) * $per_page;

		$search   = sanitize_text_field( trim( (string) $request->get_param( 'search' ) ?: '' ) );
		$filter   = sanitize_key( (string) $request->get_param( 'filter' ) ?: 'all' );
		$sort_by  = sanitize_key( (string) $request->get_param( 'sort_by' ) ?: 'spent_desc' );

		$mode          = self::get_storage_mode();
		$two_years_ago = gmdate( 'Y-m-d H:i:s', strtotime( '-2 years' ) );

		$valid_statuses = [ 'wc-processing', 'wc-completed', 'wc-in-production', 'wc-quality-check', 'wc-awaiting-pickup', 'wc-preparing-order', 'wc-ready-to-ship', 'wc-smb-ready', 'wc-smb-picked', 'wc-shipped', 'processing', 'completed', 'in-production', 'quality-check', 'awaiting-pickup', 'preparing-order', 'ready-to-ship', 'smb-ready', 'smb-picked', 'shipped' ];
		$status_placeholders = implode( ',', array_fill( 0, count( $valid_statuses ), '%s' ) );

		$customers   = [];
		$total_count = 0;

		// -------------------------------------------------------------
		// Route Query based on filter and mode
		// -------------------------------------------------------------
		$excluded_users_u_sql  = self::get_excluded_emails_sql( 'u.user_email' );
		$excluded_orders_sql   = self::get_excluded_emails_sql( 'billing_email' );
		$excluded_orders_o_sql = self::get_excluded_emails_sql( 'o.billing_email' );

		if ( 'inactive_2yr' === $filter ) {
			// Query users registered > 2 years ago with no recent orders
			$search_clause = '';
			$params = [ $two_years_ago ];

			if ( ! empty( $search ) ) {
				$like = '%' . $wpdb->esc_like( $search ) . '%';
				$search_clause = " AND (u.user_email LIKE %s OR u.display_name LIKE %s OR u.user_login LIKE %s) ";
				$params[] = $like;
				$params[] = $like;
				$params[] = $like;
			}

			if ( 'hpos' === $mode ) {
				$orders_table = "{$wpdb->prefix}wc_orders";
				$params[] = $two_years_ago;

				$count_sql = "SELECT COUNT(u.ID) FROM {$wpdb->users} u
					WHERE u.user_registered < %s
					  AND {$excluded_users_u_sql}
					  {$search_clause}
					  AND LOWER(TRIM(u.user_email)) NOT IN (
						SELECT DISTINCT LOWER(TRIM(billing_email)) 
						FROM {$orders_table} 
						WHERE date_created_gmt >= %s 
						  AND billing_email IS NOT NULL AND billing_email != ''
						  AND {$excluded_orders_sql}
					  )";
				$total_count = (int) $wpdb->get_var( $wpdb->prepare( $count_sql, ...$params ) );

				$data_params = array_merge( $params, [ $per_page, $offset ] );
				$data_sql = "SELECT u.ID as user_id, u.user_email as email, u.display_name, u.user_registered as registered_at
					FROM {$wpdb->users} u
					WHERE u.user_registered < %s
					  AND {$excluded_users_u_sql}
					  {$search_clause}
					  AND LOWER(TRIM(u.user_email)) NOT IN (
						SELECT DISTINCT LOWER(TRIM(billing_email)) 
						FROM {$orders_table} 
						WHERE date_created_gmt >= %s 
						  AND billing_email IS NOT NULL AND billing_email != ''
						  AND {$excluded_orders_sql}
					  )
					ORDER BY u.user_registered ASC
					LIMIT %d OFFSET %d";
				$rows = $wpdb->get_results( $wpdb->prepare( $data_sql, ...$data_params ), ARRAY_A ) ?: [];
			} else {
				$count_sql = "SELECT COUNT(u.ID) FROM {$wpdb->users} u WHERE u.user_registered < %s AND {$excluded_users_u_sql} {$search_clause}";
				$total_count = (int) $wpdb->get_var( $wpdb->prepare( $count_sql, ...$params ) );

				$data_params = array_merge( $params, [ $per_page, $offset ] );
				$data_sql = "SELECT u.ID as user_id, u.user_email as email, u.display_name, u.user_registered as registered_at
					FROM {$wpdb->users} u
					WHERE u.user_registered < %s
					  AND {$excluded_users_u_sql}
					  {$search_clause}
					ORDER BY u.user_registered ASC
					LIMIT %d OFFSET %d";
				$rows = $wpdb->get_results( $wpdb->prepare( $data_sql, ...$data_params ), ARRAY_A ) ?: [];
			}

			foreach ( $rows as $r ) {
				$u_id = (int) $r['user_id'];
				$fn = get_user_meta( $u_id, 'first_name', true );
				$ln = get_user_meta( $u_id, 'last_name', true );
				$full_name = trim( "{$fn} {$ln}" ) ?: $r['display_name'];
				$phone = get_user_meta( $u_id, 'billing_phone', true );
				$city  = get_user_meta( $u_id, 'billing_city', true );

				$customers[] = [
					'id'              => $u_id,
					'customer_id'     => $u_id,
					'email'           => $r['email'],
					'first_name'      => $fn,
					'last_name'       => $ln,
					'name'            => $full_name,
					'display_name'    => $r['display_name'],
					'phone'           => $phone ?: '',
					'city'            => $city ?: '',
					'state'           => '',
					'country'         => 'ID',
					'postcode'        => '',
					'role'            => 'customer',
					'is_guest'        => false,
					'orders_count'    => 0,
					'total_spent'     => 0.0,
					'avg_order_value' => 0.0,
					'date_created'    => $r['registered_at'],
					'last_active'     => $r['registered_at'],
					'is_inactive_2yr' => true,
				];
			}

		} elseif ( 'hpos' === $mode ) {
			// Query HPOS Orders Table directly for paying/all customers
			$orders_table = "{$wpdb->prefix}wc_orders";
			$addr_table   = "{$wpdb->prefix}wc_order_addresses";
			$has_addr     = ( $wpdb->get_var( "SHOW TABLES LIKE '{$addr_table}'" ) === $addr_table );

			$where_clauses = [
				"o.status IN ({$status_placeholders})",
				"o.billing_email IS NOT NULL",
				"o.billing_email != ''",
				$excluded_orders_o_sql,
			];
			$params = $valid_statuses;

			if ( ! empty( $search ) ) {
				$like = '%' . $wpdb->esc_like( $search ) . '%';
				if ( $has_addr ) {
					$where_clauses[] = "(o.billing_email LIKE %s OR o.id IN (SELECT order_id FROM {$addr_table} WHERE first_name LIKE %s OR last_name LIKE %s OR CONCAT(first_name, ' ', last_name) LIKE %s OR phone LIKE %s))";
					$params[] = $like;
					$params[] = $like;
					$params[] = $like;
					$params[] = $like;
					$params[] = $like;
				} else {
					$where_clauses[] = "o.billing_email LIKE %s";
					$params[] = $like;
				}
			}

			$having_clauses = [];
			if ( 'repeat' === $filter ) {
				$having_clauses[] = "COUNT(o.id) >= 2";
			} elseif ( 'single' === $filter ) {
				$having_clauses[] = "COUNT(o.id) = 1";
			} elseif ( 'vip' === $filter ) {
				$having_clauses[] = "SUM(o.total_amount) >= 1000000";
			} elseif ( 'guest' === $filter ) {
				$having_clauses[] = "MAX(o.customer_id) = 0";
			} elseif ( 'registered' === $filter ) {
				$having_clauses[] = "MAX(o.customer_id) > 0";
			}

			$where_sql = implode( ' AND ', $where_clauses );
			$having_sql = ! empty( $having_clauses ) ? ' HAVING ' . implode( ' AND ', $having_clauses ) : '';

			// Sort clause
			$order_by_sql = 'ORDER BY total_spent DESC';
			if ( 'spent_asc' === $sort_by ) {
				$order_by_sql = 'ORDER BY total_spent ASC';
			} elseif ( 'orders_desc' === $sort_by ) {
				$order_by_sql = 'ORDER BY orders_count DESC, total_spent DESC';
			} elseif ( 'date_desc' === $sort_by ) {
				$order_by_sql = 'ORDER BY last_order_date DESC';
			} elseif ( 'date_asc' === $sort_by ) {
				$order_by_sql = 'ORDER BY first_order_date ASC';
			}

			// Total matching customers count
			$count_sql = "SELECT COUNT(*) FROM (
				SELECT LOWER(TRIM(o.billing_email)) as email
				FROM {$orders_table} o
				WHERE {$where_sql}
				GROUP BY LOWER(TRIM(o.billing_email))
				{$having_sql}
			) as c";
			$total_count = (int) $wpdb->get_var( $wpdb->prepare( $count_sql, ...$params ) );

			// Paginated Rows
			$data_params = array_merge( $params, [ $per_page, $offset ] );
			$data_sql = "SELECT 
				LOWER(TRIM(o.billing_email)) as email,
				MAX(o.customer_id) as user_id,
				COUNT(o.id) as orders_count,
				COALESCE(SUM(o.total_amount), 0) as total_spent,
				MIN(o.date_created_gmt) as first_order_date,
				MAX(o.date_created_gmt) as last_order_date
			FROM {$orders_table} o
			WHERE {$where_sql}
			GROUP BY LOWER(TRIM(o.billing_email))
			{$having_sql}
			{$order_by_sql}
			LIMIT %d OFFSET %d";

			$rows = $wpdb->get_results( $wpdb->prepare( $data_sql, ...$data_params ), ARRAY_A ) ?: [];

			// Enrich customer details (name, phone, address)
			foreach ( $rows as $row ) {
				$user_id   = (int) $row['user_id'];
				$email     = $row['email'];
				$orders    = (int) $row['orders_count'];
				$spent     = (float) $row['total_spent'];
				$aov       = $orders > 0 ? round( $spent / $orders, 2 ) : 0.0;
				$first_date = $row['first_order_date'];
				$last_date  = $row['last_order_date'];

				$name       = '';
				$first_name = '';
				$last_name  = '';
				$phone      = '';
				$city       = '';
				$state      = '';
				$country    = 'ID';
				$postcode   = '';
				$role       = $user_id > 0 ? 'customer' : 'guest';

				if ( $user_id > 0 ) {
					$u = get_userdata( $user_id );
					if ( $u ) {
						$first_name = (string) get_user_meta( $user_id, 'first_name', true );
						$last_name  = (string) get_user_meta( $user_id, 'last_name', true );
						$name       = trim( "{$first_name} {$last_name}" ) ?: $u->display_name;
						$phone      = (string) get_user_meta( $user_id, 'billing_phone', true );
						$city       = (string) get_user_meta( $user_id, 'billing_city', true );
						$state      = (string) get_user_meta( $user_id, 'billing_state', true );
						$country    = (string) get_user_meta( $user_id, 'billing_country', true ) ?: 'ID';
						$postcode   = (string) get_user_meta( $user_id, 'billing_postcode', true );
						$role       = ! empty( $u->roles ) ? reset( $u->roles ) : 'customer';
					}
				}

				if ( empty( $name ) && $has_addr ) {
					$addr = $wpdb->get_row( $wpdb->prepare(
						"SELECT first_name, last_name, phone, city, state, country, postcode 
						 FROM {$addr_table} 
						 WHERE email = %s AND address_type = 'billing' 
						 ORDER BY id DESC LIMIT 1",
						$email
					), ARRAY_A );
					if ( $addr ) {
						$first_name = $addr['first_name'] ?? '';
						$last_name  = $addr['last_name'] ?? '';
						$name       = trim( "{$first_name} {$last_name}" );
						$phone      = $phone ?: ( $addr['phone'] ?? '' );
						$city       = $city ?: ( $addr['city'] ?? '' );
						$state      = $state ?: ( $addr['state'] ?? '' );
						$country    = $country ?: ( $addr['country'] ?? 'ID' );
						$postcode   = $postcode ?: ( $addr['postcode'] ?? '' );
					}
				}

				if ( empty( $name ) ) {
					$name = explode( '@', $email )[0];
				}

				$is_inactive_2yr = ( $last_date && strtotime( $last_date ) < strtotime( '-2 years' ) );

				$customers[] = [
					'id'              => $user_id,
					'customer_id'     => $user_id,
					'email'           => $email,
					'first_name'      => $first_name,
					'last_name'       => $last_name,
					'name'            => $name,
					'display_name'    => $name,
					'phone'           => $phone,
					'city'            => $city,
					'state'           => $state,
					'country'         => $country,
					'postcode'        => $postcode,
					'role'            => $role,
					'is_guest'        => $user_id === 0,
					'orders_count'    => $orders,
					'total_spent'     => $spent,
					'avg_order_value' => $aov,
					'date_created'    => $first_date,
					'last_active'     => $last_date,
					'is_inactive_2yr' => $is_inactive_2yr,
				];
			}

		} else {
			// Fallback: Query wp_users combined with orders
			$search_clause = ' WHERE ' . self::get_excluded_emails_sql( 'user_email' );
			$params = [];
			if ( ! empty( $search ) ) {
				$like = '%' . $wpdb->esc_like( $search ) . '%';
				$search_clause .= " AND (user_email LIKE %s OR display_name LIKE %s) ";
				$params[] = $like;
				$params[] = $like;
			}

			$count_sql = "SELECT COUNT(ID) FROM {$wpdb->users} {$search_clause}";
			$total_count = ! empty( $params ) 
				? (int) $wpdb->get_var( $wpdb->prepare( $count_sql, ...$params ) )
				: (int) $wpdb->get_var( $count_sql );

			$data_params = array_merge( $params, [ $per_page, $offset ] );
			$data_sql = "SELECT ID, user_email, display_name, user_registered 
				FROM {$wpdb->users} 
				{$search_clause} 
				ORDER BY user_registered DESC 
				LIMIT %d OFFSET %d";
			$rows = $wpdb->get_results( $wpdb->prepare( $data_sql, ...$data_params ), ARRAY_A ) ?: [];

			foreach ( $rows as $r ) {
				$u_id = (int) $r['ID'];
				$fn = get_user_meta( $u_id, 'first_name', true );
				$ln = get_user_meta( $u_id, 'last_name', true );
				$full_name = trim( "{$fn} {$ln}" ) ?: $r['display_name'];

				$customers[] = [
					'id'              => $u_id,
					'customer_id'     => $u_id,
					'email'           => $r['user_email'],
					'first_name'      => $fn,
					'last_name'       => $ln,
					'name'            => $full_name,
					'display_name'    => $r['display_name'],
					'phone'           => get_user_meta( $u_id, 'billing_phone', true ) ?: '',
					'city'            => get_user_meta( $u_id, 'billing_city', true ) ?: '',
					'state'           => '',
					'country'         => 'ID',
					'postcode'        => '',
					'role'            => 'customer',
					'is_guest'        => false,
					'orders_count'    => (int) wc_get_customer_order_count( $u_id ),
					'total_spent'     => (float) wc_get_customer_total_spent( $u_id ),
					'avg_order_value' => 0.0,
					'date_created'    => $r['user_registered'],
					'last_active'     => $r['user_registered'],
					'is_inactive_2yr' => strtotime( $r['user_registered'] ) < strtotime( '-2 years' ),
				];
			}
		}

		$max_pages = $per_page > 0 ? (int) ceil( $total_count / $per_page ) : 1;

		// Set standard pagination response headers
		header( 'X-WP-Total: ' . $total_count );
		header( 'X-WP-TotalPages: ' . $max_pages );

		return rest_ensure_response( [
			'success'         => true,
			'total_customers' => $total_count,
			'max_pages'       => $max_pages,
			'current_page'    => $page,
			'per_page'        => $per_page,
			'customers'       => $customers,
		] );
	}

	/**
	 * GET /customers/(?P<id_or_email>)
	 * Single customer profile & order history drilldown
	 */
	public static function rest_get_customer_detail( WP_REST_Request $request ) {
		$param = sanitize_text_field( $request->get_param( 'id_or_email' ) );
		if ( empty( $param ) ) {
			return new WP_Error( 'invalid_param', 'Customer ID or email required', [ 'status' => 400 ] );
		}

		$customer_id = is_numeric( $param ) ? intval( $param ) : 0;
		$email       = is_email( $param ) ? sanitize_email( $param ) : '';

		// Resolve user if possible
		$user = null;
		if ( $customer_id > 0 ) {
			$user = get_userdata( $customer_id );
			if ( $user && empty( $email ) ) {
				$email = $user->user_email;
			}
		} elseif ( ! empty( $email ) ) {
			$user = get_user_by( 'email', $email );
			if ( $user ) {
				$customer_id = $user->ID;
			}
		}

		// Fetch past orders using standard WooCommerce order query
		$order_args = [
			'limit'   => 50,
			'orderby' => 'date',
			'order'   => 'DESC',
		];
		if ( $customer_id > 0 ) {
			$order_args['customer_id'] = $customer_id;
		} elseif ( ! empty( $email ) ) {
			$order_args['billing_email'] = $email;
		}

		$raw_orders = wc_get_orders( $order_args );
		$orders_data = [];
		$total_spent = 0.0;

		foreach ( $raw_orders as $order ) {
			if ( ! $order instanceof WC_Order ) continue;
			$st = $order->get_status();
			$paid_statuses = self::get_paid_order_statuses();
			if ( in_array( $st, $paid_statuses, true ) || in_array( 'wc-' . $st, $paid_statuses, true ) ) {
				$total_spent += (float) $order->get_total();
			}

			if ( class_exists( 'Exacoat_Order_Manager' ) ) {
				$orders_data[] = Exacoat_Order_Manager::format_order_for_manager( $order );
			} else {
				$orders_data[] = [
					'id'            => $order->get_id(),
					'order_number'  => $order->get_order_number(),
					'status'        => $order->get_status(),
					'total'         => (float) $order->get_total(),
					'date_created'  => $order->get_date_created() ? $order->get_date_created()->date( 'c' ) : '',
					'items_count'   => count( $order->get_items() ),
				];
			}
		}

		$orders_count = count( $orders_data );
		$aov = $orders_count > 0 ? round( $total_spent / $orders_count, 2 ) : 0.0;

		$first_name = $user ? get_user_meta( $user->ID, 'first_name', true ) : '';
		$last_name  = $user ? get_user_meta( $user->ID, 'last_name', true ) : '';
		$name       = trim( "{$first_name} {$last_name}" ) ?: ( $user ? $user->display_name : explode( '@', $email )[0] );
		$phone      = $user ? get_user_meta( $user->ID, 'billing_phone', true ) : '';
		$city       = $user ? get_user_meta( $user->ID, 'billing_city', true ) : '';
		$state      = $user ? get_user_meta( $user->ID, 'billing_state', true ) : '';
		$country    = $user ? get_user_meta( $user->ID, 'billing_country', true ) : 'ID';

		if ( empty( $name ) && ! empty( $orders_data[0] ) ) {
			$name = $orders_data[0]['billing']['first_name'] . ' ' . $orders_data[0]['billing']['last_name'];
		}

		return rest_ensure_response( [
			'success'  => true,
			'customer' => [
				'id'              => $customer_id,
				'customer_id'     => $customer_id,
				'email'           => $email,
				'first_name'      => $first_name,
				'last_name'       => $last_name,
				'name'            => $name,
				'phone'           => $phone,
				'city'            => $city,
				'state'           => $state,
				'country'         => $country ?: 'ID',
				'role'            => $user ? reset( $user->roles ) : 'guest',
				'is_guest'        => ! $user,
				'orders_count'    => $orders_count,
				'total_spent'     => $total_spent,
				'avg_order_value' => $aov,
				'registered_at'   => $user ? $user->user_registered : ( ! empty( $orders_data ) ? end( $orders_data )['created_at'] : null ),
				'last_active'     => ! empty( $orders_data ) ? $orders_data[0]['created_at'] : ( $user ? $user->user_registered : null ),
			],
			'orders'   => $orders_data,
		] );
	}

	/**
	 * GET /customers/inactive-preview
	 * Preview counts & sample of inactive accounts for cleanup
	 */
	public static function rest_get_inactive_preview( WP_REST_Request $request ) {
		global $wpdb;
		$years = max( 1, min( 5, (int) $request->get_param( 'years' ) ?: 2 ) );
		$cutoff_date = gmdate( 'Y-m-d H:i:s', strtotime( "-{$years} years" ) );

		$mode = self::get_storage_mode();
		$count = 0;
		$sample = [];

		if ( 'hpos' === $mode ) {
			$orders_table = "{$wpdb->prefix}wc_orders";
			$excluded_users_u_sql = self::get_excluded_emails_sql( 'u.user_email' );
			$excluded_orders_sql  = self::get_excluded_emails_sql( 'billing_email' );

			$count = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(u.ID) FROM {$wpdb->users} u
				 WHERE u.user_registered < %s
				   AND {$excluded_users_u_sql}
				   AND LOWER(TRIM(u.user_email)) NOT IN (
					 SELECT DISTINCT LOWER(TRIM(billing_email)) 
					 FROM {$orders_table} 
					 WHERE date_created_gmt >= %s 
					   AND billing_email IS NOT NULL AND billing_email != ''
					   AND {$excluded_orders_sql}
				   )",
				$cutoff_date,
				$cutoff_date
			) );

			$sample = $wpdb->get_results( $wpdb->prepare(
				"SELECT u.ID, u.user_email, u.display_name, u.user_registered 
				 FROM {$wpdb->users} u
				 WHERE u.user_registered < %s
				   AND {$excluded_users_u_sql}
				   AND LOWER(TRIM(u.user_email)) NOT IN (
					 SELECT DISTINCT LOWER(TRIM(billing_email)) 
					 FROM {$orders_table} 
					 WHERE date_created_gmt >= %s 
					   AND billing_email IS NOT NULL AND billing_email != ''
					   AND {$excluded_orders_sql}
				   )
				 ORDER BY u.user_registered ASC
				 LIMIT 20",
				$cutoff_date,
				$cutoff_date
			), ARRAY_A ) ?: [];
		} else {
			$excluded_users_sql = self::get_excluded_emails_sql( 'user_email' );
			$count = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(ID) FROM {$wpdb->users} WHERE user_registered < %s AND {$excluded_users_sql}",
				$cutoff_date
			) );

			$sample = $wpdb->get_results( $wpdb->prepare(
				"SELECT ID, user_email, display_name, user_registered 
				 FROM {$wpdb->users} 
				 WHERE user_registered < %s 
				   AND {$excluded_users_sql}
				 ORDER BY user_registered ASC 
				 LIMIT 20",
				$cutoff_date
			), ARRAY_A ) ?: [];
		}

		return rest_ensure_response( [
			'success'     => true,
			'years'       => $years,
			'cutoff_date' => $cutoff_date,
			'total_count' => $count,
			'sample'      => $sample,
		] );
	}
}

}
