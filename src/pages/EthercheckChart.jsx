import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

const getLineColor = (index) => {
    const hues = [200, 280, 150, 35, 340, 170, 45, 220];
    return `hsl(${hues[index % hues.length]}, 85%, 60%)`;
};

export default function EthercheckChart({ data, isSummary }) {
    const containerRef = useRef(null);

    // --- STATE ---
    const [xDomain, setXDomain] = useState([0, 0]);
    const [originalXDomain, setOriginalXDomain] = useState([0, 0]);
    const [yDomain, setYDomain] = useState([0, 100]);

    const [isDragging, setIsDragging] = useState(false);
    const lastMouseX = useRef(null);
    const lastTouchDist = useRef(null);

    // --- 1. ПОДГОТОВКА ДАННЫХ ---
    const { chartData, finalDatasets } = useMemo(() => {
        if (!data || !data.datasets || data.datasets.length === 0) {
            return { chartData: [], finalDatasets: [] };
        }

        const processedMap = {};
        let min = Infinity;
        let max = -Infinity;

        data.datasets.forEach((dataset) => {
            if (!dataset.data) return;
            const label = dataset.label;
            dataset.data.forEach((point) => {
                const timeNum = new Date(point.x).getTime();
                if (isNaN(timeNum)) return;
                if (timeNum < min) min = timeNum;
                if (timeNum > max) max = timeNum;
                if (!processedMap[timeNum]) processedMap[timeNum] = { time: timeNum };
                processedMap[timeNum][label] = point.y;
            });
        });

        const sortedData = Object.values(processedMap).sort((a, b) => a.time - b.time);

        let datasetsToRender = [];
        if (isSummary) {
            sortedData.forEach(point => {
                const values = Object.keys(point)
                    .filter(k => k !== 'time' && k !== 'summary')
                    .map(k => point[k])
                    .filter(v => typeof v === 'number');

                point.summary = values.length > 0
                    ? values.reduce((a, b) => a + b, 0) / values.length
                    : null;
            });
            datasetsToRender = [{
                name: 'Общий график',
                dataKey: 'summary',
                stroke: '#f59e0b',
                strokeWidth: 3
            }];
        } else {
            datasetsToRender = data.datasets.map((ds, index) => ({
                name: `Комната ${ds.label}`,
                dataKey: ds.label,
                stroke: ds.borderColor || getLineColor(index),
                strokeWidth: 2
            }));
        }

        return { chartData: sortedData, finalDatasets: datasetsToRender, minTime: min, maxTime: max };
    }, [data, isSummary]);

    // Инициализация границ
    useEffect(() => {
        if (chartData.length > 0) {
            const min = chartData[0].time;
            const max = chartData[chartData.length - 1].time;
            const buffer = (max - min) * 0.01;
            const start = min - buffer;
            const end = max + buffer;
            setOriginalXDomain([start, end]);
            setXDomain([start, end]);
        }
    }, [chartData]);

    // --- 2. АВТО-ЗУМ ОСИ Y ---
    useEffect(() => {
        if (!chartData.length) return;
        const [currentMin, currentMax] = xDomain;
        const [origMin, origMax] = originalXDomain;

        const isFullyZoomedOut = Math.abs(currentMin - origMin) < 60000 && Math.abs(currentMax - origMax) < 60000;
        if (isFullyZoomedOut) {
            setYDomain([0, 100]);
            return;
        }
        const visiblePoints = chartData.filter(p => p.time >= currentMin && p.time <= currentMax);
        if (visiblePoints.length === 0) return;

        let maxY = 0;
        const keysToCheck = finalDatasets.map(d => d.dataKey);
        visiblePoints.forEach(p => {
            keysToCheck.forEach(key => {
                const val = p[key];
                if (typeof val === 'number' && val > maxY) maxY = val;
            });
        });

        let calculatedMax = Math.ceil(maxY * 1.1);
        if (calculatedMax < 5) calculatedMax = 5;
        if (calculatedMax > 100) calculatedMax = 100;
        setYDomain([0, calculatedMax]);
    }, [xDomain, chartData, originalXDomain, finalDatasets]);

    // --- 3. MOUSE WHEEL ZOOM ---
    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const onWheel = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const [currentMin, currentMax] = xDomain;
            const [origMin, origMax] = originalXDomain;
            if (origMin === 0 && origMax === 0) return;

            const duration = currentMax - currentMin;
            let ZOOM_FACTOR = 0.001 * Math.abs(e.deltaY);
            if (e.ctrlKey) ZOOM_FACTOR *= 2;
            if (ZOOM_FACTOR > 0.2) ZOOM_FACTOR = 0.2;
            if (ZOOM_FACTOR < 0.02) ZOOM_FACTOR = 0.02;

            let newMin, newMax;
            if (e.deltaY < 0) {
                const delta = duration * ZOOM_FACTOR;
                newMin = currentMin + delta;
                newMax = currentMax - delta;
            } else {
                const delta = duration * ZOOM_FACTOR;
                newMin = currentMin - delta;
                newMax = currentMax + delta;
                if (newMin < origMin) newMin = origMin;
                if (newMax > origMax) newMax = origMax;
            }
            if (newMax - newMin < 60000) return;
            setXDomain([newMin, newMax]);
        };

        element.addEventListener('wheel', onWheel, { passive: false });
        return () => element.removeEventListener('wheel', onWheel);
    }, [xDomain, originalXDomain]);


    // --- 4. TOUCH EVENTS ---
    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const getDistance = (touches) => {
            return Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
            );
        };

        const updateDomainSafe = (newMin, newMax, origMin, origMax) => {
            if (newMin < origMin) {
                const diff = origMin - newMin;
                newMin += diff;
                newMax += diff;
            }
            if (newMax > origMax) {
                const diff = newMax - origMax;
                newMin -= diff;
                newMax -= diff;
            }
            if (newMax - newMin < 60000) return;
            setXDomain([newMin, newMax]);
        };

        const onTouchStart = (e) => {
            if (e.touches.length === 1) {
                setIsDragging(true);
                lastMouseX.current = e.touches[0].clientX;
            } else if (e.touches.length === 2) {
                setIsDragging(false);
                lastTouchDist.current = getDistance(e.touches);
            }
        };

        const onTouchMove = (e) => {
            if (e.cancelable) e.preventDefault();

            const [currentMin, currentMax] = xDomain;
            const [origMin, origMax] = originalXDomain;
            const duration = currentMax - currentMin;

            if (e.touches.length === 1 && isDragging) {
                const currentClientX = e.touches[0].clientX;
                const pixelDelta = lastMouseX.current - currentClientX;
                const chartWidth = element.clientWidth || 300;
                const timeDelta = (pixelDelta / chartWidth) * duration;
                updateDomainSafe(currentMin + timeDelta, currentMax + timeDelta, origMin, origMax);
                lastMouseX.current = currentClientX;
            }
            else if (e.touches.length === 2 && lastTouchDist.current) {
                const dist = getDistance(e.touches);
                const zoomFactor = lastTouchDist.current / dist;
                const center = (currentMin + currentMax) / 2;
                const newDuration = duration * zoomFactor;

                let newMin = center - newDuration / 2;
                let newMax = center + newDuration / 2;

                if (newMin < origMin) newMin = origMin;
                if (newMax > origMax) newMax = origMax;

                if (newMax - newMin >= 60000) {
                    setXDomain([newMin, newMax]);
                }
                lastTouchDist.current = dist;
            }
        };

        const onTouchEnd = () => {
            setIsDragging(false);
            lastMouseX.current = null;
            lastTouchDist.current = null;
        };

        element.addEventListener('touchstart', onTouchStart, { passive: false });
        element.addEventListener('touchmove', onTouchMove, { passive: false });
        element.addEventListener('touchend', onTouchEnd);

        return () => {
            element.removeEventListener('touchstart', onTouchStart);
            element.removeEventListener('touchmove', onTouchMove);
            element.removeEventListener('touchend', onTouchEnd);
        };
    }, [xDomain, originalXDomain, isDragging]);


    // --- 5. MOUSE EVENTS ---
    const handleMouseDown = (e) => { setIsDragging(true); lastMouseX.current = e.clientX; };
    const handleMouseUp = () => { setIsDragging(false); lastMouseX.current = null; };
    const handleMouseMove = (e) => {
        if (!isDragging || !lastMouseX.current) return;
        if (e.cancelable) e.preventDefault();
        const currentClientX = e.clientX;
        const pixelDelta = lastMouseX.current - currentClientX;
        const chartWidth = e.currentTarget.clientWidth || 800;
        const [currentMin, currentMax] = xDomain;
        const duration = currentMax - currentMin;
        const timeDelta = (pixelDelta / chartWidth) * duration;

        let newMin = currentMin + timeDelta;
        let newMax = currentMax + timeDelta;

        // Безопасное обновление с проверкой границ
        const [origMin, origMax] = originalXDomain;
        if (newMin < origMin) {
            const diff = origMin - newMin;
            newMin += diff;
            newMax += diff;
        }
        if (newMax > origMax) {
            const diff = newMax - origMax;
            newMin -= diff;
            newMax -= diff;
        }

        setXDomain([newMin, newMax]);
        lastMouseX.current = currentClientX;
    };

    // --- 6. RENDER HELPERS ---
    const getNiceTicks = (min, max) => {
        if (min === 0 || max === 0 || min >= max) return [];
        const diff = max - min;
        const ticks = [];
        const M = 60 * 1000;
        const H = 60 * M;
        const D = 24 * H;
        let step;

        if (diff <= 2 * H) step = 10 * M;
        else if (diff <= 6 * H) step = 30 * M;
        else if (diff <= 12 * H) step = 1 * H;
        else if (diff <= 24 * H) step = 2 * H;
        else if (diff <= 2 * D) step = 6 * H;
        else step = 1 * D;

        const startOfDay = new Date(min).setHours(0,0,0,0);
        let k = Math.floor((min - startOfDay) / step);
        let current = startOfDay + (k * step);
        if (current < min) current += step;
        while (current <= max) { ticks.push(current); current += step; }
        return ticks;
    };
    const currentTicks = useMemo(() => getNiceTicks(xDomain[0], xDomain[1]), [xDomain]);

    const formatAxisTick = (tick) => {
        const date = new Date(tick);
        if ((xDomain[1] - xDomain[0]) > 86400000) return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    const formatTooltip = (label) => new Date(label).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});

    if (!chartData || chartData.length === 0) {
        return <div className="flex items-center justify-center h-full text-slate-500 text-sm text-center p-4">Нет данных для отображения. Выберите параметры и нажмите "Построить график"</div>;
    }

    return (
        <div
            ref={containerRef}
            style={{ touchAction: 'none' }}
            className="w-full h-full select-none cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <ResponsiveContainer width="100%" height="100%">
                {/* ИЗМЕНЕНО: margin.left увеличен с -15 до 10 */}
                <LineChart data={chartData} margin={{ top: 10, right: 0, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis
                        dataKey="time"
                        type="number"
                        domain={xDomain}
                        allowDataOverflow
                        ticks={currentTicks}
                        tickFormatter={formatAxisTick}
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        minTickGap={20}
                    />
                    {/* ИЗМЕНЕНО: width увеличен с 35 до 45 */}
                    <YAxis
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        unit="%"
                        width={45}
                        domain={yDomain}
                        allowDataOverflow={true}
                    />
                    <Tooltip
                        labelFormatter={formatTooltip}
                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value) => [`${value.toFixed(2)}%`]}
                        active={!isDragging}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ color: '#cbd5e1', fontSize: '12px' }} />

                    {finalDatasets.map((ds) => (
                        <Line
                            key={ds.name}
                            type="monotone"
                            dataKey={ds.dataKey}
                            name={ds.name}
                            stroke={ds.stroke}
                            strokeWidth={ds.strokeWidth}
                            dot={false}
                            activeDot={{ r: 4 }}
                            connectNulls={true}
                            isAnimationActive={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>

            <div className="absolute bottom-1 right-2 text-[9px] text-slate-600 pointer-events-none opacity-50 hidden md:block">
                Scroll: Zoom • Drag: Pan
            </div>
        </div>
    );
}
