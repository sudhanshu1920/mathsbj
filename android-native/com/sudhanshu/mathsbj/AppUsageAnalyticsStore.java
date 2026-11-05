package com.sudhanshu.mathsbj;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Calendar;
import java.util.Iterator;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public final class AppUsageAnalyticsStore {
    private static final String PREFS = "app_usage_analytics_local";
    private static final String KEY_PAYLOAD = "encrypted_daily_usage";
    private static final String KEY_ALIAS = "math_master_app_usage_aes_gcm_v1";
    private static final int DEFAULT_RETENTION_DAYS = 90;

    public synchronized JSONObject read(Context context) throws Exception {
        SharedPreferences preferences = preferences(context);
        String encoded = preferences.getString(KEY_PAYLOAD, null);
        if (encoded == null || encoded.isEmpty()) return emptyData();

        byte[] payload = Base64.decode(encoded, Base64.NO_WRAP);
        if (payload.length <= 12) throw new IOException("Encrypted local usage data is incomplete.");
        byte[] iv = new byte[12];
        byte[] ciphertext = new byte[payload.length - iv.length];
        System.arraycopy(payload, 0, iv, 0, iv.length);
        System.arraycopy(payload, iv.length, ciphertext, 0, ciphertext.length);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
        byte[] plaintext = cipher.doFinal(ciphertext);
        return new JSONObject(new String(plaintext, StandardCharsets.UTF_8));
    }

    public synchronized void upsertDays(Context context, JSONObject replacements) throws Exception {
        JSONObject data = read(context);
        JSONObject days = data.optJSONObject("days");
        if (days == null) days = new JSONObject();

        Iterator<String> iterator = replacements.keys();
        while (iterator.hasNext()) {
            String date = iterator.next();
            JSONObject day = replacements.optJSONObject(date);
            if (day != null) days.put(date, day);
        }
        data.put("days", days);
        data.put("lastUpdatedAt", System.currentTimeMillis());
        prune(data);
        write(context, data);
    }

    public synchronized int getRetentionDays(Context context) throws Exception {
        return read(context).optInt("retentionDays", DEFAULT_RETENTION_DAYS);
    }

    public synchronized int setRetentionDays(Context context, int retentionDays) throws Exception {
        int safe = retentionDays == 30 || retentionDays == 90 || retentionDays == 180
            ? retentionDays : DEFAULT_RETENTION_DAYS;
        JSONObject data = read(context);
        data.put("retentionDays", safe);
        prune(data);
        write(context, data);
        return safe;
    }

    public synchronized void clear(Context context) {
        preferences(context).edit().remove(KEY_PAYLOAD).commit();
    }

    private void write(Context context, JSONObject data) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] iv = cipher.getIV();
        byte[] ciphertext = cipher.doFinal(data.toString().getBytes(StandardCharsets.UTF_8));
        ByteBuffer buffer = ByteBuffer.allocate(iv.length + ciphertext.length);
        buffer.put(iv);
        buffer.put(ciphertext);
        String encoded = Base64.encodeToString(buffer.array(), Base64.NO_WRAP);
        if (!preferences(context).edit().putString(KEY_PAYLOAD, encoded).commit()) {
            throw new IOException("Could not persist encrypted app usage data locally.");
        }
    }

    private void prune(JSONObject data) throws JSONException {
        JSONObject days = data.optJSONObject("days");
        if (days == null) return;
        int retention = data.optInt("retentionDays", DEFAULT_RETENTION_DAYS);
        if (retention != 30 && retention != 90 && retention != 180) retention = DEFAULT_RETENTION_DAYS;

        Calendar cutoff = Calendar.getInstance();
        cutoff.set(Calendar.HOUR_OF_DAY, 0);
        cutoff.set(Calendar.MINUTE, 0);
        cutoff.set(Calendar.SECOND, 0);
        cutoff.set(Calendar.MILLISECOND, 0);
        cutoff.add(Calendar.DAY_OF_YEAR, -(retention - 1));
        java.text.SimpleDateFormat formatter = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US);
        formatter.setTimeZone(java.util.TimeZone.getDefault());
        String cutoffDate = formatter.format(cutoff.getTime());

        java.util.ArrayList<String> remove = new java.util.ArrayList<>();
        Iterator<String> keys = days.keys();
        while (keys.hasNext()) {
            String date = keys.next();
            if (date.compareTo(cutoffDate) < 0) remove.add(date);
        }
        for (String date : remove) days.remove(date);
        data.put("days", days);
        data.put("retentionDays", retention);
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        }

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
            .build();
        generator.init(spec);
        return generator.generateKey();
    }

    private SharedPreferences preferences(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private JSONObject emptyData() throws JSONException {
        JSONObject data = new JSONObject();
        data.put("days", new JSONObject());
        data.put("retentionDays", DEFAULT_RETENTION_DAYS);
        data.put("lastUpdatedAt", 0L);
        return data;
    }
}
