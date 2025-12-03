import React, {useEffect, useState} from "react";
import EthercheckChart from "./EthercheckChart";

export default function EthercheckGraphPage() {
    // --- STATE ---
    const [rooms, setRooms] = useState([]);
    const [selectedRooms, setSelectedRooms] = useState([]);

    const [dateStart, setDateStart] = useState(() => {
        const d = new Date();
        d.setHours(d.getHours() - 24);
        return formatDateTime(d);
    });
    const [dateEnd, setDateEnd] = useState(() => formatDateTime(new Date()));

    const [loadingRooms, setLoadingRooms] = useState(false);
    const [loadingGraph, setLoadingGraph] = useState(false);
    const [error, setError] = useState(null);
    const [graphResult, setGraphResult] = useState(null);

    function formatDateTime(date) {
        const pad = (n) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function setTimeRange(hoursBack) {
        const end = new Date();
        const start = new Date();
        if (hoursBack === 'today') {
            start.setHours(0, 0, 0, 0);
        } else {
            start.setTime(end.getTime() - (hoursBack * 60 * 60 * 1000));
        }
        setDateStart(formatDateTime(start));
        setDateEnd(formatDateTime(end));
    }

    useEffect(() => {
        const url = "https://monitor.slavapmk.ru/api/rooms";
        let mounted = true;
        setLoadingRooms(true);

        fetch(url)
            .then((res) => {
                if (!res.ok) throw new Error("Ошибка загрузки списка");
                return res.json();
            })
            .then((data) => {
                if (!mounted) return;

                const rooms = (data?.rooms && Array.isArray(data.rooms)) ? data.rooms : [];

                setRooms(rooms);
                if (rooms.length > 0) {
                    setSelectedRooms([rooms[0]]);
                }
            })
            .finally(() => mounted && setLoadingRooms(false));

        return () => {
            mounted = false;
        };
    }, []);

    function toggleRoom(room) {
        if (selectedRooms.includes(room)) {
            setSelectedRooms(selectedRooms.filter(r => r !== room));
        } else {
            setSelectedRooms([...selectedRooms, room]);
        }
    }

    const formatDateForApi = (dateTimeLocalString) => {
        if (!dateTimeLocalString) return "";

        // Если вдруг уже с пробелом — просто вернём как есть
        if (dateTimeLocalString.includes(" ")) return dateTimeLocalString;

        // Заменяем T на пробел и обрезаем секунды (и миллисекунды), если они есть
        return dateTimeLocalString
            .replace("T", " ")        // 2025-12-02T03:46 → 2025-12-02 03:46
            .slice(0, 16);            // обрезаем до YYYY-MM-DD HH:MM
    };

    async function fetchGraph() {
        setError(null);
        setGraphResult(null);
        setLoadingGraph(true);

        try {
            if (selectedRooms.length === 0) throw new Error("Выберите комнаты");
            const params = new URLSearchParams();

            // Форматируем даты правильно
            params.append("start", formatDateForApi(dateStart));
            params.append("end", formatDateForApi(dateEnd));
            params.append("rooms", selectedRooms.join(","))

            const url = `https://monitor.slavapmk.ru/api/graph?${params.toString()}`;
            console.log("Запрос GET:", url);

            const res = await fetch(url, {
                method: "GET",
                headers: {"Accept": "application/json"}
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Ошибка ${res.status}: ${text}`);
            }

            const data = await res.json();
            setGraphResult(data);

        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoadingGraph(false);
        }
    }

    return (
        <div
            className="min-h-screen bg-[#0B1120] text-slate-200 flex flex-col items-center py-8 px-4 font-sans selection:bg-sky-500/30">

            {/* Фоновое свечение */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div
                    className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]"/>
                <div
                    className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]"/>
            </div>

            {/* Хедер */}
            <header className="w-full max-w-6xl flex items-center gap-3 mb-8 z-10">
                <div className="relative flex h-3 w-3">
                    <span
                        className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </div>
                <h1 className="text-xl font-bold tracking-wide text-white">
                    Ethercheck <span className="text-slate-500 font-normal">/ Monitor</span>
                </h1>
            </header>

            {/* Основная панель */}
            <div
                className="w-full max-w-6xl bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-2xl p-6 z-10">

                {/* Кнопки времени */}
                <div className="flex flex-wrap gap-2 mb-8">
                    {[
                        {label: '1 час', val: 1},
                        {label: '3 часа', val: 3},
                        {label: '12 часов', val: 12},
                        {label: 'Сутки', val: 24},
                        {label: 'Сегодня', val: 'today'}
                    ].map((btn) => (
                        <button
                            key={btn.label}
                            onClick={() => setTimeRange(btn.val)}
                            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700 transition-all"
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>

                {/* Сетка настроек */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Начало периода
                        </label>
                        <input
                            type="datetime-local"
                            value={dateStart}
                            onChange={(e) => setDateStart(e.target.value)}
                            className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Конец периода
                        </label>
                        <input
                            type="datetime-local"
                            value={dateEnd}
                            onChange={(e) => setDateEnd(e.target.value)}
                            className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
                        />
                    </div>

                    {/* Выбор комнат */}
                    <div className="flex flex-col h-[280px]">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Комнаты ({selectedRooms.length})
                            </span>
                            {/* Исправленные кнопки: Белые */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setSelectedRooms(rooms)}
                                    className="text-[10px] font-bold text-white/60 hover:text-white uppercase transition-colors"
                                >
                                    Выбрать все
                                </button>
                                <button
                                    onClick={() => setSelectedRooms([])}
                                    className="text-[10px] font-bold text-white/60 hover:text-white uppercase transition-colors"
                                >
                                    Сброс
                                </button>
                            </div>
                        </div>

                        <div
                            className="flex-1 bg-[#0F172A] border border-slate-700 rounded-xl overflow-hidden flex flex-col">
                            {loadingRooms ? (
                                <div className="flex items-center justify-center h-full text-xs text-slate-500">
                                    Загрузка...
                                </div>
                            ) : (
                                <div className="overflow-y-auto p-2 space-y-1 h-full custom-scrollbar">
                                    {rooms.map((room) => {
                                        const isSelected = selectedRooms.includes(room);
                                        return (
                                            <div
                                                key={room}
                                                onClick={() => toggleRoom(room)}
                                                className={`
                                                    flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-200 border
                                                    ${isSelected
                                                    ? "bg-sky-600 border-sky-500 text-white shadow-lg shadow-sky-900/20"
                                                    : "bg-transparent border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200"}
                                                `}
                                            >
                                                <span>Комната {room}</span>
                                                {isSelected && <span className="text-xs opacity-80">✓</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 pt-6 border-t border-slate-800">
                    <button
                        onClick={fetchGraph}
                        disabled={loadingGraph}
                        className="flex-1 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-wait"
                    >
                        {loadingGraph ? "Загрузка данных..." : "Построить график"}
                    </button>

                    <button
                        onClick={() => {
                            setGraphResult(null);
                            setError(null);
                        }}
                        className="px-6 py-3 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors font-medium"
                    >
                        Очистить
                    </button>
                </div>
            </div>

            {/* График */}
            <div
                className="w-full max-w-6xl mt-8 bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-2xl p-6 md:p-8 z-10">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-white">
                        Мониторинг
                    </h2>
                    {graphResult && (
                        <span className="text-xs text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                            Обновлено: {new Date().toLocaleTimeString()}
                        </span>
                    )}
                </div>

                <div className="w-full h-[500px] bg-[#0B1120] border border-slate-800 rounded-xl p-4 relative">
                    {!graphResult && !loadingGraph && (
                        <div
                            className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 pointer-events-none">
                            <svg className="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor"
                                 viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                                      d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
                            </svg>
                            <p className="text-sm">Выберите комнаты и нажмите «Построить график»</p>
                        </div>
                    )}
                    <EthercheckChart data={graphResult}/>
                </div>
            </div>

            {/* Блок ошибок (с закрытием) */}
            {error && (
                <div
                    className="fixed bottom-8 right-8 max-w-md bg-red-900/95 text-white pl-6 pr-10 py-4 rounded-xl shadow-2xl border border-red-500/50 backdrop-blur animate-bounce-in z-50">
                    <div className="font-bold text-sm mb-1">Ошибка</div>
                    <div className="text-xs opacity-90">{error}</div>

                    {/* Крестик закрытия */}
                    <button
                        onClick={() => setError(null)}
                        className="absolute top-2 right-2 p-1 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                  d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
}
