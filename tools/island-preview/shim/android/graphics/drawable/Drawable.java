package android.graphics.drawable;

import android.graphics.Canvas;

/** Minimal desktop-preview stand-in for the icon Drawable surface used by the island painter. */
public abstract class Drawable {
    protected int alpha = 255;
    protected int left;
    protected int top;
    protected int right;
    protected int bottom;

    public int getAlpha() { return alpha; }
    public void setAlpha(int value) { alpha = Math.max(0, Math.min(255, value)); }
    public void setBounds(int left, int top, int right, int bottom) {
        this.left = left;
        this.top = top;
        this.right = right;
        this.bottom = bottom;
    }
    public abstract void draw(Canvas canvas);
}
