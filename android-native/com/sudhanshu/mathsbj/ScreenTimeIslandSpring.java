package com.sudhanshu.mathsbj;

/** Allocation-free analytic under-damped spring easing shared by island morphs. */
public final class ScreenTimeIslandSpring {
    private ScreenTimeIslandSpring() {}

    /** Progress from 0 to 1 for a unit step with zero initial velocity. */
    public static float valueAt(float elapsedSeconds, float responseSeconds, float dampingRatio) {
        if (Float.isNaN(elapsedSeconds) || elapsedSeconds <= 0f) return 0f;
        if (Float.isInfinite(elapsedSeconds)) return 1f;
        float response = finiteClamp(responseSeconds, 0.12f, 2.0f, 0.42f);
        float damping = finiteClamp(dampingRatio, 0.01f, 1.5f, 0.78f);
        float omega = (float) (2.0 * Math.PI / response);
        if (damping >= 1f) {
            float decay = omega;
            float value = 1f - (1f + decay * elapsedSeconds) * (float) Math.exp(-decay * elapsedSeconds);
            return finiteOrOne(value);
        }
        float root = (float) Math.sqrt(1f - damping * damping);
        float decay = damping * omega;
        float frequency = omega * root;
        float phase = frequency * elapsedSeconds;
        float envelope = (float) Math.exp(-decay * elapsedSeconds);
        float value = 1f - envelope * ((float) Math.cos(phase)
            + (decay / frequency) * (float) Math.sin(phase));
        return finiteOrOne(value);
    }

    public static boolean isSettled(float elapsedSeconds, float responseSeconds,
                                    float dampingRatio, float tolerance) {
        float value = valueAt(elapsedSeconds, responseSeconds, dampingRatio);
        float safeTolerance = finiteClamp(tolerance, 0.0001f, 0.1f, 0.01f);
        return Math.abs(1f - value) <= safeTolerance;
    }

    private static float finiteClamp(float value, float min, float max, float fallback) {
        if (Float.isNaN(value) || Float.isInfinite(value)) return fallback;
        return Math.max(min, Math.min(max, value));
    }

    private static float finiteOrOne(float value) {
        return Float.isNaN(value) || Float.isInfinite(value) ? 1f : value;
    }
}
