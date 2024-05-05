import { Component, Event } from "../../base-types";
import { IfcCategoryMap, IfcPropertiesUtils } from "../../ifc";
import { ToolComponent } from "../../core";
import { FragmentManager } from "../FragmentManager";
export class FragmentClassifier extends Component {
    constructor(components) {
        super(components);
        /** {@link Component.enabled} */
        this.enabled = true;
        this._groupSystems = {};
        /** {@link Disposable.onDisposed} */
        this.onDisposed = new Event();
        this.onFragmentsDisposed = (data) => {
            const { groupID, fragmentIDs } = data;
            for (const systemName in this._groupSystems) {
                const system = this._groupSystems[systemName];
                const groupNames = Object.keys(system);
                if (groupNames.includes(groupID)) {
                    delete system[groupID];
                    if (Object.values(system).length === 0) {
                        delete this._groupSystems[systemName];
                    }
                }
                else {
                    for (const groupName of groupNames) {
                        const group = system[groupName];
                        for (const fragmentID of fragmentIDs) {
                            delete group[fragmentID];
                        }
                        if (Object.values(group).length === 0) {
                            delete system[groupName];
                        }
                    }
                }
            }
        };
        components.tools.add(FragmentClassifier.uuid, this);
        const fragmentManager = components.tools.get(FragmentManager);
        fragmentManager.onFragmentsDisposed.add(this.onFragmentsDisposed);
    }
    /** {@link Component.get} */
    get() {
        return this._groupSystems;
    }
    async dispose() {
        this._groupSystems = {};
        const fragmentManager = this.components.tools.get(FragmentManager);
        fragmentManager.onFragmentsDisposed.remove(this.onFragmentsDisposed);
        await this.onDisposed.trigger(FragmentClassifier.uuid);
        this.onDisposed.reset();
    }
    remove(guid) {
        for (const systemName in this._groupSystems) {
            const system = this._groupSystems[systemName];
            for (const groupName in system) {
                const group = system[groupName];
                delete group[guid];
            }
        }
    }
    find(filter) {
        const fragments = this.components.tools.get(FragmentManager);
        if (!filter) {
            const result = {};
            const fragList = fragments.list;
            for (const id in fragList) {
                const fragment = fragList[id];
                result[id] = new Set(fragment.ids);
            }
            return result;
        }
        // There must be as many matches as conditions.
        // E.g.: if the filter is "floor 1 and category wall",
        // this gets the items with 2 matches (1 match per condition)
        const filterCount = Object.keys(filter).length;
        const models = {};
        for (const name in filter) {
            const values = filter[name];
            if (!this._groupSystems[name]) {
                console.warn(`Classification ${name} does not exist.`);
                continue;
            }
            for (const value of values) {
                const found = this._groupSystems[name][value];
                if (found) {
                    for (const guid in found) {
                        if (!models[guid]) {
                            models[guid] = new Map();
                        }
                        for (const id of found[guid]) {
                            const matchCount = models[guid].get(id);
                            if (matchCount === undefined) {
                                models[guid].set(id, 1);
                            }
                            else {
                                models[guid].set(id, matchCount + 1);
                            }
                        }
                    }
                }
            }
        }
        const result = {};
        for (const guid in models) {
            const model = models[guid];
            for (const [id, numberOfMatches] of model) {
                if (numberOfMatches === undefined) {
                    throw new Error("Malformed fragments map!");
                }
                if (numberOfMatches === filterCount) {
                    if (!result[guid]) {
                        result[guid] = new Set();
                    }
                    result[guid].add(id);
                }
            }
        }
        return result;
    }
    byModel(modelID, group) {
        if (!this._groupSystems.model) {
            this._groupSystems.model = {};
        }
        const modelsClassification = this._groupSystems.model;
        if (!modelsClassification[modelID]) {
            modelsClassification[modelID] = {};
        }
        const currentModel = modelsClassification[modelID];
        for (const [expressID, data] of group.data) {
            const keys = data[0];
            for (const key of keys) {
                const fragID = group.keyFragments.get(key);
                if (!fragID)
                    continue;
                if (!currentModel[fragID]) {
                    currentModel[fragID] = new Set();
                }
                currentModel[fragID].add(expressID);
            }
        }
    }
    async byPredefinedType(group) {
        if (!this._groupSystems.predefinedTypes) {
            this._groupSystems.predefinedTypes = {};
        }
        const currentTypes = this._groupSystems.predefinedTypes;
        const ids = group.getAllPropertiesIDs();
        for (const id of ids) {
            const entity = await group.getProperties(id);
            if (!entity)
                continue;
            const predefinedType = String(entity.PredefinedType?.value).toUpperCase();
            if (!currentTypes[predefinedType]) {
                currentTypes[predefinedType] = {};
            }
            const currentType = currentTypes[predefinedType];
            for (const [_expressID, data] of group.data) {
                const keys = data[0];
                for (const key of keys) {
                    const fragmentID = group.keyFragments.get(key);
                    if (!fragmentID) {
                        throw new Error("Fragment ID not found!");
                    }
                    if (!currentType[fragmentID]) {
                        currentType[fragmentID] = new Set();
                    }
                    const currentFragment = currentType[fragmentID];
                    currentFragment.add(entity.expressID);
                }
            }
        }
    }
    byEntity(group) {
        if (!this._groupSystems.entities) {
            this._groupSystems.entities = {};
        }
        for (const [expressID, data] of group.data) {
            const rels = data[1];
            const type = rels[1];
            const entity = IfcCategoryMap[type];
            this.saveItem(group, "entities", entity, expressID);
        }
    }
    byStorey(group) {
        for (const [expressID, data] of group.data) {
            const rels = data[1];
            const storeyID = rels[0];
            const storeyName = storeyID.toString();
            this.saveItem(group, "storeys", storeyName, expressID);
        }
    }
    async byIfcRel(group, ifcRel, systemName) {
        if (!IfcPropertiesUtils.isRel(ifcRel))
            return;
        await IfcPropertiesUtils.getRelationMap(group, ifcRel, async (relatingID, relatedIDs) => {
            const { name: relatingName } = await IfcPropertiesUtils.getEntityName(group, relatingID);
            for (const expressID of relatedIDs) {
                this.saveItem(group, systemName, relatingName ?? "NO REL NAME", expressID);
            }
        });
    }
    saveItem(group, systemName, className, expressID) {
        if (!this._groupSystems[systemName]) {
            this._groupSystems[systemName] = {};
        }
        const keys = group.data.get(expressID);
        if (!keys)
            return;
        for (const key of keys[0]) {
            const fragmentID = group.keyFragments.get(key);
            if (fragmentID) {
                const system = this._groupSystems[systemName];
                if (!system[className]) {
                    system[className] = {};
                }
                if (!system[className][fragmentID]) {
                    system[className][fragmentID] = new Set();
                }
                system[className][fragmentID].add(expressID);
            }
        }
    }
}
FragmentClassifier.uuid = "e25a7f3c-46c4-4a14-9d3d-5115f24ebeb7";
ToolComponent.libraryUUIDs.add(FragmentClassifier.uuid);
//# sourceMappingURL=index.js.map