import React from 'react';
import './App.css';
import IFCFileUploader from './IFCFileUploader';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>IFC Project Viewer</h1>
        <IFCFileUploader />
      </header>
    </div>
  );
}

export default App;
