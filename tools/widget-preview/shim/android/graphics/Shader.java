package android.graphics;
public class Shader {
    public enum TileMode { CLAMP, REPEAT, MIRROR }
    java.awt.Paint awt;
    static float[] fixPositions(float[] p, int n) {
        float[] out = new float[n];
        for (int i = 0; i < n; i++) out[i] = p == null ? (n == 1 ? 0f : i / (float) (n - 1)) : p[i];
        for (int i = 1; i < n; i++) if (out[i] <= out[i - 1]) out[i] = Math.nextUp(out[i - 1] + 1e-4f);
        if (out[n - 1] > 1f) { float s = 1f / out[n - 1]; for (int i = 0; i < n; i++) out[i] *= s; for (int i = 1; i < n; i++) if (out[i] <= out[i - 1]) out[i] = out[i - 1] + 1e-6f; }
        return out;
    }
    static java.awt.Color[] toAwt(int[] c) {
        java.awt.Color[] o = new java.awt.Color[c.length];
        for (int i = 0; i < c.length; i++) o[i] = new java.awt.Color(c[i], true);
        return o;
    }
}
