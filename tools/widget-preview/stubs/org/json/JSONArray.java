package org.json;
import java.util.*;
public class JSONArray {
    private final List<Object> items = new ArrayList<>();
    public JSONArray() {}
    public JSONArray(String json) throws JSONException {
        String s = json == null ? "" : json.trim();
        if (!s.startsWith("[") || !s.endsWith("]")) throw new JSONException("not an array");
        s = s.substring(1, s.length() - 1).trim();
        if (s.isEmpty()) return;
        for (String part : s.split(",")) { part = part.trim(); if (part.startsWith("\"")) part = part.substring(1, part.length() - 1); items.add(part); }
    }
    public int length() { return items.size(); }
    public String optString(int i, String d) { return i >= 0 && i < items.size() ? String.valueOf(items.get(i)) : d; }
    public JSONArray put(String v) { items.add(v); return this; }
    @Override public String toString() { StringBuilder b = new StringBuilder("["); for (int i = 0; i < items.size(); i++) { if (i > 0) b.append(','); b.append('"').append(items.get(i)).append('"'); } return b.append(']').toString(); }
}
