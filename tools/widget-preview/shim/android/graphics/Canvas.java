package android.graphics;
import java.awt.*;
import java.awt.font.GlyphVector;
import java.awt.geom.*;
import java.awt.image.BufferedImage;
import java.util.ArrayDeque;
public class Canvas {
    final Bitmap bmp; final Graphics2D g; final ArrayDeque<Object[]> stack = new ArrayDeque<>();
    public Canvas(Bitmap b) {
        bmp = b; g = b.image.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
    }
    public int getWidth() { return bmp.getWidth(); }
    public int getHeight() { return bmp.getHeight(); }
    public void drawBitmap(Bitmap bitmap, Rect src, RectF dst, Paint paint) {
        if (bitmap == null || bitmap.isRecycled() || dst == null) return;
        int sx0 = src == null ? 0 : src.left, sy0 = src == null ? 0 : src.top;
        int sx1 = src == null ? bitmap.getWidth() : src.right, sy1 = src == null ? bitmap.getHeight() : src.bottom;
        int alpha = paint == null ? 255 : Math.max(0, Math.min(255, paint.getAlpha()));
        Composite previous = g.getComposite();
        if (alpha < 255) g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, alpha / 255f));
        g.drawImage(bitmap.image,
            Math.round(dst.left), Math.round(dst.top), Math.round(dst.right), Math.round(dst.bottom),
            sx0, sy0, sx1, sy1, null);
        g.setComposite(previous);
    }
    public int save() { stack.push(new Object[] { g.getTransform(), g.getClip() }); return stack.size(); }
    public void restore() { Object[] s = stack.pop(); g.setTransform((AffineTransform) s[0]); g.setClip((Shape) s[1]); }
    public void restoreToCount(int saveCount) { while (!stack.isEmpty() && stack.size() >= saveCount) restore(); }
    public void translate(float dx, float dy) { g.translate(dx, dy); }
    public void scale(float sx, float sy) { g.scale(sx, sy); }
    public void scale(float sx, float sy, float px, float py) { g.translate(px, py); g.scale(sx, sy); g.translate(-px, -py); }
    public void rotate(float deg) { g.rotate(Math.toRadians(deg)); }
    public void rotate(float deg, float px, float py) { g.rotate(Math.toRadians(deg), px, py); }
    public boolean clipPath(Path p) { g.clip(p.shape()); return true; }
    public boolean clipRect(RectF r) { g.clip(new Rectangle2D.Float(r.left, r.top, r.width(), r.height())); return true; }
    public boolean clipRect(float left, float top, float right, float bottom) { g.clip(new Rectangle2D.Float(left, top, right - left, bottom - top)); return true; }
    public void drawColor(int c) { AffineTransform t = g.getTransform(); g.setTransform(new AffineTransform()); g.setPaint(new java.awt.Color(c, true)); g.fillRect(0, 0, getWidth(), getHeight()); g.setTransform(t); }
    public void drawRect(RectF r, Paint p) { paint(new Rectangle2D.Float(r.left, r.top, r.width(), r.height()), p); }
    public void drawRoundRect(RectF r, float rx, float ry, Paint p) { paint(new RoundRectangle2D.Float(r.left, r.top, r.width(), r.height(), rx * 2, ry * 2), p); }
    public void drawRoundRect(float left, float top, float right, float bottom, float rx, float ry, Paint p) { paint(new RoundRectangle2D.Float(left, top, right - left, bottom - top, rx * 2, ry * 2), p); }
    public void drawCircle(float cx, float cy, float r, Paint p) { paint(new Ellipse2D.Float(cx - r, cy - r, r * 2, r * 2), p); }
    public void drawOval(RectF r, Paint p) { paint(new Ellipse2D.Float(r.left, r.top, r.width(), r.height()), p); }
    public void drawLine(float x0, float y0, float x1, float y1, Paint p) { paint(new Line2D.Float(x0, y0, x1, y1), p); }
    public void drawPath(Path path, Paint p) { paint(path.shape(), p); }
    public void drawArc(RectF o, float start, float sweep, boolean useCenter, Paint p) {
        paint(new Arc2D.Float(o.left, o.top, o.width(), o.height(), -start, -sweep, useCenter ? Arc2D.PIE : Arc2D.OPEN), p);
    }
    public void drawText(String s, float x, float y, Paint p) {
        GlyphVector gv = p.awtFont().createGlyphVector(Paint.FRC, s);
        float w = (float) gv.getLogicalBounds().getWidth();
        float x0 = p.align == Paint.Align.CENTER ? x - w / 2f : (p.align == Paint.Align.RIGHT ? x - w : x);
        Shape outline = gv.getOutline(x0, y);
        if (p.shR > 0f || p.shDx != 0f || p.shDy != 0f) {
            Paint sp = new Paint(); sp.color = p.shColor; sp.mask = p.shR > 0 ? new BlurMaskFilter(p.shR, BlurMaskFilter.Blur.NORMAL) : null;
            save(); g.translate(p.shDx, p.shDy); paint(outline, sp); restore();
        }
        Paint fp = new Paint(); fp.color = p.color; fp.shader = p.shader; fp.style = Paint.Style.FILL;
        paint(outline, fp);
    }
    // ---------- painting core ----------
    java.awt.Paint awtPaint(Paint p) {
        if (p.shader != null) return p.shader.awt;
        return new java.awt.Color(p.color, true);
    }
    float alphaFactor(Paint p) { return p.shader != null ? Math.max(0f, Math.min(1f, (p.color >>> 24) / 255f)) : 1f; }
    void paint(Shape s, Paint p) {
        if (p.style == Paint.Style.FILL_AND_STROKE) { Paint f = copy(p); f.style = Paint.Style.FILL; paint(s, f); Paint st = copy(p); st.style = Paint.Style.STROKE; paint(s, st); return; }
        Shape shape = s;
        if (p.style == Paint.Style.STROKE) {
            int cap = p.cap == Paint.Cap.ROUND ? BasicStroke.CAP_ROUND : (p.cap == Paint.Cap.SQUARE ? BasicStroke.CAP_SQUARE : BasicStroke.CAP_BUTT);
            int join = p.join == Paint.Join.ROUND ? BasicStroke.JOIN_ROUND : (p.join == Paint.Join.BEVEL ? BasicStroke.JOIN_BEVEL : BasicStroke.JOIN_MITER);
            shape = new BasicStroke(Math.max(p.strokeWidth, 0.01f), cap, join, 4f).createStrokedShape(s);
        }
        java.awt.Paint ap = awtPaint(p); float af = alphaFactor(p);
        Composite old = g.getComposite();
        if (af < 1f) g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, af));
        if (p.mask instanceof BlurMaskFilter) blurFill(shape, ap, ((BlurMaskFilter) p.mask).radius);
        else { g.setPaint(ap); g.fill(shape); }
        g.setComposite(old);
    }
    static Paint copy(Paint p) { Paint c = new Paint(); c.color = p.color; c.style = p.style; c.strokeWidth = p.strokeWidth; c.cap = p.cap; c.join = p.join; c.shader = p.shader; c.mask = p.mask; return c; }
    void blurFill(Shape userShape, java.awt.Paint ap, float radius) {
        float sigma = radius > 0 ? 0.57735f * radius + 0.5f : 0f;
        AffineTransform xf = g.getTransform();
        Rectangle2D b = xf.createTransformedShape(userShape).getBounds2D();
        int m = (int) Math.ceil(3 * sigma) + 2;
        int x0 = (int) Math.floor(b.getX()) - m, y0 = (int) Math.floor(b.getY()) - m;
        int w = (int) Math.ceil(b.getWidth()) + 2 * m, h = (int) Math.ceil(b.getHeight()) + 2 * m;
        if (w <= 0 || h <= 0 || w > 6000 || h > 6000) return;
        BufferedImage tmp = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D tg = tmp.createGraphics();
        tg.setRenderingHints(g.getRenderingHints());
        AffineTransform t = AffineTransform.getTranslateInstance(-x0, -y0); t.concatenate(xf); tg.setTransform(t);
        tg.setPaint(ap); tg.fill(userShape); tg.dispose();
        if (sigma > 0f) gaussian(tmp, sigma);
        AffineTransform keep = g.getTransform(); g.setTransform(new AffineTransform());
        g.drawImage(tmp, x0, y0, null); g.setTransform(keep);
    }
    static void gaussian(BufferedImage img, float sigma) {
        int w = img.getWidth(), h = img.getHeight(); int[] px = img.getRGB(0, 0, w, h, null, 0, w);
        float[][] ch = new float[4][w * h];
        for (int i = 0; i < px.length; i++) { int c = px[i]; float a = (c >>> 24) / 255f; ch[0][i] = a; ch[1][i] = ((c >> 16) & 255) / 255f * a; ch[2][i] = ((c >> 8) & 255) / 255f * a; ch[3][i] = (c & 255) / 255f * a; }
        int k = (int) Math.ceil(3 * sigma); float[] ker = new float[2 * k + 1]; float sum = 0;
        for (int i = -k; i <= k; i++) { ker[i + k] = (float) Math.exp(-(i * i) / (2 * sigma * sigma)); sum += ker[i + k]; }
        for (int i = 0; i < ker.length; i++) ker[i] /= sum;
        float[] tmp = new float[w * h];
        for (int c = 0; c < 4; c++) {
            float[] src = ch[c];
            for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) { float acc = 0; for (int i = -k; i <= k; i++) { int xx = x + i; if (xx >= 0 && xx < w) acc += src[y * w + xx] * ker[i + k]; } tmp[y * w + x] = acc; }
            for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) { float acc = 0; for (int i = -k; i <= k; i++) { int yy = y + i; if (yy >= 0 && yy < h) acc += tmp[yy * w + x] * ker[i + k]; } src[y * w + x] = acc; }
        }
        for (int i = 0; i < px.length; i++) {
            float a = Math.min(1f, ch[0][i]); if (a <= 0.0005f) { px[i] = 0; continue; }
            int r = Math.min(255, Math.round(ch[1][i] / a * 255f)), gg = Math.min(255, Math.round(ch[2][i] / a * 255f)), b = Math.min(255, Math.round(ch[3][i] / a * 255f));
            px[i] = Math.round(a * 255f) << 24 | r << 16 | gg << 8 | b;
        }
        img.setRGB(0, 0, w, h, px, 0, w);
    }
}
