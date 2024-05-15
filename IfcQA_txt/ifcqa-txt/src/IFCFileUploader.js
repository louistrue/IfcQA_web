import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import React, { useState } from 'react';
import './IFCFileUploader.css';
import { rules } from './rules';

function IFCFileUploader() {
    const [results, setResults] = useState([]);
    const [progress, setProgress] = useState(0);
    const [expandedRule, setExpandedRule] = useState(null);
    const [fileProcessing, setFileProcessing] = useState(false);

    const handleFileUpload = (event) => {
        setResults([]);
        const file = event.target.files[0];
        if (file) {
            setFileProcessing(true);
            readInChunks(file);
        }
    };

    const processContentChunk = (chunk, isLastChunk, totalSize, currentOffset) => {
        let combinedResults = rules.map(rule => {
            const partialResult = rule.process(chunk, rule.regex) || [];
            return {
                name: rule.name,
                partialResult: Array.isArray(partialResult) ? partialResult : [partialResult],
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
            result: { value: [], passed: false }
        }));
    
        newResults.forEach((newResult, index) => {
            const currentResult = updatedResults[index].result;
            const currentValues = currentResult.value;
    
            // Check if the partial result is non-None and not undefined
            if (newResult.partialResult && newResult.partialResult[0] !== 'None' && newResult.partialResult[0] !== undefined) {
                // Specific handling for Project Name, Site Name, and Building Name
                if (['Project Name', 'Site Name', 'Building Name'].includes(updatedResults[index].name)) {
                    // Set the value only if no valid value has been set yet
                    if (currentValues.length === 0) {
                        currentResult.value = newResult.partialResult;
                    }
                } else {
                    // For other fields, append new non-None values ensuring uniqueness
                    const nonEmptyResults = newResult.partialResult.filter(x => x !== 'None');
                    currentResult.value = [...new Set([...currentValues, ...nonEmptyResults])];
                }
            }
    
            // Update the pass status on the last chunk
            if (isLastChunk) {
                currentResult.passed = rules[index].check(currentResult.value).passed;
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
                {results.map((rule, index) => {
                    const isNameEmpty = ['Project Name', 'Building Name', 'Site Name'].includes(rule.name) && rule.result.value === '';
                    // If the rule name is 'Project Name' or 'Building Name' and its value is empty, set rule.result.passed to false
                    if (isNameEmpty) {
                        rule.result.passed = false;
                    }

                    const shouldShowExpansion = (rule) => {
                        return rule.result.value.length > 0 && (rule.name === 'Storey Names' || !rule.result.passed);
                    };

                    return (
                        <li key={index} className={`rule-item ${rule.name.toLowerCase().replace(/ /g, '-')}`}>
                            {rule.name}:
                            {fileProcessing ? (
                                <span className="processing">❌</span>
                            ) : (
                                <>
                                {['Project Name', 'Building Name', 'Site Name'].includes(rule.name) ? (
                                    <span style={{ color: 'green' }}>
                                        {rule.result.passed ? `(${[...new Set(rule.result.value)].join(', ')})` : <span className="failed">&#x2716;</span>}
                                    </span>
                                ) : (
                                    rule.result.passed ? <span className="passed">&#x2714;</span> : <span className="failed">&#x2716;</span>
                                )}
                                </>
                            )}
                            {shouldShowExpansion(rule) && (
                                <button onClick={() => toggleExpanded(rule.name)} className="expand-toggle">
                                    {expandedRule === rule.name ? '☝️' : '👇'}
                                    <ExpandMoreIcon style={{ transform: expandedRule === rule.name ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                                </button>
                            )}
                            {expandedRule === rule.name && Array.isArray(rule.result.value) && (
                                <ul className="nested">
                                    {rule.result.value.map((item, i) => (
                                        <li key={i}>
                                            <div>GlobalId: {item.globalId}</div>
                                            <div>Name: {item.name || "Unnamed Element"}</div>
                                        </li>
                                    ))}
                                </ul>
                            )}                       
                        </li>
                    );
                })}
            </ul>
        </div>
    </div>
);
}

export default IFCFileUploader;
