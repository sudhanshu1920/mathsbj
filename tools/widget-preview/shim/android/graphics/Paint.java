package android.graphics;
import java.awt.Font;
import java.awt.font.*;
import java.util.HashMap;
import java.util.Map;
public class Paint {
    public static final int ANTI_ALIAS_FLAG = 1, FILTER_BITMAP_FLAG = 2, DITHER_FLAG = 4, SUBPIXEL_TEXT_FLAG = 8;
    public enum Style { FILL, STROKE, FILL_AND_STROKE }
    public enum Cap { BUTT, ROUND, SQUARE }
    public enum Join { MITER, ROUND, BEVEL }
    public enum Align { LEFT, CENTER, RIGHT }
    public static class FontMetrics { public float top, ascent, descent, bottom, leading; }
    int color = 0xFF000000; Style style = Style.FILL; float strokeWidth = 0f; Cap cap = Cap.BUTT; Join join = Join.MITER;
    Shader shader; MaskFilter mask; float textSize = 12f; Typeface typeface; Align align = Align.LEFT; float letterSpacing = 0f;
    float shR, shDx, shDy; int shColor;
    public Paint() {}
    public Paint(int flags) {}
    public void setAntiAlias(boolean b) {}
    public void setDither(boolean b) {}
    public void setFilterBitmap(boolean b) {}
    public void setColor(int c) { color = c; }
    public int getColor() { return color; }
    public void setAlpha(int a) { color = (a & 255) << 24 | (color & 0xFFFFFF); }
    public int getAlpha() { return color >>> 24; }
    public void setStyle(Style s) { style = s; }
    public void setStrokeWidth(float w) { strokeWidth = w; }
    public float getStrokeWidth() { return strokeWidth; }
    public void setStrokeCap(Cap c) { cap = c; }
    public void setStrokeJoin(Join j) { join = j; }
    public Shader setShader(Shader s) { shader = s; return s; }
    public MaskFilter setMaskFilter(MaskFilter m) { mask = m; return m; }
    public void setTextSize(float s) { textSize = s; }
    public void setFontFeatureSettings(String settings) { /* Java2D has no OpenType feature toggle; the real Android renderer uses tnum. */ }
    public float getTextSize() { return textSize; }
    public Typeface setTypeface(Typeface t) { typeface = t; return t; }
    public void setTextAlign(Align a) { align = a; }
    public void setLetterSpacing(float ls) { letterSpacing = ls; }
    public void setShadowLayer(float r, float dx, float dy, int c) { shR = r; shDx = dx; shDy = dy; shColor = c; }
    public void clearShadowLayer() { shR = 0; }
    Font awtFont() {
        Typeface t = typeface != null ? typeface : Typeface.DEFAULT;
        Font f = t.font.deriveFont(Font.PLAIN, textSize);
        if (letterSpacing != 0f) { Map<java.awt.font.TextAttribute, Object> m = new HashMap<>(); m.put(java.awt.font.TextAttribute.TRACKING, letterSpacing); f = f.deriveFont(m); }
        return f;
    }
    static final FontRenderContext FRC = new FontRenderContext(null, true, true);
    public float measureText(String s) { return (float) awtFont().createGlyphVector(FRC, s).getLogicalBounds().getWidth(); }
    public float ascent() { return -awtFont().getLineMetrics("Hg", FRC).getAscent(); }
    public float descent() { return awtFont().getLineMetrics("Hg", FRC).getDescent(); }
    public float getFontMetrics(FontMetrics fm) { LineMetrics lm = awtFont().getLineMetrics("Hg", FRC); fm.ascent = -lm.getAscent(); fm.top = fm.ascent; fm.descent = lm.getDescent(); fm.bottom = fm.descent; fm.leading = lm.getLeading(); return fm.descent - fm.ascent; }
    public FontMetrics getFontMetrics() { FontMetrics fm = new FontMetrics(); getFontMetrics(fm); return fm; }
}
