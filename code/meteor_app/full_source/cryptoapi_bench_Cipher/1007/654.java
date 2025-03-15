package com.peerio.app;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.Promise;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.security.KeyPairGeneratorSpec;
import android.util.Log;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.math.BigInteger;
import java.security.InvalidAlgorithmParameterException;
import java.security.InvalidKeyException;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.KeyStoreException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.NoSuchProviderException;
import java.security.Signature;
import java.security.SignatureException;
import java.security.UnrecoverableEntryException;
import java.security.cert.CertificateException;
import java.security.interfaces.RSAPrivateKey;
import java.util.Calendar;

import javax.crypto.BadPaddingException;
import javax.crypto.Cipher;
import javax.crypto.IllegalBlockSizeException;
import javax.crypto.KeyGenerator;
import javax.crypto.NoSuchPaddingException;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import javax.security.auth.x500.X500Principal;

import android.util.Base64;

import static android.content.ContentValues.TAG;

public class RNKeychain {
    
    
    private static final String ANDROID_KEY_STORE = "AndroidKeyStore";
    private static final String ALIAS_AES = "peerio-mobile-android-key";
    private static final String ALIAS_RSA = "peerio-mobile-android-key-rsa";
    private static final String RSA_SIGN_CONSTANT = "Peerio Mobile Keystore";
    private KeyStore _keyStore;
    

    private String serialize(String data, boolean decode) {
        try {
            SecretKey secretKey = null;
            if (android.os.Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                // On Android 5 calculate AES-GCM key by getting an RSA key pair
                // from KeyStore and deterministically (without padding) signing
                // a constant string with it, then calculating a hash of the signature.
                final KeyStore.PrivateKeyEntry privateKeyEntry =
                        (KeyStore.PrivateKeyEntry) _keyStore.getEntry(ALIAS_RSA, null);
                final RSAPrivateKey privateKey = (RSAPrivateKey) privateKeyEntry.getPrivateKey();

                // Calculate signature of RSA_SIGN_CONSTANT.
                Signature sig = Signature.getInstance("NONEwithRSA");
                sig.initSign(privateKey);
                sig.update(RSA_SIGN_CONSTANT.getBytes("UTF-8"));
                byte[] signature = sig.sign();

                // Hash signature.
                MessageDigest md= MessageDigest.getInstance("SHA-256");
                md.update(signature);
                byte[] keyBytes = md.digest();

                secretKey = new SecretKeySpec(keyBytes, "AES");
            } else {
                // On Android 6> get AES-GCM key directly from KeyStore.
                final KeyStore.SecretKeyEntry secretKeyEntry =
                        (KeyStore.SecretKeyEntry) _keyStore.getEntry(ALIAS_AES, null);
                secretKey = secretKeyEntry.getSecretKey();
            }

            Log.v(TAG, secretKey.toString());
            String result = null;
            if (decode) {
                String[] items = data.split(",");
                byte[] iv = Base64.decode(items[0], Base64.DEFAULT);
                final GCMParameterSpec spec = new GCMParameterSpec(128, iv);
                final Cipher decipher = Cipher.getInstance("AES/GCM/NoPadding");
                decipher.init(Cipher.DECRYPT_MODE, secretKey, spec);
                byte[] encodedData = Base64.decode(items[1], Base64.DEFAULT);
                result = new String(decipher.doFinal(encodedData), StandardCharsets.UTF_8);
            } else {
                final Cipher encipher = Cipher.getInstance("AES/GCM/NoPadding");
                encipher.init(Cipher.ENCRYPT_MODE, secretKey);
                byte[] iv = encipher.getIV();
                byte[] dataToEncode = data.getBytes(StandardCharsets.UTF_8);
                byte[] intermediate = encipher.doFinal(dataToEncode);
                result = Base64.encodeToString(iv, Base64.DEFAULT)
                    + "," + Base64.encodeToString(intermediate, Base64.DEFAULT);
                Log.v(TAG, result);
            }
            return result;
        } catch (UnrecoverableEntryException e) {
            Log.e(TAG, Log.getStackTraceString(e));
        } catch (UnsupportedOperationException e) {
            Log.e(TAG, Log.getStackTraceString(e));
        } catch (NoSuchPaddingException e) {
            Log.e(TAG, Log.getStackTraceString(e));
        } catch (InvalidKeyException e) {
            Log.e(TAG, Log.getStackTraceString(e));
        } catch (IllegalBlockSizeException e) {
            Log.e(TAG, Log.getStackTraceString(e));
        } catch (BadPaddingException e) {
            // Won't be thrown when using GCM.
            Log.e(TAG, Log.getStackTraceString(e));
        } catch (InvalidAlgorithmParameterException e) {
            Log.e(TAG, Log.getStackTraceString(e));
        } catch (UnsupportedEncodingException e) {
            Log.e(TAG, Log.getStackTraceString(e));
        } catch (NoSuchAlgorithmException e) {
            Log.e(TAG, Log.getStackTraceString(e));
        } catch (KeyStoreException e) {
            Log.e(TAG, Log.getStackTraceString(e));
        } catch (SignatureException e) {
                Log.e(TAG, Log.getStackTraceString(e));
            }
        return null;
    }

}
