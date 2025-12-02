import EthercheckGraphPage from './pages/MainPage'
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css"


const App = () => {
    return (
        <div className="app-dark">
            <EthercheckGraphPage />
        </div>
    );
};

export default App;