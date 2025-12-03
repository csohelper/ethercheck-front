import React, { useEffect, useState } from "react";
import EthercheckChart from "./EthercheckChart";

export default function EthercheckGraphPage() {
    // --- STATE ---
    const [rooms, setRooms] = useState([]);
    const [selectedRooms, setSelectedRooms] = useState([]);
    const [isSummaryMode, setIsSummaryMode] = useState(false);

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
                let loaded = [];
                if (data && Array.isArray(data.rooms)) loaded = data.rooms;
                else if (Array.isArray(data)) loaded = data;

                if (loaded.length > 0) {
                    const cleanRooms = loaded.filter(r => r !== "total" && r !== "summary");
                    setRooms(cleanRooms);
                    setSelectedRooms(["total"]);
                    setIsSummaryMode(false);
                }
            })
            .catch((err) => {
                console.error(err);
                if (mounted) setRooms(["204", "430", "536"]);
            })
            .finally(() => mounted && setLoadingRooms(false));

        return () => { mounted = false; };
    }, []);

    function toggleRoom(roomValue) {
        setGraphResult(null);

        if (roomValue === "total") {
            setSelectedRooms(['total']);
            setIsSummaryMode(false);
        } else if (roomValue === "summary") {
            setIsSummaryMode(true);
            setSelectedRooms([]);
        } else {
            setIsSummaryMode(false);
            let currentSelection = selectedRooms;
            if (selectedRooms.includes('total') || isSummaryMode) {
                currentSelection = [];
            }
            if (currentSelection.includes(roomValue)) {
                setSelectedRooms(currentSelection.filter(r => r !== roomValue));
            } else {
                setSelectedRooms([...currentSelection, roomValue]);
            }
        }
    }

    const formatDateForApi = (d) => {
        if (!d) return "";
        if (d.includes(" ")) return d;
        return d.replace("T", " ").slice(0, 16);
    };

    async function fetchGraph() {
        setError(null);
        setGraphResult(null);
        setLoadingGraph(true);

        try {
            let roomsParam = "";
            if (isSummaryMode) {
                roomsParam = rooms.join(",");
            } else if (selectedRooms.includes("total")) {
                roomsParam = "total";
            } else {
                if (selectedRooms.length === 0) throw new Error("Выберите комнаты");
                roomsParam = selectedRooms.join(",");
            }

            const params = new URLSearchParams();
            params.append("start", formatDateForApi(dateStart));
            params.append("end", formatDateForApi(dateEnd));
            params.append("rooms", roomsParam);

            const url = `https://monitor.slavapmk.ru/api/graph?${params.toString()}`;
            const res = await fetch(url, { method: "GET", headers: {"Accept": "application/json"} });

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

    const RoomItem = ({ value, label, colorClass = "text-slate-400" }) => {
        let isSelected = false;
        if (value === 'summary') isSelected = isSummaryMode;
        else if (value === 'total') isSelected = !isSummaryMode && selectedRooms.includes('total');
        else isSelected = !isSummaryMode && selectedRooms.includes(value);

        return (
            <div
                onClick={() => toggleRoom(value)}
                className={`
                    flex items-center justify-between px-3 py-3 md:py-2 rounded-lg text-sm cursor-pointer transition-all duration-200 border mb-1
                    ${isSelected
                    ? "bg-sky-600 border-sky-500 text-white shadow-lg shadow-sky-900/20"
                    : `bg-transparent border-transparent ${colorClass} hover:bg-slate-800 hover:text-slate-200`}
                `}
            >
                <span className={isSelected ? "font-semibold" : ""}>{label}</span>
                {isSelected && <span className="text-xs opacity-80">✓</span>}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#0B1120] text-slate-200 flex flex-col items-center py-4 md:py-8 px-3 md:px-4 font-sans selection:bg-sky-500/30">

            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-blue-600/10 rounded-full blur-[60px] md:blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-purple-600/10 rounded-full blur-[60px] md:blur-[100px]" />
            </div>

            <header className="w-full max-w-6xl flex flex-col md:flex-row items-center md:justify-start gap-3 mb-6 md:mb-8 z-10 text-center md:text-left">
                <div className="flex items-center gap-3">
                    <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </div>
                    <h1 className="text-lg md:text-xl font-bold tracking-wide text-white">
                        Система Мониторинга Сети
                    </h1>
                </div>
            </header>

            {/* Панель управления */}
            <div className="w-full max-w-6xl bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-2xl p-4 md:p-6 z-10">

                {/* Кнопки времени - скролл на мобилке */}
                <div className="flex overflow-x-auto pb-2 md:pb-0 gap-2 mb-6 custom-scrollbar">
                    {[
                        { label: '1 час', val: 1 },
                        { label: '3 часа', val: 3 },
                        { label: '12 часов', val: 12 },
                        { label: 'Сутки', val: 24 },
                        { label: 'Сегодня', val: 'today' }
                    ].map((btn) => (
                        <button
                            key={btn.label}
                            onClick={() => setTimeRange(btn.val)}
                            className="whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700 transition-all"
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>

                {/* Сетка: 1 колонка на мобильном, 3 на десктопе */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-6">

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Начало периода
                        </label>
                        <input
                            type="datetime-local"
                            value={dateStart}
                            onChange={(e) => setDateStart(e.target.value)}
                            className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-sky-500 outline-none transition-all"
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
                            className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                        />
                    </div>

                    <div className="flex flex-col h-[250px] md:h-[280px]">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Комнаты ({selectedRooms.length})
                            </span>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => toggleRoom('total')}
                                    className="text-[10px] font-bold text-white/60 hover:text-white uppercase transition-colors"
                                >
                                    Сброс
                                </button>
                                <button
                                    onClick={() => setSelectedRooms([])}
                                    className="text-[10px] font-bold text-white/60 hover:text-white uppercase transition-colors"
                                >
                                    Очистить
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 bg-[#0F172A] border border-slate-700 rounded-xl overflow-hidden flex flex-col">
                            {loadingRooms ? (
                                <div className="flex items-center justify-center h-full text-xs text-slate-500">
                                    Загрузка...
                                </div>
                            ) : (
                                <div className="overflow-y-auto p-2 h-full custom-scrollbar">
                                    <RoomItem
                                        value="total"
                                        label="★ Все комнаты"
                                        colorClass="text-amber-400 font-medium"
                                    />
                                    <RoomItem
                                        value="summary"
                                        label="★ Суммарно"
                                        colorClass="text-amber-400 font-medium"
                                    />
                                    <div className="h-[1px] bg-slate-800 my-2 mx-1" />
                                    {rooms.map((room) => (
                                        <RoomItem key={room} value={room} label={`Комната ${room}`} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 pt-6 border-t border-slate-800">
                    <button
                        onClick={fetchGraph}
                        disabled={loadingGraph}
                        className="w-full md:flex-1 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 active:scale-[0.98]"
                    >
                        {loadingGraph ? "Загрузка..." : "Построить график"}
                    </button>

                    <button
                        onClick={() => { setGraphResult(null); setError(null); }}
                        className="w-full md:w-auto px-6 py-3 rounded-xl border border-slate-700 text-white hover:bg-slate-800 transition-colors font-medium"
                    >
                        Очистить
                    </button>
                </div>
            </div>

            {/* График */}
            <div className="w-full max-w-6xl mt-6 md:mt-8 bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-2xl p-4 md:p-8 z-10">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                    <h2 className="text-base md:text-lg font-semibold text-white">
                        Мониторинг
                    </h2>
                    {graphResult && (
                        <span className="text-[10px] md:text-xs text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                            {new Date().toLocaleTimeString()}
                        </span>
                    )}
                </div>

                <div className="w-full h-[350px] md:h-[500px] bg-[#0B1120] border border-slate-800 rounded-xl p-2 md:p-4 relative overflow-hidden">
                    {!graphResult && !loadingGraph && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 pointer-events-none text-center px-4">
                            <svg className="w-10 h-10 md:w-12 md:h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>
                            <p className="text-xs md:text-sm">Выберите параметры и нажмите «Построить график»</p>
                        </div>
                    )}
                    <EthercheckChart data={graphResult} isSummary={isSummaryMode} />
                </div>
            </div>

            {error && (
                <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 max-w-[90%] md:max-w-md bg-red-900/95 text-white pl-5 pr-10 py-4 rounded-xl shadow-2xl border border-red-500/50 backdrop-blur animate-bounce-in z-50">
                    <div className="font-bold text-sm mb-1">Ошибка</div>
                    <div className="text-xs opacity-90 break-words">{error}</div>
                    <button
                        onClick={() => setError(null)}
                        className="absolute top-2 right-2 p-1 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
            )}
        </div>
    );
}
