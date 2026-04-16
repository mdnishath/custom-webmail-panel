<?php
$token = isset($_GET["t"]) ? $_GET["t"] : "";
$user = "";
$pass = "";

$tokenFile = "/tmp/rc_autologin_tokens";

if ($token && file_exists($tokenFile)) {
    $tokens = json_decode(file_get_contents($tokenFile), true);
    if (isset($tokens[$token]) && (time() - $tokens[$token]["time"]) < 120) {
        $user = $tokens[$token]["user"];
        $pass = $tokens[$token]["pass"];
        unset($tokens[$token]);
        file_put_contents($tokenFile, json_encode($tokens));
    }
}

if (!$user || !$pass) {
    die("Invalid or expired token. <a href='/'>Go to login</a>");
}

// Create unique instance hash from email (6 chars)
$instance = substr(md5($user), 0, 8);
$basePath = "/m/" . $instance . "/";
$baseUrl = "https://webmail.YOUR_DOMAIN" . $basePath;
$sessionName = "rcsess_" . $instance;

// Step 1: Get fresh login page with CSRF token (via the multi-session path)
$ch = curl_init($baseUrl . "?_task=login");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
$response = curl_exec($ch);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$headers = substr($response, 0, $headerSize);
$body = substr($response, $headerSize);
curl_close($ch);

// Get session cookie (with the unique name)
preg_match('/' . $sessionName . '=([^;]+)/', $headers, $sessMatch);
$sessId = isset($sessMatch[1]) ? $sessMatch[1] : "";

// Fallback: try default session name
if (!$sessId) {
    preg_match('/roundcube_sessid=([^;]+)/', $headers, $sessMatch2);
    $sessId = isset($sessMatch2[1]) ? $sessMatch2[1] : "";
    $sessionName = "roundcube_sessid";
}

// Get CSRF token
preg_match('/name="_token" value="([^"]+)"/', $body, $tokenMatch);
$csrfToken = isset($tokenMatch[1]) ? $tokenMatch[1] : "";

if (!$sessId || !$csrfToken) {
    die("Could not connect to webmail (no session/token). Session: $sessId, Token: " . substr($csrfToken, 0, 5) . "... <a href='/'>Try again</a>");
}

// Step 2: Login
$postData = http_build_query(array(
    "_task" => "login",
    "_action" => "login",
    "_timezone" => "Asia/Dhaka",
    "_token" => $csrfToken,
    "_user" => $user,
    "_pass" => $pass,
));

$ch = curl_init($baseUrl . "?_task=login");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
curl_setopt($ch, CURLOPT_COOKIE, $sessionName . "=" . $sessId);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
$loginResponse = curl_exec($ch);
$loginHeaderSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$loginHeaders = substr($loginResponse, 0, $loginHeaderSize);
curl_close($ch);

// Step 3: Forward cookies with correct path
preg_match_all('/Set-Cookie:\s*([^\r\n]+)/i', $loginHeaders, $cookieResults);
foreach ($cookieResults[1] as $cookie) {
    // Update cookie path to our instance path
    if (strpos($cookie, "path=") !== false || strpos($cookie, "Path=") !== false) {
        $cookie = preg_replace('/[Pp]ath=[^;]*/', 'Path=' . $basePath, $cookie);
    } else {
        $cookie .= '; Path=' . $basePath;
    }
    header("Set-Cookie: " . $cookie, false);
}

// Step 4: Redirect to inbox
header("Location: " . $basePath . "?_task=mail");
exit;
