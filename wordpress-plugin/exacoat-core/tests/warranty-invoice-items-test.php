<?php
define( 'ABSPATH', __DIR__ );
require_once __DIR__ . '/../includes/class-warranty-manager.php';

function check_invoice_items( $expected, $actual, string $message ): void {
	if ( $expected !== $actual ) {
		fwrite( STDERR, $message . "\n" );
		exit( 1 );
	}
}

$camera = [
	'item_id' => '576123456789123456',
	'item_name' => '[EXACOAT] Camera Protector',
	'sku_name' => '2pcs',
	'seller_sku' => 'CAMERA-2',
	'quantity' => 1,
];
$source = Exacoat_Warranty_Manager::verified_invoice_lines( [ $camera ], false );
$id = $camera['item_id'];
check_invoice_items( 'Camera Protector - 2pcs', $source[ $id ]['name'], 'Pack name must retain the original variant.' );
check_invoice_items( 1, $source[ $id ]['quantity'], 'A two-piece pack is a single purchased unit.' );
check_invoice_items( [ $source[ $id ] + [ 'source_id' => $id ] ], Exacoat_Warranty_Manager::match_invoice_claim_items(
	[ [ 'source_id' => $id, 'quantity' => 1 ] ], $source
), 'Selecting the actual invoice line must succeed.' );
check_invoice_items( [], Exacoat_Warranty_Manager::match_invoice_claim_items(
	[ [ 'source_id' => $id, 'quantity' => 2 ] ], $source
), 'Selecting two packs with one purchased must fail.' );
check_invoice_items( [], Exacoat_Warranty_Manager::match_invoice_claim_items(
	[ [ 'source_id' => $id, 'quantity' => 1 ], [ 'source_id' => $id, 'quantity' => 1 ] ], $source
), 'Submitting the same invoice line twice must fail.' );
check_invoice_items( [], Exacoat_Warranty_Manager::match_invoice_claim_items(
	[ [ 'name' => 'Full Skin', 'quantity' => 1 ] ], $source
), 'A generic full skin cannot replace a camera-protector purchase.' );
check_invoice_items( [ $source[ $id ] + [ 'source_id' => $id ] ], Exacoat_Warranty_Manager::match_invoice_claim_items(
	[ [ 'name' => 'Catalog camera protector', 'sku' => 'CAMERA-2', 'quantity' => 1 ] ], $source
), 'A manual catalog item with the authoritative SKU must match.' );
check_invoice_items( [], Exacoat_Warranty_Manager::match_invoice_claim_items(
	[ [ 'source_id' => '576123456789123457', 'quantity' => 1 ] ], $source
), 'A line from another invoice must fail.' );
check_invoice_items( [], Exacoat_Warranty_Manager::verified_invoice_lines( [ $camera, $camera ], false ),
	'Repeated source-line identity must fail closed.' );

$shopee_a = [ 'item_id' => '123', 'model_id' => '1', 'item_name' => 'Camera Protector', 'model_name' => 'Gloss', 'quantity' => 1 ];
$shopee_b = [ 'item_id' => '123', 'model_id' => '2', 'item_name' => 'Camera Protector', 'model_name' => 'Matte', 'quantity' => 1 ];
check_invoice_items( [ '123:1', '123:2' ], array_keys( Exacoat_Warranty_Manager::verified_invoice_lines( [ $shopee_a, $shopee_b ], true ) ),
	'Shopee variants must have independent source identities.' );

echo "Warranty invoice item checks passed.\n";
