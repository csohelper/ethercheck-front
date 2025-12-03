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

export default function EthercheckChart({ data }) {
    const containerRef = useRef(null); // Ref для div-обертки

    // --- STATE ---
    const [xDomain, setXDomain] = useState([0, 0]);
    const [originalXDomain, setOriginalXDomain] = useState([0, 0]);
    const [yDomain, setYDomain] = useState([0, 100]);
    const [isDragging, setIsDragging] = useState(false);
    const lastMouseX = useRef(null);

    // --- 1. ПОДГОТОВКА ДАННЫХ ---
    const processedData = useMemo(() => {
        if (!data || !data.datasets || data.datasets.length === 0) return [];

        const map = {};
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

                if (!map[timeNum]) map[timeNum] = { time: timeNum };
                map[timeNum][label] = point.y;
            });
        });

        const result = Object.values(map).sort((a, b) => a.time - b.time);

        if (min !== Infinity && max !== -Infinity) {
            const buffer = (max - min) * 0.01;
            const start = min - buffer;
            const end = max + buffer;
            setOriginalXDomain([start, end]);
            setXDomain([start, end]);
        }

        return result;
    }, [data]);

    // --- 2. АВТО-ЗУМ ОСИ Y ---
    useEffect(() => {
        if (!processedData.length) return;

        const [currentMin, currentMax] = xDomain;
        const [origMin, origMax] = originalXDomain;

        const isFullyZoomedOut =
            Math.abs(currentMin - origMin) < 60000 &&
            Math.abs(currentMax - origMax) < 60000;

        if (isFullyZoomedOut) {
            setYDomain([0, 100]);
            return;
        }

        const visiblePoints = processedData.filter(p => p.time >= currentMin && p.time <= currentMax);
        if (visiblePoints.length === 0) return;

        let maxY = 0;
        visiblePoints.forEach(p => {
            Object.keys(p).forEach(key => {
                if (key !== 'time') {
                    const val = p[key];
                    if (val > maxY) maxY = val;
                }
            });
        });

        let calculatedMax = Math.ceil(maxY * 1.1);
        if (calculatedMax < 5) calculatedMax = 5;
        if (calculatedMax > 100) calculatedMax = 100;
        setYDomain([0, calculatedMax]);

    }, [xDomain, processedData, originalXDomain]);

    // --- 3. ВЕШАЕМ ОБРАБОТЧИК WHEEL (ЧТОБЫ НЕ СКРОЛЛИЛОСЬ) ---
    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const onWheel = (e) => {
            e.preventDefault(); // ВАЖНО: Блокируем скролл страницы
            e.stopPropagation();

            // Логика зума перенесена сюда
            const [currentMin, currentMax] = xDomain; // Внимание: внутри useEffect state может быть старым без зависимостей
            // Но так как мы добавляем зависимости, он пересоздастся.
            // Для чистоты кода лучше вынести логику зума, но здесь оставим для краткости.

            // Получаем актуальные значения из state (через замыкание не получится, нужен ref или пересоздание listener)
            // Самый простой способ в React: использовать setState с callback

            setXDomain((prevXDomain) => {
                const [currMin, currMax] = prevXDomain;
                const duration = currMax - currMin;

                let ZOOM_FACTOR = 0.001 * Math.abs(e.deltaY);
                if (e.ctrlKey) ZOOM_FACTOR *= 2;
                if (ZOOM_FACTOR > 0.2) ZOOM_FACTOR = 0.2;
                if (ZOOM_FACTOR < 0.02) ZOOM_FACTOR = 0.02;

                let newMin, newMax;
                if (e.deltaY < 0) {
                    // Zoom IN
                    const delta = duration * ZOOM_FACTOR;
                    newMin = currMin + delta;
                    newMax = currMax - delta;
                } else {
                    // Zoom OUT
                    const delta = duration * ZOOM_FACTOR;
                    newMin = currMin - delta;
                    newMax = currMax + delta;
                }

                // Используем ref для доступа к originalXDomain внутри этого callback
                // (Или просто передадим его в deps, но это заставит перевешивать listener каждый рендер, что ок)

                // Проверки границ сделаем ниже перед return
                return [newMin, newMax];
            });
        };

        // { passive: false } ОБЯЗАТЕЛЬНО для preventDefault
        element.addEventListener('wheel', onWheel, { passive: false });

        return () => {
            element.removeEventListener('wheel', onWheel);
        };
    }, [xDomain]); // Зависимость от xDomain пересоздаст листенер с актуальными данными, это нормально

    // Доп. useEffect для проверки границ после зума (чтобы не усложнять логику внутри event listener)
    useEffect(() => {
        const [min, max] = xDomain;
        const [origMin, origMax] = originalXDomain;

        let newMin = min;
        let newMax = max;
        let changed = false;

        // Защита от выхода за границы (при Zoom Out)
        if (newMin < origMin) { newMin = origMin; changed = true; }
        if (newMax > origMax) { newMax = origMax; changed = true; }

        // Защита от схлопывания (при Zoom In)
        if (newMax - newMin < 60000) {
            // Отменяем последнее изменение если слишком близко
            // (сложно реализовать откат, проще просто не менять, но мы уже поменяли)
            // Поэтому просто раздвинем немного
            const center = (newMin + newMax) / 2;
            newMin = center - 30000;
            newMax = center + 30000;
            changed = true;
        }

        if (changed) {
            setXDomain([newMin, newMax]);
        }
    }, [xDomain, originalXDomain]);


    // --- ГЕНЕРАЦИЯ ТИКОВ ---
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

        // Округляем начало до шага
        // Учитываем таймзону смещением? Нет, просто найдем ближайший кратный timestamp
        let current = Math.ceil(min / step) * step;

        // Корректировка для красивых :00 (timestamp кратный step может быть не ровным часом из-за UTC)
        // Простой хак: идем от начала дня
        const startOfDay = new Date(min).setHours(0,0,0,0);
        // Находим первый тик после min, шагая от startOfDay
        let k = Math.floor((min - startOfDay) / step);
        current = startOfDay + (k * step);
        if (current < min) current += step;

        while (current <= max) {
            ticks.push(current);
            current += step;
        }
        return ticks;
    };

    const currentTicks = useMemo(() => getNiceTicks(xDomain[0], xDomain[1]), [xDomain]);

    // --- ОБРАБОТЧИКИ МЫШИ (ДРАГ) ---
    const handleMouseDown = (e) => {
        setIsDragging(true);
        lastMouseX.current = e.clientX;
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

        if (newMin < originalXDomain[0]) {
            const diff = originalXDomain[0] - newMin;
            newMin += diff;
            newMax += diff;
        }
        if (newMax > originalXDomain[1]) {
            const diff = newMax - originalXDomain[1];
            newMin -= diff;
            newMax -= diff;
        }
        setXDomain([newMin, newMax]);
        lastMouseX.current = currentClientX;
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        lastMouseX.current = null;
    };

    const formatAxisTick = (tick) => {
        const date = new Date(tick);
        const [min, max] = xDomain;
        if ((max - min) > 86400000) {
            return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatTooltip = (label) => new Date(label).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
    const getLineColor = (i) => `hsl(${[200, 280, 150, 35, 340][i % 5]}, 85%, 60%)`;

    if (!processedData || processedData.length === 0) {
        return <div className="flex items-center justify-center h-full text-slate-500">Нет данных</div>;
    }

    return (
        <div
            ref={containerRef} // Вешаем ref сюда
            className="w-full h-full select-none cursor-move touch-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={processedData}
                    margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />

                    <XAxis
                        dataKey="time"
                        type="number"
                        domain={xDomain}
                        allowDataOverflow
                        ticks={currentTicks}
                        tickFormatter={formatAxisTick}
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        minTickGap={30}
                    />

                    <YAxis
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        unit="%"
                        width={40}
                        domain={yDomain}
                        allowDataOverflow={true}
                    />

                    <Tooltip
                        labelFormatter={formatTooltip}
                        contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            borderColor: '#334155',
                            color: '#f1f5f9',
                            borderRadius: '8px'
                        }}
                        formatter={(value) => [`${value}%`]}
                        active={!isDragging}
                    />

                    <Legend verticalAlign="top" height={40} iconType="circle" wrapperStyle={{ color: '#cbd5e1' }} />

                    {data.datasets.map((dataset, index) => (
                        <Line
                            key={dataset.label || index}
                            type="monotone"
                            dataKey={dataset.label}
                            name={`Комната ${dataset.label}`}
                            stroke={dataset.borderColor || getLineColor(index)}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 5 }}
                            connectNulls={true}
                            isAnimationActive={false}
                        />
                    ))}

                </LineChart>
            </ResponsiveContainer>

            <div className="absolute bottom-2 right-4 text-[10px] text-slate-600 pointer-events-none opacity-50">
                Scroll: Zoom • Drag: Pan
            </div>
        </div>
    );
}
