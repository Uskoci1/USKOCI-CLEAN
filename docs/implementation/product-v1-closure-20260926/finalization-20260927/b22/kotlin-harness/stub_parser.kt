package com.swmansion.reanimated.nativeProxy

object SynchronousPropsBufferParser {
    fun parse(intBuffer: IntArray, doubleBuffer: DoubleArray, applyProps: (viewTag: Int, props: Any) -> Unit) {
        for (tag in intBuffer) applyProps(tag, "props")
    }
}
