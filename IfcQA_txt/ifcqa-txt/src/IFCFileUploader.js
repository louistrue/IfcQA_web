import React, { useState } from 'react';
import './IFCFileUploader.css'; // Ensure this file has adequate styling

function IFCFileUploader() {
  const [results, setResults] = useState({
    projectName: { value: null, passed: null },
    buildingName: { value: null, passed: null },
    proxyCount: { value: null, passed: null },
    storeyNames: { value: [], passed: null },
    unassignedElements: { value: 0, passed: null }
  });
  const [expanded, setExpanded] = useState(false); // State to toggle unassigned elements list

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const content = e.target.result;
        processIFCContent(content);
      };
      reader.readAsText(file);
    }
  };

  const processIFCContent = (content) => {
    const newResults = {
      ...results,
      projectName: checkDefined(extractAttributeValue(content, /IFCPROJECT\('[^']+',#[^,]+,'([^']+)'/i)),
      buildingName: checkDefined(extractAttributeValue(content, /IFCBUILDING\('[^']+',#[^,]+,'([^']+)'/i)),
      proxyCount: checkProxyCount(countOccurrences(content, /IFCBUILDINGELEMENTPROXY/gi)),
      storeyNames: { value: extractBuildingStoreys(content), passed: true },
      unassignedElements: checkUnassignedElements(countUnassignedElements(content))
    };
    setResults(newResults);
  };

  const extractAttributeValue = (content, regex) => {
    const match = content.match(regex);
    return match ? match[1] : undefined;
  };

  const countOccurrences = (content, regex) => {
    return (content.match(regex) || []).length;
  };

  const extractBuildingStoreys = (content) => {
    const regex = /IFCBUILDINGSTOREY\('[^']+',#[^,]+,'([^']+)'/gi;
    let matches, names = [];
    while ((matches = regex.exec(content)) !== null) {
      names.push(matches[1]);
    }
    return names;
  };

  const countUnassignedElements = (content) => {
    const elementRegex = /IFC(WALLSTANDARDCASE|DOOR|WINDOW|SLAB|COLUMN|BEAM|BUILDINGELEMENTPROXY)\(/gi;
    let unassignedCount = 0, elementMatch;
    while ((elementMatch = elementRegex.exec(content)) !== null) {
      const elementId = content.substring(elementMatch.index).match(/#(\d+)/)[1];
      if (!new RegExp(`#(${elementId}).*IFCRELCONTAINEDINSPATIALSTRUCTURE`, 'gi').test(content)) {
        unassignedCount++;
      }
    }
    return unassignedCount;
  };

  const checkDefined = (value) => ({
    value,
    passed: !!value
  });

  const checkProxyCount = (count) => ({
    value: count,
    passed: count === 0
  });

  const checkUnassignedElements = (count) => ({
    value: count,
    passed: count === 0
  });

  const toggleExpanded = () => setExpanded(!expanded); // Toggle for expanding/collapsing

  return (
    <div>
      <input type="file" accept=".ifc" onChange={handleFileUpload} />
      <div className="results">
        <h2>IFC File Checks</h2>
        <ul>
          {Object.keys(results).map(key => (
            <li key={key} className={`rule-item ${key}`}>
              {key.replace(/([A-Z])/g, ' $1').trim()}:
              {key === 'storeyNames' ? 
                <ul className="nested">{results.storeyNames.value.map((name, index) => <li key={index}>{name}</li>)}</ul> :
                key === 'unassignedElements' && results.unassignedElements.value > 0 ? 
                <div>
                  <button onClick={toggleExpanded} className="expand-button">
                    {expanded ? 'Collapse' : 'Expand'} List
                  </button>
                  {expanded && <ul className="nested">
                    {Array.from({ length: results.unassignedElements.value }, (_, i) => <li key={i}>Element {i + 1}</li>)}
                  </ul>}
                </div> :
                results[key].passed !== null ? (
                  results[key].passed ? 
                  <span className="passed">{(results[key].value || '').toString()} &#x2714;</span> : 
                  <span className="failed">{(results[key].value || '').toString()} &#x2716;</span>
                ) : <span className="pending">Pending check...</span>
              }
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default IFCFileUploader;
