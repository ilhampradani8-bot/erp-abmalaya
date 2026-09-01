<?php
// Auto-login configuration for Adminer Database Management
if (!isset($_GET['username']) && !isset($_POST['auth'])) {
    $_GET['username'] = 'root';
    $_GET['db'] = 'abmalaya_erp';
    $_GET['server'] = '127.0.0.1';
}

function adminer_object() {
    class AdminerAutoLogin extends Adminer {
        function credentials() {
            return array('127.0.0.1', 'root', 'root');
        }
        function database() {
            return 'abmalaya_erp';
        }
        function login($login, $password) {
            return true;
        }
    }
    return new AdminerAutoLogin;
}

include __DIR__ . '/adminer-core.php';
