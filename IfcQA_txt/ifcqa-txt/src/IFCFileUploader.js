import React, { useState } from 'react';
import './IFCFileUploader.css';
import { rules } from './rules';  

function IFCFileUploader() {
    const [results, setResults] = useState([]);
    const [progress, setProgress] = useState(0);
    const [expandedRule, setExpandedRule] = useState(null);
    const [fileProcessing, setFileProcessing] = useState(false);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            setFileProcessing(true);
            readInChunks(file);
        }
    };

    const processContentChunk = (chunk, isLastChunk, totalSize, currentOffset) => {
        let combinedResults = rules.map(rule => {
            const partialResult = rule.process(chunk, rule.regex);
            return {
                name: rule.name,
                partialResult: partialResult,
                isLastChunk: isLastChunk
            };
        });

        setProgress((currentOffset / totalSize) * 100);
        setResults(prevResults => combineResults(prevResults, combinedResults, isLastChunk));
        if (isLastChunk) {
            setFileProcessing(false);
        }
    };

    const combineResults = (prevResults, newResults, isLastChunk) => {
        let updatedResults = prevResults.length > 0 ? [...prevResults] : newResults.map(res => ({
            name: res.name,
            result: { value: res.partialResult || null, passed: false }  
        }));

        newResults.forEach((newResult, index) => {
            if (typeof newResult.partialResult === 'number') {
                updatedResults[index].result.value += newResult.partialResult;
            } else if (Array.isArray(newResult.partialResult)) {
                updatedResults[index].result.value = [...(updatedResults[index].result.value || []), ...newResult.partialResult];
            } else {
                updatedResults[index].result.value = newResult.partialResult || updatedResults[index].result.value;
            }

            if (isLastChunk) {
                updatedResults[index].result.passed = rules[index].check(updatedResults[index].result.value).passed;
            }
        });

        return updatedResults;
    };

    const readInChunks = (file) => {
        const chunkSize = 1024 * 1024 * 5; // 5 MB
        let offset = 0;
        const totalSize = file.size;

        const fileReader = new FileReader();

        fileReader.onload = (e) => {
            const chunk = e.target.result;
            processContentChunk(chunk, offset + chunkSize >= totalSize, totalSize, offset + chunkSize);

            offset += chunkSize;
            if (offset < totalSize) {
                readNextChunk();
            }
        };

        fileReader.onerror = (e) => {
            console.error("Error reading file", e);
        };

        const readNextChunk = () => {
            const slice = file.slice(offset, offset + chunkSize);
            fileReader.readAsText(slice);
        };

        readNextChunk();
    };

    const toggleExpanded = (ruleName) => {
        setExpandedRule(expandedRule === ruleName ? null : ruleName);
    };

    return (
        <div>
            <input type="file" accept=".ifc" onChange={handleFileUpload} />
            {fileProcessing && <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
            </div>}
            <div className="results">
                <h2>IFC File Checks</h2>
                <ul>
                    {results.map((rule, index) => (
                        <li key={index} className={`rule-item ${rule.name.toLowerCase().replace(/ /g, '-')}`}>
                            {rule.name}:
                            {fileProcessing ? <span className="processing">Processing...</span> : 
                             rule.result.passed ? <span className="passed">&#x2714;</span> : <span className="failed">&#x2716;</span>}
                            {rule.result.value && Array.isArray(rule.result.value) ? (
                                <button onClick={() => toggleExpanded(rule.name)} className="expand-toggle">{expandedRule === rule.name ? 'Collapse' : 'Expand'}</button>
                            ) : (
                                <span> ({rule.result.value ? rule.result.value.toString() : 'N/A'})</span>
                            )}
                            {expandedRule === rule.name && (
                                <ul className="nested">
                                    {rule.result.value.map((item, i) => <li key={i}>{item}</li>)}
                                </ul>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default IFCFileUploader;
