<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Directory for physical image file uploads
$upload_dir = __DIR__ . '/uploads/photo_product/';
if (!is_dir($upload_dir)) {
    @mkdir($upload_dir, 0777, true);
}

try {
    require_once __DIR__ . '/db_connect.php';

    // Auto-create product_change_logs table and add impa_code column if missing
    $db_conn->query("CREATE TABLE IF NOT EXISTS product_change_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        product_code VARCHAR(100) NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        actor_name VARCHAR(100) NOT NULL,
        actor_email VARCHAR(100) NOT NULL,
        changes_json LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    
    @$db_conn->query("ALTER TABLE products ADD COLUMN IF NOT EXISTS impa_code VARCHAR(50) NULL AFTER product_code;");

    // Auto-migrate legacy IMPA codes stored in product_code column to impa_code column
    @$db_conn->query("UPDATE products 
                      SET impa_code = REPLACE(product_code, 'IMPA-', ''), 
                          product_code = CONCAT('PRD-', REPLACE(product_code, 'IMPA-', '')) 
                      WHERE (impa_code IS NULL OR impa_code = '') 
                        AND product_code LIKE 'IMPA-%';");

    // DELETE / TRASH / RESTORE PRODUCT RECORD FROM PRODUCTS TABLE
    $action = isset($_GET['action']) ? trim($_GET['action']) : '';
    $actor_name = isset($_REQUEST['actor_name']) ? trim($_REQUEST['actor_name']) : 'Super Admin';
    $actor_email = isset($_REQUEST['actor_email']) ? trim($_REQUEST['actor_email']) : 'admin@abmalaya.com';

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE' || !empty($action)) {
        if ($action === 'get_history') {
            $product_id = isset($_GET['product_id']) ? (int)$_GET['product_id'] : 0;
            if ($product_id > 0) {
                $stmt = $db_conn->prepare("SELECT * FROM product_change_logs WHERE product_id = ? ORDER BY id DESC LIMIT 50");
                $stmt->bind_param("i", $product_id);
                $stmt->execute();
                $res = $stmt->get_result();
            } else {
                $res = $db_conn->query("SELECT * FROM product_change_logs ORDER BY id DESC LIMIT 100");
            }
            $logs = [];
            if ($res && $res->num_rows > 0) {
                while ($r = $res->fetch_assoc()) {
                    $logs[] = $r;
                }
            }
            ob_end_clean();
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'status' => 'success',
                'fetched_count' => count($logs),
                'data' => $logs
            ]);
            exit;
        }

        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if ($id > 0) {
            // Fetch product_code for logging
            $prd_code = 'PRD-' . $id;
            $res_code = $db_conn->query("SELECT product_code FROM products WHERE id = " . $id);
            if ($res_code && $r_c = $res_code->fetch_assoc()) {
                $prd_code = $r_c['product_code'];
            }

            if ($action === 'trash') {
                $stmt = $db_conn->prepare("UPDATE products SET status = 'junk' WHERE id = ?");
                if ($stmt) {
                    $stmt->bind_param("i", $id);
                    $stmt->execute();
                }
                $msg = 'Product moved to trash (junk)';
                $log_stmt = $db_conn->prepare("INSERT INTO product_change_logs (product_id, product_code, action_type, actor_name, actor_email, changes_json) VALUES (?, ?, 'TRASH', ?, ?, ?)");
                if ($log_stmt) {
                    $json_diff = json_encode(['status' => ['old' => 'active', 'new' => 'junk']]);
                    $log_stmt->bind_param("issss", $id, $prd_code, $actor_name, $actor_email, $json_diff);
                    $log_stmt->execute();
                }
            } else if ($action === 'restore') {
                $stmt = $db_conn->prepare("UPDATE products SET status = 'active' WHERE id = ?");
                if ($stmt) {
                    $stmt->bind_param("i", $id);
                    $stmt->execute();
                }
                $msg = 'Product restored to active list';
                $log_stmt = $db_conn->prepare("INSERT INTO product_change_logs (product_id, product_code, action_type, actor_name, actor_email, changes_json) VALUES (?, ?, 'RESTORE', ?, ?, ?)");
                if ($log_stmt) {
                    $json_diff = json_encode(['status' => ['old' => 'junk', 'new' => 'active']]);
                    $log_stmt->bind_param("issss", $id, $prd_code, $actor_name, $actor_email, $json_diff);
                    $log_stmt->execute();
                }
            } else if ($action === 'delete' || $action === 'delete_permanent' || $_SERVER['REQUEST_METHOD'] === 'DELETE') {
                $stmt = $db_conn->prepare("DELETE FROM products WHERE id = ?");
                if ($stmt) {
                    $stmt->bind_param("i", $id);
                    $stmt->execute();
                }
                $msg = 'Product permanently deleted';
                $log_stmt = $db_conn->prepare("INSERT INTO product_change_logs (product_id, product_code, action_type, actor_name, actor_email, changes_json) VALUES (?, ?, 'DELETE', ?, ?, ?)");
                if ($log_stmt) {
                    $json_diff = json_encode(['notice' => 'Product permanently removed from database']);
                    $log_stmt->bind_param("issss", $id, $prd_code, $actor_name, $actor_email, $json_diff);
                    $log_stmt->execute();
                }
            }

            ob_end_clean();
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'status' => 'success',
                'message' => $msg ?? 'Action completed successfully',
                'target_id' => $id
            ]);
            exit;
        }
    }

    // GET PRODUCTS OR CATEGORIES
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $get_categories = isset($_GET['get_categories']) ? (int)$_GET['get_categories'] : 0;
        $search = isset($_GET['q']) ? trim($_GET['q']) : '';

        if ($get_categories === 1) {
            // Read from product_categories table
            if (!empty($search)) {
                $stmt = $db_conn->prepare("SELECT * FROM product_categories WHERE category_name LIKE ? OR category_code LIKE ? OR internal_category LIKE ? OR subcategories LIKE ? ORDER BY category_code ASC");
                $like = '%' . $search . '%';
                $stmt->bind_param("ssss", $like, $like, $like, $like);
                $stmt->execute();
                $res = $stmt->get_result();
            } else {
                $res = $db_conn->query("SELECT * FROM product_categories ORDER BY category_code ASC");
            }

            $data = [];
            if ($res && $res->num_rows > 0) {
                while ($row = $res->fetch_assoc()) {
                    $data[] = $row;
                }
            }
        } else {
            // Read from products table (actual items with pricing)
            if (!empty($search)) {
                $stmt = $db_conn->prepare("SELECT * FROM products WHERE product_name LIKE ? OR product_code LIKE ? OR description LIKE ? OR category LIKE ? ORDER BY id DESC");
                $like = '%' . $search . '%';
                $stmt->bind_param("ssss", $like, $like, $like, $like);
                $stmt->execute();
                $res = $stmt->get_result();
            } else {
                $res = $db_conn->query("SELECT * FROM products ORDER BY id DESC");
            }

            $data = [];
            if ($res && $res->num_rows > 0) {
                while ($row = $res->fetch_assoc()) {
                    $row['unit_price'] = (float)$row['unit_price'];
                    $row['capital'] = (float)($row['capital'] ?? 0.0);
                    $row['stock_quantity'] = isset($row['stock_quantity']) ? (int)$row['stock_quantity'] : 50;
                    $row['discount_percent'] = isset($row['discount_percent']) ? (float)$row['discount_percent'] : 0.0;
                    $row['status'] = $row['status'] ?? 'active';
                    $data[] = $row;
                }
            }
        }

        ob_end_clean();
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status' => 'success',
            'fetched_count' => count($data),
            'data' => $data
        ]);
        exit;
    }

    // POST SAVE / CREATE PRODUCT OR CATEGORY
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true);
        if (!$input) $input = $_POST;

        $is_category_post = isset($input['category_code']) && !isset($input['product_name']);

        if ($is_category_post) {
            // Save to product_categories table
            $category_code = trim($input['category_code']);
            $category_name = isset($input['category_name']) ? trim($input['category_name']) : '';
            $internal_category = isset($input['internal_category']) ? trim($input['internal_category']) : '';
            $subcategories = isset($input['subcategories']) ? trim($input['subcategories']) : '';
            $description_en = isset($input['description_en']) ? trim($input['description_en']) : '';
            $description_my = isset($input['description_my']) ? trim($input['description_my']) : '';
            $classification_rules = isset($input['classification_rules']) ? trim($input['classification_rules']) : '';

            if (empty($category_code) || empty($category_name)) {
                throw new Exception("Category code and name cannot be empty");
            }

            $stmt = $db_conn->prepare("INSERT INTO product_categories (category_code, category_name, internal_category, subcategories, description_en, description_my, classification_rules) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE category_name=VALUES(category_name), internal_category=VALUES(internal_category), subcategories=VALUES(subcategories), description_en=VALUES(description_en), description_my=VALUES(description_my), classification_rules=VALUES(classification_rules)");
            if ($stmt) {
                $stmt->bind_param("sssssss", $category_code, $category_name, $internal_category, $subcategories, $description_en, $description_my, $classification_rules);
                $stmt->execute();
            } else {
                throw new Exception("MySQL Prepare Failed: " . $db_conn->error);
            }

            ob_end_clean();
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'status' => 'success',
                'message' => 'Category blueprint saved successfully',
                'category_code' => $category_code
            ]);
            exit;
        } else {
            // Save to products table (actual items with pricing)
            $id = isset($input['id']) ? (int)$input['id'] : 0;
            $product_code = isset($input['product_code']) ? trim($input['product_code']) : '';
            $impa_code = isset($input['impa_code']) ? trim($input['impa_code']) : '';
            $product_name = isset($input['product_name']) ? trim($input['product_name']) : '';
            $description = isset($input['description']) ? trim($input['description']) : '';
            $specification = isset($input['specification']) ? trim($input['specification']) : '';
            $offer = isset($input['offer']) ? trim($input['offer']) : (isset($input['offered_item']) ? trim($input['offered_item']) : '');
            $unit = isset($input['unit']) ? trim($input['unit']) : 'Unit';
            $unit_price = isset($input['unit_price']) ? (float)$input['unit_price'] : 0.00;
            $capital = isset($input['capital']) ? (float)$input['capital'] : 0.00;
            $stock_quantity = isset($input['stock_quantity']) ? (int)$input['stock_quantity'] : 50;
            $discount_percent = isset($input['discount_percent']) ? (float)$input['discount_percent'] : 0.00;
            $image_url = isset($input['image_url']) ? trim($input['image_url']) : '';
            $category = isset($input['category']) ? trim($input['category']) : 'Equipment';
            $supplier_name = isset($input['supplier_name']) ? trim($input['supplier_name']) : '';
            $status = isset($input['status']) ? trim($input['status']) : 'active';

            // Support multipart file uploads for images
            if (isset($_FILES['product_image']) && $_FILES['product_image']['error'] === UPLOAD_ERR_OK) {
                $tmp_name = $_FILES['product_image']['tmp_name'];
                $file_name = $_FILES['product_image']['name'];
                $ext = strtolower(pathinfo($file_name, PATHINFO_EXTENSION));
                $allowed_exts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];

                if (in_array($ext, $allowed_exts)) {
                    $new_filename = 'prd_' . time() . '_' . rand(100, 999) . '.' . $ext;
                    if (move_uploaded_file($tmp_name, $upload_dir . $new_filename)) {
                        $image_url = '/uploads/photo_product/' . $new_filename;
                    }
                }
            }

            if (empty($product_name)) {
                throw new Exception("Product name cannot be empty");
            }
            if (empty($product_code)) {
                $product_code = 'PRD-' . rand(1000, 9999);
            }

            if ($id > 0) {
                // Fetch old product values to generate JSON diff
                $old_data = null;
                $res_old = $db_conn->query("SELECT * FROM products WHERE id = " . $id);
                if ($res_old && $row_old = $res_old->fetch_assoc()) {
                    $old_data = $row_old;
                }

                if (!empty($image_url)) {
                    $stmt = $db_conn->prepare("UPDATE products SET product_code=?, impa_code=?, product_name=?, description=?, specification=?, offer=?, unit=?, unit_price=?, capital=?, stock_quantity=?, discount_percent=?, image_url=?, category=?, supplier_name=?, status=? WHERE id=?");
                    if ($stmt) {
                        $stmt->bind_param("sssssssddidssssi", $product_code, $impa_code, $product_name, $description, $specification, $offer, $unit, $unit_price, $capital, $stock_quantity, $discount_percent, $image_url, $category, $supplier_name, $status, $id);
                        $stmt->execute();
                    }
                } else {
                    $stmt = $db_conn->prepare("UPDATE products SET product_code=?, impa_code=?, product_name=?, description=?, specification=?, offer=?, unit=?, unit_price=?, capital=?, stock_quantity=?, discount_percent=?, category=?, supplier_name=?, status=? WHERE id=?");
                    if ($stmt) {
                        $stmt->bind_param("sssssssddidsssi", $product_code, $impa_code, $product_name, $description, $specification, $offer, $unit, $unit_price, $capital, $stock_quantity, $discount_percent, $category, $supplier_name, $status, $id);
                        $stmt->execute();
                    }
                }

                // Log UPDATE diff in product_change_logs
                if ($old_data) {
                    $new_values = [
                        'product_code' => $product_code,
                        'impa_code' => $impa_code,
                        'product_name' => $product_name,
                        'description' => $description,
                        'specification' => $specification,
                        'offer' => $offer,
                        'unit' => $unit,
                        'unit_price' => $unit_price,
                        'capital' => $capital,
                        'stock_quantity' => $stock_quantity,
                        'discount_percent' => $discount_percent,
                        'category' => $category,
                        'supplier_name' => $supplier_name,
                        'status' => $status
                    ];
                    if (!empty($image_url)) {
                        $new_values['image_url'] = $image_url;
                    }

                    $diff = [];
                    foreach ($new_values as $key => $new_val) {
                        $old_val = $old_data[$key] ?? null;
                        if (is_numeric($old_val) && is_numeric($new_val)) {
                            if (abs((float)$old_val - (float)$new_val) > 0.0001) {
                                $diff[$key] = ['old' => (float)$old_val, 'new' => (float)$new_val];
                            }
                        } else if ((string)$old_val !== (string)$new_val) {
                            $diff[$key] = ['old' => (string)$old_val, 'new' => (string)$new_val];
                        }
                    }

                    if (!empty($diff)) {
                        $json_diff = json_encode($diff);
                        $log_stmt = $db_conn->prepare("INSERT INTO product_change_logs (product_id, product_code, action_type, actor_name, actor_email, changes_json) VALUES (?, ?, 'UPDATE', ?, ?, ?)");
                        if ($log_stmt) {
                            $log_stmt->bind_param("issss", $id, $product_code, $actor_name, $actor_email, $json_diff);
                            $log_stmt->execute();
                        }

                        // Also record in system_notifications for daemon & top bar alert
                        $noti_title = "Product Change: " . $product_code;
                        $noti_msg = "Product '{$product_name}' (#{$product_code}) updated by {$actor_name} ({$actor_email}). Changes: " . $json_diff;
                        $noti_stmt = $db_conn->prepare("INSERT INTO system_notifications (title, message, type, category, is_read, action_link, created_at) VALUES (?, ?, 'info', 'product', 0, '/products', NOW())");
                        if ($noti_stmt) {
                            $noti_stmt->bind_param("ss", $noti_title, $noti_msg);
                            $noti_stmt->execute();
                        }

                        // Also append to products.change_history JSON column
                        $hist_obj = json_encode(['time' => date('Y-m-d H:i:s'), 'action' => 'UPDATE', 'actor' => "{$actor_name} ({$actor_email})", 'changes' => $diff]);
                        $esc_hist = $db_conn->real_escape_string($hist_obj);
                        $db_conn->query("UPDATE products SET change_history = IF(change_history IS NULL OR change_history = '', '[" . $esc_hist . "]', CONCAT(SUBSTRING(change_history, 1, CHAR_LENGTH(change_history)-1), '," . $esc_hist . "]')) WHERE id = " . $id);
                    }
                }
            } else {
                $stmt = $db_conn->prepare("INSERT INTO products (product_code, impa_code, product_name, description, specification, offer, unit, unit_price, capital, stock_quantity, discount_percent, image_url, category, supplier_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE impa_code=VALUES(impa_code), product_name=VALUES(product_name), description=VALUES(description), specification=VALUES(specification), offer=VALUES(offer), unit=VALUES(unit), unit_price=VALUES(unit_price), capital=VALUES(capital), stock_quantity=VALUES(stock_quantity), discount_percent=VALUES(discount_percent), image_url=IF(VALUES(image_url) != '', VALUES(image_url), products.image_url), category=VALUES(category), supplier_name=VALUES(supplier_name), status=VALUES(status)");
                if ($stmt) {
                    $stmt->bind_param("sssssssddidssss", $product_code, $impa_code, $product_name, $description, $specification, $offer, $unit, $unit_price, $capital, $stock_quantity, $discount_percent, $image_url, $category, $supplier_name, $status);
                    $stmt->execute();
                    $new_id = $db_conn->insert_id;

                    // Log CREATE entry
                    $init_diff = [
                        'product_name' => $product_name,
                        'unit_price' => $unit_price,
                        'capital' => $capital,
                        'stock_quantity' => $stock_quantity,
                        'category' => $category
                    ];
                    $json_diff = json_encode($init_diff);
                    $log_stmt = $db_conn->prepare("INSERT INTO product_change_logs (product_id, product_code, action_type, actor_name, actor_email, changes_json) VALUES (?, ?, 'CREATE', ?, ?, ?)");
                    if ($log_stmt) {
                        $log_stmt->bind_param("issss", $new_id, $product_code, $actor_name, $actor_email, $json_diff);
                        $log_stmt->execute();
                    }

                    // Also record in system_notifications
                    $noti_title = "New Product Created: " . $product_code;
                    $noti_msg = "Product '{$product_name}' (#{$product_code}) created by {$actor_name} ({$actor_email}). Unit Price: MYR {$unit_price}.";
                    $noti_stmt = $db_conn->prepare("INSERT INTO system_notifications (title, message, type, category, is_read, action_link, created_at) VALUES (?, ?, 'success', 'product', 0, '/products', NOW())");
                    if ($noti_stmt) {
                        $noti_stmt->bind_param("ss", $noti_title, $noti_msg);
                        $noti_stmt->execute();
                    }

                    // Also append to products.change_history JSON column
                    $hist_obj = json_encode(['time' => date('Y-m-d H:i:s'), 'action' => 'CREATE', 'actor' => "{$actor_name} ({$actor_email})", 'changes' => $init_diff]);
                    $esc_hist = $db_conn->real_escape_string($hist_obj);
                    $db_conn->query("UPDATE products SET change_history = '[" . $esc_hist . "]' WHERE id = " . $new_id);
                } else {
                    throw new Exception("MySQL Prepare Failed: " . $db_conn->error);
                }
            }

            ob_end_clean();
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'status' => 'success',
                'message' => 'Product saved successfully',
                'product_code' => $product_code,
                'image_url' => $image_url
            ]);
            exit;
        }
    }

} catch (Exception $e) {
    ob_end_clean();
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
