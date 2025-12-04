import React, {useState, useEffect, useRef, useMemo} from 'react';
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

// Радиус срабатывания "магнита" в пикселях
const MAX_HOVER_DISTANCE = 50;

const CustomTooltip = ({
                           active,
                           payload,
                           label,
                           coordinate,
                           chartHeight,
                           chartWidth = 800,
                           xDomain = [0, 1],
                           yDomain = [0, 100],
                           setHoveredDataKey
                       }) => {
    // Логика определения, над какой линией находится мышь
    useEffect(() => {
        if (active && payload && payload.length && coordinate) {
            const mouseX = coordinate.x;
            const mouseY = coordinate.y;

            const [xMin, xMax] = xDomain;
            const [yMin, yMax] = yDomain;
            const chartH = chartHeight;
            const chartW = chartWidth; // вместо containerRef.current

            let minDistance = Infinity;
            let closest = null;

            payload.forEach(entry => {
                const xVal = new Date(entry.payload.time).getTime();
                const yVal = typeof entry.value === 'number' ? entry.value : 0;

                const px = ((xVal - xMin) / (xMax - xMin)) * chartW;
                const py = chartH - ((yVal - yMin) / (yMax - yMin)) * chartH;

                const dist = Math.hypot(mouseX - px, mouseY - py);

                if (dist < minDistance) {
                    minDistance = dist;
                    closest = entry.dataKey;
                }
            });

            if (closest && minDistance <= MAX_HOVER_DISTANCE) {
                setHoveredDataKey(closest);
            } else {
                setHoveredDataKey(null);
            }
        } else {
            setHoveredDataKey(null);
        }
    }, [active, payload, coordinate, chartHeight, chartWidth, xDomain, yDomain, setHoveredDataKey]);


    if (!active || !payload || !payload.length || !coordinate) return null;

    const mouseY = coordinate.y;
    const [min, max] = yDomain;
    const range = max - min;

    // Ищем ближайшую точку для отображения в тултипе
    const sorted = [...payload].sort((a, b) => {
        const valA = typeof a.value === 'number' ? a.value : 0;
        const valB = typeof b.value === 'number' ? b.value : 0;
        const yA = chartHeight - ((valA - min) / range) * chartHeight;
        const yB = chartHeight - ((valB - min) / range) * chartHeight;
        return Math.abs(mouseY - yA) - Math.abs(mouseY - yB);
    });

    const closestPoint = sorted[0];

    // Проверяем дистанцию еще раз для отрисовки самого тултипа
    const valClosest = typeof closestPoint.value === 'number' ? closestPoint.value : 0;
    const yClosest = chartHeight - ((valClosest - min) / range) * chartHeight;
    const distClosest = Math.abs(mouseY - yClosest);

    // ЕСЛИ МЫШЬ ДАЛЕКО -> СКРЫВАЕМ ТУЛТИП
    if (distClosest > MAX_HOVER_DISTANCE) return null;

    return (
        <div className="bg-slate-900/95 border border-slate-700 text-slate-100 rounded-lg p-2 text-xs shadow-xl z-50">
            <div className="mb-1 opacity-50 font-mono text-[10px]">
                {new Date(label).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })}
            </div>
            <div style={{color: closestPoint.color}} className="font-bold flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full shadow-[0_0_4px_currentColor]"
                      style={{backgroundColor: closestPoint.color}}></span>
                {closestPoint.name}: {Number(closestPoint.value).toFixed(2)}%
            </div>
        </div>
    );
};

export default function EthercheckChart({data, isSummary}) {
    const containerRef = useRef(null);
    const [xDomain, setXDomain] = useState([0, 0]);
    const [originalXDomain, setOriginalXDomain] = useState([0, 0]);
    const [yDomain, setYDomain] = useState([0, 100]);
    const [isDragging, setIsDragging] = useState(false);
    const lastMouseX = useRef(null);
    const lastTouchDist = useRef(null);
    const [hoveredDataKey, setHoveredDataKey] = useState(null);
    const [containerHeight, setContainerHeight] = useState(400);

    useEffect(() => {
        const updateHeight = () => {
            if (containerRef.current) {
                setContainerHeight(containerRef.current.clientHeight - 10);
            }
        };
        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, []);

    // --- ПОДГОТОВКА ДАННЫХ ---
    const {chartData, finalDatasets} = useMemo(() => {
        if (!data || !data.datasets || data.datasets.length === 0) {
            return {chartData: [], finalDatasets: []};
        }

        const processedMap = {};
        let min = Infinity;
        let max = -Infinity;

        data.datasets.forEach((dataset, index) => {
            if (!dataset.data) return;
            const label = dataset.label;
            dataset.data.forEach((point) => {
                const timeNum = new Date(point.x).getTime();
                if (isNaN(timeNum)) return;
                if (timeNum < min) min = timeNum;
                if (timeNum > max) max = timeNum;
                if (!processedMap[timeNum]) processedMap[timeNum] = {time: timeNum};
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
                point.summary = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
            });
            datasetsToRender = [{name: 'Общий график', dataKey: 'summary', stroke: '#f59e0b', strokeWidth: 3}];
        } else {
            datasetsToRender = data.datasets.map((ds, index) => ({
                name: `Комната ${ds.label}`,
                dataKey: ds.label,
                stroke: ds.borderColor || getLineColor(index),
                strokeWidth: 2
            }));
        }

        return {chartData: sortedData, finalDatasets: datasetsToRender};
    }, [data, isSummary]);

    useEffect(() => {
        if (chartData.length > 0) {
            const min = chartData[0].time;
            const max = chartData[chartData.length - 1].time;
            const buffer = (max - min) * 0.01;
            setOriginalXDomain([min - buffer, max + buffer]);
            setXDomain([min - buffer, max + buffer]);
        }
    }, [chartData]);

    // АВТО-ЗУМ Y
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

    // MOUSE WHEEL
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
        element.addEventListener('wheel', onWheel, {passive: false});
        return () => element.removeEventListener('wheel', onWheel);
    }, [xDomain, originalXDomain]);

    // TOUCH & MOUSE HANDLERS
    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;
        const getDistance = (touches) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
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
            } else if (e.touches.length === 2 && lastTouchDist.current) {
                const dist = getDistance(e.touches);
                const zoomFactor = lastTouchDist.current / dist;
                const center = (currentMin + currentMax) / 2;
                const newDuration = duration * zoomFactor;
                let newMin = center - newDuration / 2;
                let newMax = center + newDuration / 2;
                if (newMin < origMin) newMin = origMin;
                if (newMax > origMax) newMax = origMax;
                if (newMax - newMin >= 60000) setXDomain([newMin, newMax]);
                lastTouchDist.current = dist;
            }
        };
        const onTouchEnd = () => {
            setIsDragging(false);
            lastMouseX.current = null;
            lastTouchDist.current = null;
        };
        element.addEventListener('touchstart', onTouchStart, {passive: false});
        element.addEventListener('touchmove', onTouchMove, {passive: false});
        element.addEventListener('touchend', onTouchEnd);
        return () => {
            element.removeEventListener('touchstart', onTouchStart);
            element.removeEventListener('touchmove', onTouchMove);
            element.removeEventListener('touchend', onTouchEnd);
        };
    }, [xDomain, originalXDomain, isDragging]);

    const handleMouseDown = (e) => {
        setIsDragging(true);
        lastMouseX.current = e.clientX;
    };
    const handleMouseUp = () => {
        setIsDragging(false);
        lastMouseX.current = null;
    };
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

    const getNiceTicks = (min, max) => {
        if (min === 0 || max === 0 || min >= max) return [];
        const diff = max - min;
        const ticks = [];
        const M = 60 * 1000;
        const H = 60 * M;
        const D = 24 * H;
        let step;
        if (diff <= 2 * H) step = 10 * M; else if (diff <= 6 * H) step = 30 * M;
        else if (diff <= 12 * H) step = 1 * H; else if (diff <= 24 * H) step = 2 * H;
        else if (diff <= 2 * D) step = 6 * H; else step = 1 * D;
        const startOfDay = new Date(min).setHours(0, 0, 0, 0);
        let k = Math.floor((min - startOfDay) / step);
        let current = startOfDay + (k * step);
        if (current < min) current += step;
        while (current <= max) {
            ticks.push(current);
            current += step;
        }
        return ticks;
    };
    const currentTicks = useMemo(() => getNiceTicks(xDomain[0], xDomain[1]), [xDomain]);
    const formatAxisTick = (tick) => {
        const date = new Date(tick);
        if ((xDomain[1] - xDomain[0]) > 86400000) return date.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    };

    if (!chartData || chartData.length === 0) {
        return <div className="flex items-center justify-center h-full text-slate-500 text-sm text-center p-4">Нет
            данных</div>;
    }

    return (
        <div
            ref={containerRef}
            style={{touchAction: 'none'}}
            className="w-full h-full select-none cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
                handleMouseUp();
                setHoveredDataKey(null);
            }}
        >
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{top: 10, right: 0, left: 10, bottom: 0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false}/>
                    <XAxis
                        dataKey="time"
                        type="number"
                        domain={xDomain}
                        allowDataOverflow
                        ticks={currentTicks}
                        tickFormatter={formatAxisTick}
                        stroke="#94a3b8"
                        tick={{fill: '#94a3b8', fontSize: 10}}
                        minTickGap={20}
                    />
                    <YAxis
                        stroke="#94a3b8"
                        tick={{fill: '#94a3b8', fontSize: 10}}
                        unit="%"
                        width={45}
                        domain={yDomain}
                        allowDataOverflow={true}
                    />

                    <Tooltip
                        content={
                            <CustomTooltip
                                chartHeight={containerHeight}
                                chartWidth={containerRef.current?.clientWidth || 300} // ширина графика
                                xDomain={xDomain}  // прокидываем
                                yDomain={yDomain}
                                setHoveredDataKey={setHoveredDataKey}
                            />
                        }
                        active={!isDragging}
                        isAnimationActive={false}
                        cursor={false}
                        shared={true}
                    />


                    <Legend verticalAlign="top" height={36} iconType="circle"
                            wrapperStyle={{color: '#cbd5e1', fontSize: '12px'}}/>

                    {finalDatasets.map((ds) => (
                        <Line
                            key={ds.name}
                            type="monotone"
                            dataKey={ds.dataKey}
                            name={ds.name}
                            stroke={ds.stroke}
                            strokeWidth={ds.strokeWidth}
                            // ВЕРНУЛИ dot={false} - точки невидимы по умолчанию
                            dot={false}
                            // АКТИВНАЯ ТОЧКА (ПОДСВЕТКА) - видима только если мышь в радиусе 50px
                            activeDot={(props) => {
                                if (props.dataKey !== hoveredDataKey) return null;
                                return <circle cx={props.cx} cy={props.cy} r={6} stroke="#fff" strokeWidth={2}
                                               fill={ds.stroke}/>;
                            }}
                            connectNulls={true}
                            isAnimationActive={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>

            <div
                className="absolute bottom-1 right-2 text-[9px] text-slate-600 pointer-events-none opacity-50 hidden md:block">
                Scroll: Zoom • Drag: Pan
            </div>
        </div>
    );
}
