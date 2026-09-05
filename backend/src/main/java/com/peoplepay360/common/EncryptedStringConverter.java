package com.peoplepay360.common;

import com.peoplepay360.config.AppProperties;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/** AES-256-GCM converter with a random 12-byte IV per value. Used for bank account numbers and AI API keys. */
@Component
@Converter
public class EncryptedStringConverter implements AttributeConverter<String, String> {
    private static final int IV_LEN = 12;
    private static final int TAG_BITS = 128;
    private static byte[] KEY;

    private final AppProperties props;
    @Autowired
    public EncryptedStringConverter(AppProperties props) {
        this.props = props;
        init();
    }
    // JPA may instantiate via no-arg; Spring injects the managed instance for key setup.
    public EncryptedStringConverter() { this.props = null; }

    private void init() {
        if (KEY != null || props == null) return;
        String raw = props.getEncryptionKey();
        try {
            if (raw != null && !raw.isBlank()) {
                KEY = Base64.getDecoder().decode(raw);
            } else {
                // Development fallback: derive a stable key. A warning is logged by the application on startup.
                KEY = MessageDigest.getInstance("SHA-256")
                        .digest(("peoplepay360-dev-key").getBytes(StandardCharsets.UTF_8));
            }
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialise encryption key", e);
        }
    }

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null) return null;
        try {
            byte[] iv = new byte[IV_LEN];
            new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(KEY, "AES"), new GCMParameterSpec(TAG_BITS, iv));
            byte[] ct = cipher.doFinal(attribute.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(ct, 0, out, iv.length, ct.length);
            return Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("Encryption failed", e);
        }
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            byte[] all = Base64.getDecoder().decode(dbData);
            byte[] iv = new byte[IV_LEN];
            System.arraycopy(all, 0, iv, 0, IV_LEN);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(KEY, "AES"), new GCMParameterSpec(TAG_BITS, iv));
            byte[] pt = cipher.doFinal(all, IV_LEN, all.length - IV_LEN);
            return new String(pt, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Decryption failed", e);
        }
    }
}
