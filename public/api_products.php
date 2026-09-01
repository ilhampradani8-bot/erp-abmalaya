<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Directory for physical image file uploads
$upload_dir = __DIR__ . '/uploads/products/';
if (!is_dir($upload_dir)) {
    @mkdir($upload_dir, 0777, true);
}

try {
    require_once __DIR__ . '/db_connect.php';

    // DELETE PRODUCT RECORD FROM PRODUCTS TABLE
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE' || (isset($_GET['action']) && $_GET['action'] === 'delete')) {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if ($id > 0) {
            $stmt = $db_conn->prepare("DELETE FROM products WHERE id = ?");
            if ($stmt) {
                $stmt->bind_param("i", $id);
                $stmt->execute();
            }
        }

        ob_end_clean();
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status' => 'success',
            'message' => 'Product deleted successfully',
            'deleted_id' => $id
        ]);
        exit;
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
                    $row['stock_quantity'] = isset($row['stock_quantity']) ? (int)$row['stock_quantity'] : 50;
                    $row['discount_percent'] = isset($row['discount_percent']) ? (float)$row['discount_percent'] : 0.0;
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
            $product_code = isset($input['product_code']) ? trim($input['product_code']) : '';
            $product_name = isset($input['product_name']) ? trim($input['product_name']) : '';
            $description = isset($input['description']) ? trim($input['description']) : '';
            $unit = isset($input['unit']) ? trim($input['unit']) : 'Unit';
            $unit_price = isset($input['unit_price']) ? (float)$input['unit_price'] : 0.00;
            $stock_quantity = isset($input['stock_quantity']) ? (int)$input['stock_quantity'] : 50;
            $discount_percent = isset($input['discount_percent']) ? (float)$input['discount_percent'] : 0.00;
            $image_url = isset($input['image_url']) ? trim($input['image_url']) : '';
            $category = isset($input['category']) ? trim($input['category']) : 'Equipment';

            // Support multipart file uploads for images
            if (isset($_FILES['product_image']) && $_FILES['product_image']['error'] === UPLOAD_ERR_OK) {
                $tmp_name = $_FILES['product_image']['tmp_name'];
                $file_name = $_FILES['product_image']['name'];
                $ext = strtolower(pathinfo($file_name, PATHINFO_EXTENSION));
                $allowed_exts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];

                if (in_array($ext, $allowed_exts)) {
                    $new_filename = 'prd_' . time() . '_' . rand(100, 999) . '.' . $ext;
                    if (move_uploaded_file($tmp_name, $upload_dir . $new_filename)) {
                        $image_url = 'http://localhost:8000/uploads/products/' . $new_filename;
                    }
                }
            }

            if (empty($product_name)) {
                throw new Exception("Product name cannot be empty");
            }
            if (empty($product_code)) {
                $product_code = 'PRD-' . rand(1000, 9999);
            }

            $stmt = $db_conn->prepare("INSERT INTO products (product_code, product_name, description, unit, unit_price, stock_quantity, discount_percent, image_url, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE product_name=VALUES(product_name), description=VALUES(description), unit=VALUES(unit), unit_price=VALUES(unit_price), stock_quantity=VALUES(stock_quantity), discount_percent=VALUES(discount_percent), image_url=VALUES(image_url), category=VALUES(category)");
            if ($stmt) {
                $stmt->bind_param("ssssdidss", $product_code, $product_name, $description, $unit, $unit_price, $stock_quantity, $discount_percent, $image_url, $category);
                $stmt->execute();
            } else {
                throw new Exception("MySQL Prepare Failed: " . $db_conn->error);
            }

            ob_end_clean();
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'status' => 'success',
                'message' => 'Product saved successfully',
                'product_code' => $product_code
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
