package android.os

object SystemClock {
    @JvmField var now = 1000L
    @JvmStatic fun uptimeMillis(): Long = now
}
