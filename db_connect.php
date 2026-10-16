<?php
date_default_timezone_set('Asia/Kuala_Lumpur');
$is_localhost = (!isset($_SERVER['SERVER_NAME']) || $_SERVER['SERVER_NAME'] === 'localhost' || $_SERVER['SERVER_NAME'] === '127.0.0.1' || (isset($_SERVER['HTTP_HOST']) && (strpos($_SERVER['HTTP_HOST'], 'localhost') !== false || strpos($_SERVER['HTTP_HOST'], '127.0.0.1') !== false || strpos($_SERVER['HTTP_HOST'], 'trycloudflare.com') !== false)));

if (!$is_localhost) {
    $db_host = 'localhost';
    $db_user = 'abmalaya_erpuser';
    $db_pass = 'abmalaya2021';
    $db_name = 'abmalaya_abmalaya_erp';
    $db_port = 3306;
} else {
    $db_host = '127.0.0.1';
    $db_user = 'root';
    $db_pass = 'root';
    $db_name = 'abmalaya_erp';
    $db_port = 3306;
}

// Fast local MySQL database connection via unix socket for sub-millisecond speed
try {
    @mysqli_report(MYSQLI_REPORT_OFF);
    $socket = file_exists('/run/mysqld/mysqld.sock') ? '/run/mysqld/mysqld.sock' : (file_exists('/var/run/mysqld/mysqld.sock') ? '/var/run/mysqld/mysqld.sock' : null);
    $db_conn = $conn = @new mysqli('127.0.0.1', 'root', 'root', 'abmalaya_erp', 3306, $socket);

    // Auto-fallback for cPanel / production environment if local DB connection fails
    if ($db_conn->connect_error || !$db_conn) {
        $db_conn = $conn = @new mysqli('localhost', 'abmalaya_erpuser', 'abmalaya2021', 'abmalaya_abmalaya_erp', 3306);
        if ($db_conn->connect_error || !$db_conn) {
            $db_conn = $conn = @new mysqli('localhost', 'abmalaya_erpuser', 'Abmalaya2021', 'abmalaya_abmalaya_erp', 3306);
        }
    }
} catch (Exception $e) {
    if (ob_get_level() > 0) {
        @ob_end_clean();
    }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection exception: ' . $e->getMessage()
    ]);
    exit;
}

if (!$db_conn || $db_conn->connect_error) {
    if (ob_get_level() > 0) {
        @ob_end_clean();
    }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed: ' . ($db_conn ? $db_conn->connect_error : 'MySQL client initialization error')
    ]);
    exit;
}

if (!function_exists('appendRfqHistoryLog')) {
    function appendRfqHistoryLog($db_conn, $rfq_id, $action, $user_name, $user_email, $details) {
        if (!$db_conn || $db_conn->connect_error) return;
        
        // Normalize the lookup key to support numeric ID, sequence suffix, or full RFQ string
        $clean_id = intval(str_replace(['RFQ-', 'GMAIL-LIVE-'], '', $rfq_id));
        $rfq_num = 'RFQ-' . $clean_id;

        // 1. Fetch current history_log
        $current_log = [];
        $stmt = $db_conn->prepare("SELECT id, history_log FROM rfq_requests WHERE id = ? OR rfq_number = ? OR id = ?");
        if ($stmt) {
            $stmt->bind_param("isi", $clean_id, $rfq_num, $rfq_id);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res && $res->num_rows > 0) {
                $row = $res->fetch_assoc();
                $log_str = $row['history_log'];
                if (!empty($log_str)) {
                    $current_log = json_decode($log_str, true);
                    if (!is_array($current_log)) {
                        $current_log = [];
                    }
                }
            }
            $stmt->close();
        }

        // 2. Create new entry
        $new_entry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'user_name' => $user_name ?: 'System Automation',
            'user_email' => $user_email ?: null,
            'action' => $action,
            'details' => $details
        ];

        // 3. Append to log
        $current_log[] = $new_entry;
        $new_log_str = json_encode($current_log, JSON_UNESCAPED_UNICODE);

        // 4. Update table
        $upd = $db_conn->prepare("UPDATE rfq_requests SET history_log = ? WHERE id = ? OR rfq_number = ? OR id = ?");
        if ($upd) {
            $upd->bind_param("sisi", $new_log_str, $clean_id, $rfq_num, $rfq_id);
            $upd->execute();
            $upd->close();
        }
    }
}

if (!function_exists('appendQuotationHistoryLog')) {
    function appendQuotationHistoryLog($db_conn, $quo_id, $action, $user_name, $user_email, $details) {
        if (!$db_conn || $db_conn->connect_error) return;

        // 1. Fetch current history_log
        $current_log = [];
        $stmt = $db_conn->prepare("SELECT id, history_log FROM quotations WHERE id = ? OR quotation_number = ?");
        if ($stmt) {
            $stmt->bind_param("ss", $quo_id, $quo_id);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res && $res->num_rows > 0) {
                $row = $res->fetch_assoc();
                $log_str = $row['history_log'];
                if (!empty($log_str)) {
                    $current_log = json_decode($log_str, true);
                    if (!is_array($current_log)) {
                        $current_log = [];
                    }
                }
            }
            $stmt->close();
        }

        // 2. Create new entry
        $new_entry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'user_name' => $user_name ?: 'System Automation',
            'user_email' => $user_email ?: null,
            'action' => $action,
            'details' => $details
        ];

        // 3. Append to log
        $current_log[] = $new_entry;
        $new_log_str = json_encode($current_log, JSON_UNESCAPED_UNICODE);

        // 4. Update table
        $upd = $db_conn->prepare("UPDATE quotations SET history_log = ? WHERE id = ? OR quotation_number = ?");
        if ($upd) {
            $upd->bind_param("sss", $new_log_str, $quo_id, $quo_id);
            $upd->execute();
            $upd->close();
        }
    }
}

if (!function_exists('addSystemNotification')) {
    function addSystemNotification($db_conn, $title, $message, $type = 'info', $category = 'system', $action_link = null) {
        if (!$db_conn || $db_conn->connect_error) return;
        $stmt = $db_conn->prepare("INSERT INTO system_notifications (title, message, type, category, action_link) VALUES (?, ?, ?, ?, ?)");
        if ($stmt) {
            $stmt->bind_param("sssss", $title, $message, $type, $category, $action_link);
            $stmt->execute();
            $stmt->close();
        }
    }
}

if (!function_exists('getGeminiActiveModels')) {
    /**
     * Query live active models directly from Google Gemini API (GET /v1beta/models)
     * with local caching to guarantee the model used is genuinely active on Google servers.
     */
    function getGeminiActiveModels(array $key_list = []): array {
        static $memory_cache = null;
        if ($memory_cache !== null && !empty($memory_cache)) {
            return $memory_cache;
        }

        $cache_file = sys_get_temp_dir() . '/gemini_active_models_cache.json';
        if (file_exists($cache_file) && (time() - filemtime($cache_file) < 3600)) { // 1 hour file cache
            $saved = @json_decode(file_get_contents($cache_file), true);
            if (!empty($saved) && is_array($saved) && count($saved) > 0) {
                $memory_cache = $saved;
                return $memory_cache;
            }
        }

        $fallback_models = [
            'gemini-flash-latest',
            'gemini-flash-lite-latest',
            'gemini-3.8-flash',
            'gemini-3.7-flash',
            'gemini-3.6-flash',
            'gemini-3.5-flash',
            'gemini-3.1-flash-lite',
            'gemini-pro-latest'
        ];

        if (empty($key_list)) {
            $memory_cache = $fallback_models;
            return $memory_cache;
        }

        foreach ($key_list as $key) {
            $key = trim($key);
            if (empty($key) || strpos($key, '...') !== false || strpos($key, 'gsk_') === 0) continue;

            $url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' . urlencode($key);
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 6,
                CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
                CURLOPT_SSL_VERIFYPEER => false
            ]);
            $resp = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code === 200 && !empty($resp)) {
                $data = json_decode($resp, true);
                if (isset($data['models']) && is_array($data['models'])) {
                    $flash_models = [];
                    $other_models = [];
                    
                    // Disallowed keywords for general text/vision generation
                    $disallowed = ['tts', 'image', 'audio', 'embed', 'transcribe', 'robotics', 'lyria', 'banana', 'computer-use', 'deep-research'];

                    foreach ($data['models'] as $m) {
                        $methods = $m['supportedGenerationMethods'] ?? [];
                        if (in_array('generateContent', $methods)) {
                            $model_name = str_replace('models/', '', $m['name']);
                            
                            // Filter out non-general models
                            $is_bad = false;
                            foreach ($disallowed as $bad_kw) {
                                if (stripos($model_name, $bad_kw) !== false) {
                                    $is_bad = true;
                                    break;
                                }
                            }
                            if ($is_bad) continue;

                            if (stripos($model_name, 'flash') !== false) {
                                $flash_models[] = $model_name;
                            } else if (stripos($model_name, 'gemini') !== false) {
                                $other_models[] = $model_name;
                            }
                        }
                    }

                    // Sort models: 'gemini-flash-latest' first, then 'gemini-flash-lite-latest', then highest versions
                    usort($flash_models, function($a, $b) {
                        if ($a === 'gemini-flash-latest') return -1;
                        if ($b === 'gemini-flash-latest') return 1;
                        if ($a === 'gemini-flash-lite-latest') return -1;
                        if ($b === 'gemini-flash-lite-latest') return 1;
                        return version_compare($b, $a);
                    });

                    usort($other_models, function($a, $b) {
                        if ($a === 'gemini-pro-latest') return -1;
                        if ($b === 'gemini-pro-latest') return 1;
                        return version_compare($b, $a);
                    });

                    $active_models = array_values(array_unique(array_merge($flash_models, $other_models)));
                    if (!empty($active_models)) {
                        @file_put_contents($cache_file, json_encode($active_models));
                        $memory_cache = $active_models;
                        return $memory_cache;
                    }
                }
            }
            break; // Check only first working key
        }

        $memory_cache = $fallback_models;
        return $memory_cache;
    }
}

if (!function_exists('getGroqActiveModels')) {
    /**
     * Query live active chat models directly from Groq API (GET /openai/v1/models)
     * with local caching to prevent model name obsolescence/deprecation.
     */
    function getGroqActiveModels(array $key_list = []): array {
        static $memory_cache = null;
        if ($memory_cache !== null && !empty($memory_cache)) {
            return $memory_cache;
        }

        $cache_file = sys_get_temp_dir() . '/groq_active_models_cache.json';
        if (file_exists($cache_file) && (time() - filemtime($cache_file) < 3600)) { // 1 hour file cache
            $saved = @json_decode(file_get_contents($cache_file), true);
            if (!empty($saved) && is_array($saved) && count($saved) > 0) {
                $memory_cache = $saved;
                return $memory_cache;
            }
        }

        $fallback_models = ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b'];
        if (empty($key_list)) {
            $memory_cache = $fallback_models;
            return $memory_cache;
        }

        foreach ($key_list as $key) {
            $key = trim($key);
            if (empty($key) || strpos($key, 'gsk_') !== 0) continue;

            $ch = curl_init('https://api.groq.com/openai/v1/models');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $key],
                CURLOPT_TIMEOUT        => 6,
                CURLOPT_IPRESOLVE      => CURL_IPRESOLVE_V4,
                CURLOPT_SSL_VERIFYPEER => false
            ]);
            $resp = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code === 200 && !empty($resp)) {
                $data = json_decode($resp, true);
                if (isset($data['data']) && is_array($data['data'])) {
                    $chat_models = [];
                    $disallowed = ['whisper', 'guard', 'safeguard', 'orpheus', 'tts', 'embed', 'audio'];
                    foreach ($data['data'] as $m) {
                        $id = $m['id'] ?? '';
                        $active = $m['active'] ?? true;
                        if (!$active || empty($id)) continue;
                        
                        $is_bad = false;
                        foreach ($disallowed as $bad_kw) {
                            if (stripos($id, $bad_kw) !== false) {
                                $is_bad = true;
                                break;
                            }
                        }
                        if ($is_bad) continue;
                        $chat_models[] = $id;
                    }

                    if (!empty($chat_models)) {
                        @file_put_contents($cache_file, json_encode($chat_models));
                        $memory_cache = $chat_models;
                        return $memory_cache;
                    }
                }
            }
            break;
        }

        $memory_cache = $fallback_models;
        return $memory_cache;
    }
}

if (!function_exists('getOpenRouterActiveModels')) {
    /**
     * Query live active free/chat models directly from OpenRouter API (GET /api/v1/models)
     * with local caching to prevent model name obsolescence.
     */
    function getOpenRouterActiveModels(array $key_list = []): array {
        static $memory_cache = null;
        if ($memory_cache !== null && !empty($memory_cache)) {
            return $memory_cache;
        }

        $cache_file = sys_get_temp_dir() . '/openrouter_active_models_cache.json';
        if (file_exists($cache_file) && (time() - filemtime($cache_file) < 3600)) { // 1 hour file cache
            $saved = @json_decode(file_get_contents($cache_file), true);
            if (!empty($saved) && is_array($saved) && count($saved) > 0) {
                $memory_cache = $saved;
                return $memory_cache;
            }
        }

        $fallback_models = [
            'liquid/lfm-2.5-2.6b:free',
            'nvidia/nemotron-3.5-lightning:free',
            'inclusionai/ling-3.0-flash-sante:free',
            'cohere/north-mini-code:free',
            'google/gemma-4-31b-it:free'
        ];

        if (empty($key_list)) {
            $memory_cache = $fallback_models;
            return $memory_cache;
        }

        foreach ($key_list as $key) {
            $key = trim($key);
            if (empty($key) || strpos($key, 'sk-or-') !== 0) continue;

            $ch = curl_init('https://openrouter.ai/api/v1/models');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $key],
                CURLOPT_TIMEOUT        => 6,
                CURLOPT_IPRESOLVE      => CURL_IPRESOLVE_V4,
                CURLOPT_SSL_VERIFYPEER => false
            ]);
            $resp = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code === 200 && !empty($resp)) {
                $data = json_decode($resp, true);
                if (isset($data['data']) && is_array($data['data'])) {
                    $free_models = [];
                    foreach ($data['data'] as $m) {
                        $id = $m['id'] ?? '';
                        if (empty($id)) continue;
                        if (strpos($id, ':free') !== false || strpos($id, 'free') !== false) {
                            $free_models[] = $id;
                        }
                    }

                    if (!empty($free_models)) {
                        @file_put_contents($cache_file, json_encode($free_models));
                        $memory_cache = $free_models;
                        return $memory_cache;
                    }
                }
            }
            break;
        }

        $memory_cache = $fallback_models;
        return $memory_cache;
    }
}

if (!function_exists('isEmailBlacklisted')) {
    function isEmailBlacklisted($db_conn, $email) {
        if (!$db_conn || $db_conn->connect_error) {
            return ['blacklisted' => false, 'reason' => null];
        }
        $clean = strtolower(trim((string)$email));
        if (empty($clean)) {
            return ['blacklisted' => false, 'reason' => null];
        }

        // Support extraction from "Name <email@domain.com>"
        if (preg_match('/<([^>]+)>/', $clean, $m)) {
            $clean = trim($m[1]);
        }

        $stmt = $db_conn->prepare("SELECT email, company_name, reason FROM email_blacklist WHERE LOWER(email) = ? LIMIT 1");
        if ($stmt) {
            $stmt->bind_param("s", $clean);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res && $res->num_rows > 0) {
                $row = $res->fetch_assoc();
                $stmt->close();
                return [
                    'blacklisted' => true,
                    'email' => $row['email'],
                    'company_name' => $row['company_name'],
                    'reason' => !empty($row['reason']) ? $row['reason'] : 'Blacklisted by administrator'
                ];
            }
            $stmt->close();
        }
        return ['blacklisted' => false, 'reason' => null];
    }
}




