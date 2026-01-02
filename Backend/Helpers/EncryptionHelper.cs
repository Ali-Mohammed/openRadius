using System.Security.Cryptography;
using System.Text;

namespace Backend.Helpers;

public static class EncryptionHelper
{
    /// <summary>
    /// Encrypt data using AES-256-CBC with OpenSSL-compatible format (for SAS API payloads)
    /// Uses EVP_BytesToKey for key derivation (same as PHP/CryptoJS)
    /// </summary>
    public static string EncryptAES(string plainText, string key)
    {
        if (string.IsNullOrEmpty(plainText))
            return string.Empty;

        byte[] plainBytes = Encoding.UTF8.GetBytes(plainText);
        byte[] keyBytes = Encoding.UTF8.GetBytes(key);
        
        // Generate random 8-byte salt (same as PHP openssl_random_pseudo_bytes(8))
        byte[] salt = new byte[8];
        using (var rng = RandomNumberGenerator.Create())
        {
            rng.GetBytes(salt);
        }

        // Derive key and IV using EVP_BytesToKey algorithm (same as PHP evpkdf function)
        var (derivedKey, iv) = EvpBytesToKey(keyBytes, salt);

        // Encrypt using AES-256-CBC
        using var aes = Aes.Create();
        aes.KeySize = 256;
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.PKCS7;
        aes.Key = derivedKey;
        aes.IV = iv;

        byte[] encrypted;
        using (var encryptor = aes.CreateEncryptor())
        using (var msEncrypt = new MemoryStream())
        {
            using (var csEncrypt = new CryptoStream(msEncrypt, encryptor, CryptoStreamMode.Write))
            {
                csEncrypt.Write(plainBytes, 0, plainBytes.Length);
                csEncrypt.FlushFinalBlock();
            }
            encrypted = msEncrypt.ToArray();
        }

        // Encode in OpenSSL format: "Salted__" + salt + encrypted data
        byte[] result = new byte[16 + encrypted.Length];
        Encoding.UTF8.GetBytes("Salted__").CopyTo(result, 0);
        Array.Copy(salt, 0, result, 8, 8);
        Array.Copy(encrypted, 0, result, 16, encrypted.Length);

        return Convert.ToBase64String(result);
    }

    /// <summary>
    /// Decrypt data using AES-256-CBC with OpenSSL format
    /// </summary>
    public static string DecryptAES(string base64Text, string key)
    {
        if (string.IsNullOrEmpty(base64Text))
            return string.Empty;

        byte[] data = Convert.FromBase64String(base64Text);
        byte[] keyBytes = Encoding.UTF8.GetBytes(key);

        // Check for "Salted__" prefix
        if (data.Length < 16 || Encoding.UTF8.GetString(data, 0, 8) != "Salted__")
        {
            throw new InvalidOperationException("Invalid encrypted data format");
        }

        // Extract salt (8 bytes after "Salted__")
        byte[] salt = new byte[8];
        Array.Copy(data, 8, salt, 0, 8);

        // Extract encrypted data (rest after salt)
        byte[] encrypted = new byte[data.Length - 16];
        Array.Copy(data, 16, encrypted, 0, encrypted.Length);

        // Derive key and IV using EVP_BytesToKey algorithm
        var (derivedKey, iv) = EvpBytesToKey(keyBytes, salt);

        // Decrypt using AES-256-CBC
        using var aes = Aes.Create();
        aes.KeySize = 256;
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.PKCS7;
        aes.Key = derivedKey;
        aes.IV = iv;

        using var decryptor = aes.CreateDecryptor();
        using var msDecrypt = new MemoryStream(encrypted);
        using var csDecrypt = new CryptoStream(msDecrypt, decryptor, CryptoStreamMode.Read);
        using var srDecrypt = new StreamReader(csDecrypt);
        
        return srDecrypt.ReadToEnd();
    }

    /// <summary>
    /// EVP_BytesToKey implementation (matches PHP's evpkdf function)
    /// Derives key and IV from passphrase and salt using MD5
    /// </summary>
    private static (byte[] key, byte[] iv) EvpBytesToKey(byte[] password, byte[] salt)
    {
        const int keySize = 32; // 256 bits for AES-256
        const int ivSize = 16;  // 128 bits for AES IV
        const int totalSize = keySize + ivSize; // 48 bytes total

        byte[] salted = new byte[0];
        byte[] dx = new byte[0];

        using (var md5 = MD5.Create())
        {
            while (salted.Length < totalSize)
            {
                // Hash: MD5(previous + password + salt)
                byte[] data = new byte[dx.Length + password.Length + salt.Length];
                Array.Copy(dx, 0, data, 0, dx.Length);
                Array.Copy(password, 0, data, dx.Length, password.Length);
                Array.Copy(salt, 0, data, dx.Length + password.Length, salt.Length);

                dx = md5.ComputeHash(data);

                // Append to salted
                byte[] newSalted = new byte[salted.Length + dx.Length];
                Array.Copy(salted, 0, newSalted, 0, salted.Length);
                Array.Copy(dx, 0, newSalted, salted.Length, dx.Length);
                salted = newSalted;
            }
        }

        // Extract key (first 32 bytes) and IV (next 16 bytes)
        byte[] key = new byte[keySize];
        byte[] iv = new byte[ivSize];
        Array.Copy(salted, 0, key, 0, keySize);
        Array.Copy(salted, keySize, iv, 0, ivSize);

        return (key, iv);
    }
}
