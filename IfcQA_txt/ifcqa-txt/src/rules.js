// Utility functions that are used in the rules
function extractAttributeValue(content, regex) {
    const match = content.match(regex);
    return match ? match[1] : undefined;
}

function countOccurrences(content, regex) {
    return (content.match(regex) || []).length;
}

function extractBuildingStoreys(content, regex) {
    let matches, names = [];
    while ((matches = regex.exec(content)) !== null) {
        names.push(matches[1]);
    }
    return names;
}

function countUnassignedElements(content, regex) {
    let unassignedDetails = [], elementMatch;
    while ((elementMatch = regex.exec(content)) !== null) {
        const elementId = content.substring(elementMatch.index).match(/#(\d+)/)[1];
        if (!new RegExp(`#(${elementId}).*IFCRELCONTAINEDINSPATIALSTRUCTURE`, 'gi').test(content)) {
            // Assuming that we can extract a name or other identifier the same way
            const nameMatch = content.substring(elementMatch.index).match(/'([^']*)'/); // Adjust regex as necessary
            unassignedDetails.push({
                id: elementId,
                name: nameMatch ? nameMatch[1] : "Unnamed Element"
            });
        }
    }
    return unassignedDetails; // Return an array of details about unassigned elements
}


function checkDefined(value) {
    return {
        value,
        passed: !!value
    };
}

function checkProxyCount(count) {
    return {
        value: count,
        passed: count === 0
    };
}


function checkIfcSpaceNames(content, regex) {
    let matches, missingNames = 0;
    while ((matches = regex.exec(content)) !== null) {
        if (!matches[1]) {
            missingNames++;
        }
    }
    return missingNames === 0; // Return true if no missing names
}

function checkObjectRelations(content, objectRegex, relationRegex) {
    let objectMatches = content.match(objectRegex) || [];
    return objectMatches.every(object => {
        const match = object.match(/#(\d+)/);
        if (!match) return false;  // Return false if no ID match is found
        const objectId = match[1];
        const relationPattern = new RegExp(`#(${objectId}).*${relationRegex}`, 'gi');
        return relationPattern.test(content);
    });
}


// Rule definitions
export const rules = [
    {
        name: 'Project Name',
        regex: /IFCPROJECT\('[^']+',#[^,]+,'([^']+)'/i,
        process: extractAttributeValue,
        check: checkDefined
    },
    {
        name: 'Objects related to Project',
        regex: /IFC(WALLSTANDARDCASE|DOOR|WINDOW|SLAB|COLUMN|BEAM|BUILDINGELEMENTPROXY)/gi,
        process: (content, regex) => checkObjectRelations(content, regex, 'IFCPROJECT'),
        check: passed => ({ value: passed, passed })
    },
    {
        name: 'Site Name',
        regex: /IFCSITE\('[^']+',#[^,]+,'([^']+)'/i,
        process: extractAttributeValue,
        check: checkDefined
    },
    {
        name: 'Objects related to Site',
        regex: /IFC(WALLSTANDARDCASE|DOOR|WINDOW|SLAB|COLUMN|BEAM|BUILDINGELEMENTPROXY)/gi,
        process: (content, regex) => checkObjectRelations(content, regex, 'IFCSITE'),
        check: passed => ({ value: passed, passed })
    },
    {
        name: 'Building Name',
        regex: /IFCBUILDING\('[^']+',#[^,]+,'([^']+)'/i,
        process: extractAttributeValue,
        check: checkDefined
    },
    {
        name: 'Objects related to Building',
        regex: /IFC(WALLSTANDARDCASE|DOOR|WINDOW|SLAB|COLUMN|BEAM|BUILDINGELEMENTPROXY)/gi,
        process: (content, regex) => checkObjectRelations(content, regex, 'IFCBUILDING'),
        check: passed => ({ value: passed, passed })
    },
    {
        name: 'Storey Names',
        regex: /IFCBUILDINGSTOREY\('[^']+',#[^,]+,'([^']+)'/gi,
        process: extractBuildingStoreys,
        check: value => ({ value, passed: value.length > 0 })
    },
    {
        name: 'Objects related to BuildingStory',
        regex: /IFC(WALLSTANDARDCASE|DOOR|WINDOW|SLAB|COLUMN|BEAM|BUILDINGELEMENTPROXY)/gi,
        process: (content, regex) => checkObjectRelations(content, regex, 'IFCBUILDINGSTOREY'),
        check: passed => ({ value: passed, passed })
    },
    {
        name: 'Unassigned Elements',
        regex: /IFC(WALLSTANDARDCASE|DOOR|WINDOW|SLAB|COLUMN|BEAM|BUILDINGELEMENTPROXY)\(/gi,
        process: countUnassignedElements,
        check: value => ({ value, passed: value.length === 0 })  // Adjust to check that the array is empty for passing
    },
    
    {
        name: 'Proxy Count',
        regex: /IFCBUILDINGELEMENTPROXY/gi,
        process: countOccurrences,
        check: checkProxyCount
    },
    {
        name: 'IfcSpaces with Names',
        regex: /IFCSPACE\('[^']+',#[^,]+,'([^']*)'/gi,
        process: (content, regex) => countOccurrences(content, regex) - checkIfcSpaceNames(content, regex),
        check: count => ({ value: count, passed: count === 0 })
    },




];
