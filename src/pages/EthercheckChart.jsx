import React from 'react';
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
    // Проверка на наличие данных
    if (!data || !data.datasets || data.datasets.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-slate-500 font-medium">
                Нет данных для отображения
            </div>
        );
    }

    // 1. Преобразуем данные: собираем все точки в одну временную шкалу
    const processedDataMap = {};

    data.datasets.forEach((dataset) => {
        if (!dataset.data) return;
        const label = dataset.label; // Номер комнаты

        dataset.data.forEach((point) => {
            const timeKey = point.x;
            if (!processedDataMap[timeKey]) {
                processedDataMap[timeKey] = { time: timeKey };
            }
            // Сохраняем значение процента потерь
            processedDataMap[timeKey][label] = point.y;
        });
    });

    // Сортируем по времени
    const chartData = Object.values(processedDataMap).sort((a, b) =>
        new Date(a.time) - new Date(b.time)
    );

    // Форматирование времени (ЧЧ:ММ)
    const formatTime = (tickItem) => {
        try {
            return new Date(tickItem).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) { return tickItem; }
    };

    // Форматирование даты в подсказке
    const formatTooltipDate = (label) => {
        try {
            return new Date(label).toLocaleString([], {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
        } catch (e) { return label; }
    };

    // Яркие цвета для линий (палитра)
    const getLineColor = (index) => {
        const hues = [200, 280, 150, 35, 340, 170, 45, 220]; // Sky, Purple, Green, Orange, Pink...
        return `hsl(${hues[index % hues.length]}, 85%, 60%)`;
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />

                {/* Ось X: Время */}
                <XAxis
                    dataKey="time"
                    tickFormatter={formatTime}
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    minTickGap={35}
                />

                {/* Ось Y: Проценты */}
                <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    unit="%"
                    width={40}
                />

                {/* Подсказка при наведении */}
                <Tooltip
                    labelFormatter={formatTooltipDate}
                    contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: '#334155',
                        color: '#f1f5f9',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
                    }}
                    itemStyle={{ padding: '2px 0' }}
                    formatter={(value) => [`${value}%`]}
                />

                {/* Легенда (кто есть кто) */}
                <Legend
                    verticalAlign="top"
                    height={40}
                    iconType="circle"
                    wrapperStyle={{ paddingBottom: '10px', fontSize: '13px', color: '#cbd5e1' }}
                />

                {/* Рисуем линии */}
                {data.datasets.map((dataset, index) => (
                    <Line
                        key={dataset.label || index}
                        type="monotone"
                        dataKey={dataset.label}
                        name={`Комната ${dataset.label}`} // Текст в легенде
                        stroke={dataset.borderColor || getLineColor(index)}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        connectNulls={true}
                    />
                ))}

            </LineChart>
        </ResponsiveContainer>
    );
}
