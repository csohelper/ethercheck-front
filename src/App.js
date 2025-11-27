import { useEffect, useState } from 'react';
import './App.css';
import MyButton from './MyButton';

const restEndpoint =
    "https://monitor.slavapmk.ru/api/data?start=2025-11-27%2013:25&end=2025-11-27%2021:25&rooms=total";

function App() {
    const [text, setText] = useState("");

    useEffect(() => {
        const load = async () => {
            const res = await fetch(restEndpoint);
            const t = await res.text();   // ← вот это даёт строку
            setText(t);
        };

        load();
    }, []);

    return (
        <div className="App">
            <header className="App-header">
                <MyButton name="jhguyuygh" />
                <div>{text}</div>  {/* ← сюда вставляется весь текст ответа */}
            </header>
        </div>
    );
}

export default App;
