import React, { useState } from 'react';
import './IFCFileUploader.css'; // Ensure this file has adequate styling

function IFCFileUploader() {
    const [results, setResults] = useState({
        checks: Array(15).fill({ value: null, passed: null }),
        totalCount: 0,
        proxyCount: 0
    });

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
        let newChecks = [...results.checks];
        const lines = content.split('\n');

        // Rule examples
        newChecks[0].passed = checkIfcElementFilled(lines, 'IFCPROJECT', 'Name');
        newChecks[1].passed = checkIfcElementFilled(lines, 'IFCSITE', 'Name');
        newChecks[2].passed = checkIfcElementFilled(lines, 'IFCBUILDING', 'Name');
        newChecks[3].passed = checkIfcElementFilled(lines, 'IFCBUILDINGSTOREY', 'Name');
        newChecks[4].passed = checkObjectRelations(lines, 'BuildingStory');
        newChecks[5].passed = checkObjectRelations(lines, 'Building', 'IFCBUILDING');
        newChecks[6].passed = checkObjectRelations(lines, 'Site', 'IFCSITE');
        newChecks[7].passed = checkObjectRelations(lines, 'Project', 'IFCPROJECT');
        newChecks[8].passed = checkIfcSpaceNameFilled(lines);
        newChecks[9].passed = checkAllObjectsHaveAttribute(lines, 'Name');
        newChecks[10].passed = checkAllObjectsHaveAttribute(lines, 'TypeName');
        newChecks[11].passed = checkAllObjectsHaveAttribute(lines, 'Description');
        newChecks[12].passed = checkAllObjectsHaveAttribute(lines, 'MaterialName');
        newChecks[13].passed = checkIfObjectsHavePredefinedTypeFilled(lines);

        let totalCount = countIfcObjects(lines);
        let proxyCount = countSpecificType(lines, 'IFCBUILDINGELEMENTPROXY');

        setResults({
          checks: newChecks,
          totalCount: countIfcObjects(lines),
          proxyCount: countSpecificType(lines, 'IFCBUILDINGELEMENTPROXY')
      });
  };
  
  const checkObjectRelations = (lines, relationType, elementPrefix) => {
      const relationRegex = new RegExp(`IFCRELCONTAINS${relationType.toUpperCase()}\\((?:[^)]+), #\\d+\\)`);
      const elementRegex = new RegExp(`${elementPrefix}\\(`);
      return lines.filter(line => elementRegex.test(line)).every(elementLine => {
          const elementId = elementLine.match(/#(\d+)/)[1];
          return relationRegex.test(lines.join('\n'));
      });
  };
  
  const checkIfcSpaceNameFilled = (lines) => {
      const spaceRegex = /IFCSPACE\('[^']+',#[^,]+,'([^']*)'/gi;
      let match, allFilled = true;
      while ((match = spaceRegex.exec(lines.join('\n'))) !== null) {
          if (match[1].trim() === '') allFilled = false;
      }
      return allFilled;
  };
  
  const checkAllObjectsHaveAttribute = (lines, attributeName) => {
      const objectRegex = new RegExp(`IFC\\w+\\('[^']+',#[^,]+,'([^']*)'`, 'gi');
      let match, allHaveAttribute = true;
      while ((match = objectRegex.exec(lines.join('\n'))) !== null) {
          if (match[1].trim() === '') allHaveAttribute = false;
      }
      return allHaveAttribute;
  };
  
  const checkIfObjectsHavePredefinedTypeFilled = (lines) => {
      const typeRegex = /IFC\w+\((?:[^,]+,){11}'PredefinedType=([^']*)'/gi;
      let match, allFilled = true;
      while ((match = typeRegex.exec(lines.join('\n'))) !== null) {
          if (match[1].trim() === '') allFilled = false;
      }
      return allFilled;
  };

    const checkIfcElementFilled = (lines, elementType, attribute) => {
        const regex = new RegExp(`${elementType}.*'([^']+)'`);
        return lines.some(line => regex.test(line));
    };

    const countIfcObjects = (lines) => {
        return lines.filter(line => line.startsWith('IFC')).length;
    };

    const countSpecificType = (lines, typeName) => {
        return lines.filter(line => line.includes(typeName)).length;
    };


    return (
        <div>
            <input type="file" accept=".ifc" onChange={handleFileUpload} />
            <div className="results">
                <h2>IFC File Analysis</h2>
                <ul>
                    {results.checks.map((check, index) => (
                        <li key={index} className="check-item">
                            {`Rule ${index + 1}: ${check.passed ? 'Yes' : 'No'}`}
                        </li>
                    ))}
                </ul>
                <p>Total IFC Objects: {results.totalCount}</p>
                <p>IFC Building Element Proxy Count: {results.proxyCount}</p>
            </div>
        </div>
    );
}

export default IFCFileUploader;
