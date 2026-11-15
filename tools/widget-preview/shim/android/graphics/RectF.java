package android.graphics;
public class RectF {
    public float left, top, right, bottom;
    public RectF() {}
    public RectF(float l, float t, float r, float b) { left = l; top = t; right = r; bottom = b; }
    public RectF(RectF o) { this(o.left, o.top, o.right, o.bottom); }
    public final float width() { return right - left; }
    public final float height() { return bottom - top; }
    public final float centerX() { return (left + right) * 0.5f; }
    public final float centerY() { return (top + bottom) * 0.5f; }
    public void set(float l, float t, float r, float b) { left = l; top = t; right = r; bottom = b; }
    public void inset(float dx, float dy) { left += dx; top += dy; right -= dx; bottom -= dy; }
    public void offset(float dx, float dy) { left += dx; top += dy; right += dx; bottom += dy; }
}
