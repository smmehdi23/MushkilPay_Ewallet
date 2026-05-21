import hashlib
import base64
import hmac
import time

def verify_password(plain, hashed):
    try:
        parts = hashed.split("$")
        if len(parts) != 4:
            return False
        algo, iterations_raw, salt_b64, digest_b64 = parts
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(iterations_raw)
        salt = base64.b64decode(salt_b64)
        expected_digest = base64.b64decode(digest_b64)
        calculated_digest = hashlib.pbkdf2_hmac(
            "sha256",
            plain.encode("utf-8"),
            salt,
            iterations,
        )
        return hmac.compare_digest(calculated_digest, expected_digest)
    except Exception as e:
        print(f"Error verifying {plain}: {e}")
        return False

target_hash = "pbkdf2_sha256$260000$3stpGz9i4jmhNb4ztayCMg==$uZniLJAQbLt3hn18tHGyTI80zthAol0DUtjJZmhnHeY="

# Common candidates
candidates = [
    "1234", "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999",
    "123456", "000000", "111111", "password", "mehdi", "mustafa", "aayan", "admin", "123"
]

print(f"Testing {len(candidates)} common candidates...")
start_time = time.time()
for c in candidates:
    if verify_password(c, target_hash):
        print(f"FOUND! The value is: {c}")
        break
else:
    print("Not found in common candidates. Starting 4-digit brute force (0000-9999)...")
    for i in range(10000):
        pin = f"{i:04d}"
        if verify_password(pin, target_hash):
            print(f"FOUND! The value is: {pin}")
            break
        if i % 100 == 0 and i > 0:
            elapsed = time.time() - start_time
            print(f"Checked {i} PINs... ({elapsed:.2f}s)")
    else:
        print("Not found in 4-digit PINs.")

end_time = time.time()
print(f"Total time: {end_time - start_time:.2f}s")
