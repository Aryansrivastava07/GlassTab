// Performance monitoring utility
class PerformanceMonitor {
    constructor() {
        this.metrics = {};
        this.observers = [];
    }

    // Start timing a component load
    startTiming(componentName) {
        this.metrics[componentName] = {
            startTime: performance.now(),
            endTime: null,
            duration: null
        };
    }

    // End timing a component load
    endTiming(componentName) {
        if (this.metrics[componentName]) {
            this.metrics[componentName].endTime = performance.now();
            this.metrics[componentName].duration =
                this.metrics[componentName].endTime - this.metrics[componentName].startTime;

            console.log(`⚡ ${componentName} loaded in ${this.metrics[componentName].duration.toFixed(2)}ms`);
        }
    }

    // Get all metrics
    getMetrics() {
        return this.metrics;
    }

    // Log performance summary
    logSummary() {
        console.log('🚀 Performance Summary:');
        Object.entries(this.metrics).forEach(([component, metric]) => {
            if (metric.duration) {
                console.log(`  ${component}: ${metric.duration.toFixed(2)}ms`);
            }
        });
    }

    // Monitor First Contentful Paint
    observeFCP() {
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry) => {
                    if (entry.name === 'first-contentful-paint') {
                        console.log(`🎨 First Contentful Paint: ${entry.startTime.toFixed(2)}ms`);
                    }
                });
            });
            observer.observe({ type: 'paint', buffered: true });
            this.observers.push(observer);
        }
    }

    // Monitor Largest Contentful Paint
    observeLCP() {
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                console.log(`🖼️ Largest Contentful Paint: ${lastEntry.startTime.toFixed(2)}ms`);
            });
            observer.observe({ type: 'largest-contentful-paint', buffered: true });
            this.observers.push(observer);
        }
    }

    // Monitor Cumulative Layout Shift
    observeCLS() {
        if ('PerformanceObserver' in window) {
            let clsValue = 0;
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry) => {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                    }
                });
                console.log(`📐 Cumulative Layout Shift: ${clsValue.toFixed(4)}`);
            });
            observer.observe({ type: 'layout-shift', buffered: true });
            this.observers.push(observer);
        }
    }

    // Initialize all observers
    init() {
        this.observeFCP();
        this.observeLCP();
        this.observeCLS();
    }

    // Cleanup observers
    cleanup() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
    }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Export for use in components
export default performanceMonitor;

// Hook for React components
export const usePerformanceMonitor = (componentName) => {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        performanceMonitor.startTiming(componentName);

        return () => {
            performanceMonitor.endTiming(componentName);
            setIsLoaded(true);
        };
    }, [componentName]);

    return isLoaded;
};
