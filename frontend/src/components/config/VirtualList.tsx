import { useMemo } from 'react'
import type { ReactNode } from 'react'

interface VirtualListProps {
    items: any[]
    itemHeight: number
    containerHeight: number
    renderItem: (item: any, index: number) => ReactNode
    overscan?: number
}

export default function VirtualList({ 
    items, 
    itemHeight, 
    containerHeight, 
    renderItem,
    overscan = 5 
}: VirtualListProps) {
    const visibleRange = useMemo(() => {
        const startIndex = Math.max(0, Math.floor(window.scrollY / itemHeight) - overscan)
        const endIndex = Math.min(
            items.length - 1,
            Math.ceil((window.scrollY + containerHeight) / itemHeight) + overscan
        )
        return { startIndex, endIndex }
    }, [items.length, itemHeight, containerHeight, overscan])

    const visibleItems = useMemo(() => {
        return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1)
    }, [items, visibleRange])

    const totalHeight = items.length * itemHeight

    return (
        <div 
            className="relative overflow-auto"
            style={{ height: containerHeight }}
        >
            <div style={{ height: totalHeight, position: 'relative' }}>
                <div 
                    style={{ 
                        transform: `translateY(${visibleRange.startIndex * itemHeight}px)`,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0
                    }}
                >
                    {visibleItems.map((item, index) => (
                        <div
                            key={visibleRange.startIndex + index}
                            style={{ height: itemHeight }}
                        >
                            {renderItem(item, visibleRange.startIndex + index)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
