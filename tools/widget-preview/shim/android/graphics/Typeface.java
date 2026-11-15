package android.graphics;
import java.awt.Font;
public class Typeface {
    public static final int NORMAL = 0, BOLD = 1, ITALIC = 2, BOLD_ITALIC = 3;
    public static Typeface DEFAULT, DEFAULT_BOLD;
    public final Font font; public final String name;
    Typeface(Font f, String n) { font = f; name = n; }
    static java.util.Map<String, Typeface> registry = new java.util.HashMap<>();
    /** Shim-only: register a font file for a family name. */
    public static Typeface createFromFile(String path) {
        try { Font f = Font.createFont(Font.TRUETYPE_FONT, new java.io.File(path)); return new Typeface(f, path); }
        catch (Exception e) { throw new RuntimeException(e); }
    }
    public static Typeface createFromAsset(android.content.res.AssetManager am, String path) { return createFromFile(am.baseDir + path); }
    public static void register(String family, int style, Typeface t) { registry.put(family + "#" + style, t); if (DEFAULT == null) { DEFAULT = t; DEFAULT_BOLD = t; } }
    public static Typeface create(String family, int style) {
        Typeface t = registry.get((family == null ? "sans-serif" : family) + "#" + style);
        if (t == null) t = registry.get("sans-serif#" + style);
        if (t == null) t = DEFAULT;
        return t;
    }
    public static Typeface create(Typeface base, int style) { return base == null ? create("sans-serif", style) : base; }
}
