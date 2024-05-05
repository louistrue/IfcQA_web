import * as WEBIFC from "web-ifc";
import { IfcPropertiesUtils } from "../IfcPropertiesUtils";
import { Button, FloatingWindow, SimpleUIComponent, TreeView } from "../../ui";
import { Event, UIElement, Component } from "../../base-types";
import { ToolComponent } from "../../core";
import { IfcCategoryMap } from "../ifc-category-map";
import { AttributeSet, PropertyTag } from "./src";
import { FragmentManager } from "../../fragments/FragmentManager";
export * from "./src";
export class IfcPropertiesProcessor extends Component {
    // private _entityUIPool: UIPool<TreeView>;
    set propertiesManager(manager) {
        if (this._propertiesManager)
            return;
        this._propertiesManager = manager;
        if (manager) {
            manager.onElementToPset.add(async ({ model, psetID, elementID }) => {
                const modelIndexMap = this._indexMap[model.uuid];
                if (!modelIndexMap)
                    return;
                this.setEntityIndex(model, elementID).add(psetID);
                if (this._currentUI[elementID]) {
                    const ui = await this.newPsetUI(model, psetID);
                    this._currentUI[elementID].addChild(...ui);
                }
            });
            manager.onPsetRemoved.add(async ({ psetID }) => {
                const psetUI = this._currentUI[psetID];
                if (psetUI) {
                    await psetUI.dispose();
                }
            });
            manager.onPropToPset.add(async ({ model, psetID, propID }) => {
                const psetUI = this._currentUI[psetID];
                if (!psetUI)
                    return;
                const tag = await this.newPropertyTag(model, psetID, propID, "NominalValue");
                if (tag)
                    psetUI.addChild(tag);
            });
            this.onPropertiesManagerSet.trigger(manager);
        }
    }
    get propertiesManager() {
        return this._propertiesManager;
    }
    constructor(components) {
        super(components);
        /** {@link Disposable.onDisposed} */
        this.onDisposed = new Event();
        this.enabled = true;
        this.uiElement = new UIElement();
        this.relationsToProcess = [
            WEBIFC.IFCRELDEFINESBYPROPERTIES,
            WEBIFC.IFCRELDEFINESBYTYPE,
            WEBIFC.IFCRELASSOCIATESMATERIAL,
            WEBIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE,
            WEBIFC.IFCRELASSOCIATESCLASSIFICATION,
            WEBIFC.IFCRELASSIGNSTOGROUP,
        ];
        this.entitiesToIgnore = [WEBIFC.IFCOWNERHISTORY, WEBIFC.IFCMATERIALLAYERSETUSAGE];
        this.attributesToIgnore = [
            "CompositionType",
            "Representation",
            "ObjectPlacement",
            "OwnerHistory",
        ];
        this._indexMap = {};
        this._renderFunctions = {};
        this._propertiesManager = null;
        this._currentUI = {};
        this.onPropertiesManagerSet = new Event();
        this.onFragmentsDisposed = (data) => {
            delete this._indexMap[data.groupID];
        };
        this.components.tools.add(IfcPropertiesProcessor.uuid, this);
        // this._entityUIPool = new UIPool(this._components, TreeView);
        this._renderFunctions = this.getRenderFunctions();
        const fragmentManager = components.tools.get(FragmentManager);
        fragmentManager.onFragmentsDisposed.add(this.onFragmentsDisposed);
        if (components.uiEnabled) {
            this.setUI();
        }
    }
    getRenderFunctions() {
        return {
            0: (model, expressID) => this.newEntityUI(model, expressID),
            [WEBIFC.IFCPROPERTYSET]: (model, expressID) => this.newPsetUI(model, expressID),
            [WEBIFC.IFCELEMENTQUANTITY]: (model, expressID) => this.newQsetUI(model, expressID),
        };
    }
    async dispose() {
        await this.uiElement.dispose();
        this._indexMap = {};
        this.propertiesManager = null;
        for (const id in this._currentUI) {
            await this._currentUI[id].dispose();
        }
        this._currentUI = {};
        this.onPropertiesManagerSet.reset();
        const fragmentManager = this.components.tools.get(FragmentManager);
        fragmentManager.onFragmentsDisposed.remove(this.onFragmentsDisposed);
        await this.onDisposed.trigger(IfcPropertiesProcessor.uuid);
        this.onDisposed.reset();
    }
    async getProperties(model, id) {
        if (!model.hasProperties)
            return null;
        const map = this._indexMap[model.uuid];
        if (!map)
            return null;
        const indices = map[id];
        const idNumber = parseInt(id, 10);
        const props = model.getProperties(idNumber);
        const nativeProperties = this.cloneProperty(props);
        if (!nativeProperties) {
            throw new Error("Properties not found!");
        }
        const properties = [nativeProperties];
        if (indices) {
            for (const index of indices) {
                const props = model.getProperties(index);
                if (!props)
                    continue;
                const pset = this.cloneProperty(props);
                if (!pset)
                    continue;
                this.getPsetProperties(pset, model);
                this.getNestedPsets(pset, model);
                properties.push(pset);
            }
        }
        return properties;
    }
    getNestedPsets(pset, props) {
        if (pset.HasPropertySets) {
            for (const subPSet of pset.HasPropertySets) {
                const psetID = subPSet.value;
                subPSet.value = this.cloneProperty(props[psetID]);
                this.getPsetProperties(subPSet.value, props);
            }
        }
    }
    getPsetProperties(pset, props) {
        if (pset.HasProperties) {
            for (const property of pset.HasProperties) {
                const psetID = property.value;
                const result = this.cloneProperty(props[psetID]);
                property.value = { ...result };
            }
        }
    }
    setUI() {
        const topToolbar = new SimpleUIComponent(this.components);
        const propsList = new SimpleUIComponent(this.components, `<div class="flex flex-col"></div>`);
        const main = new Button(this.components, {
            materialIconName: "list",
        });
        const propertiesWindow = new FloatingWindow(this.components);
        this.components.ui.add(propertiesWindow);
        propertiesWindow.title = "Element Properties";
        propertiesWindow.addChild(topToolbar, propsList);
        main.tooltip = "Properties";
        main.onClick.add(() => {
            propertiesWindow.visible = !propertiesWindow.visible;
        });
        propertiesWindow.onHidden.add(() => (main.active = false));
        propertiesWindow.onVisible.add(() => (main.active = true));
        propertiesWindow.visible = false;
        this.uiElement.set({
            main,
            propertiesWindow,
            propsList,
            topToolbar,
        });
    }
    async cleanPropertiesList() {
        this._currentUI = {};
        if (this.components.uiEnabled) {
            if (this._propertiesManager) {
                const button = this._propertiesManager.uiElement.get("exportButton");
                button.removeFromParent();
            }
            const propsList = this.uiElement.get("propsList");
            await propsList.dispose(true);
            const propsWindow = this.uiElement.get("propertiesWindow");
            propsWindow.description = null;
            propsList.children = [];
        }
        // for (const child of this._propsList.children) {
        //   if (child instanceof TreeView) {
        //     this._entityUIPool.return(child);
        //     continue;
        //   }
        //   child.dispose();
        // }
    }
    get() {
        return this._indexMap;
    }
    async process(model) {
        if (!model.hasProperties) {
            throw new Error("FragmentsGroup properties not found");
        }
        this._indexMap[model.uuid] = {};
        // const relations: number[] = [];
        // for (const typeID in IfcCategoryMap) {
        //   const name = IfcCategoryMap[typeID];
        //   if (name.startsWith("IFCREL")) relations.push(Number(typeID));
        // }
        const setEntities = [WEBIFC.IFCPROPERTYSET, WEBIFC.IFCELEMENTQUANTITY];
        for (const relation of this.relationsToProcess) {
            await IfcPropertiesUtils.getRelationMap(model, relation, 
            // eslint-disable-next-line no-loop-func
            async (relationID, relatedIDs) => {
                const relationEntity = await model.getProperties(relationID);
                if (!relationEntity) {
                    return;
                }
                if (!setEntities.includes(relationEntity.type)) {
                    this.setEntityIndex(model, relationID);
                }
                for (const expressID of relatedIDs) {
                    this.setEntityIndex(model, expressID).add(relationID);
                }
            });
        }
    }
    async renderProperties(model, expressID) {
        if (!this.components.uiEnabled)
            return;
        await this.cleanPropertiesList();
        const topToolbar = this.uiElement.get("topToolbar");
        const propsList = this.uiElement.get("propsList");
        const propsWindow = this.uiElement.get("propertiesWindow");
        const ui = await this.newEntityUI(model, expressID);
        if (!ui)
            return;
        if (this._propertiesManager) {
            this._propertiesManager.selectedModel = model;
            const exporter = this._propertiesManager.uiElement.get("exportButton");
            topToolbar.addChild(exporter);
        }
        const { name } = await IfcPropertiesUtils.getEntityName(model, expressID);
        propsWindow.description = name;
        propsList.addChild(...[ui].flat());
    }
    async newEntityUI(model, expressID) {
        if (!model.hasProperties) {
            throw new Error("FragmentsGroup properties not found.");
        }
        const modelElementsIndexation = this._indexMap[model.uuid];
        if (!modelElementsIndexation)
            return null;
        const entity = await model.getProperties(expressID);
        const ignorable = this.entitiesToIgnore.includes(entity?.type);
        if (!entity || ignorable)
            return null;
        if (entity.type === WEBIFC.IFCPROPERTYSET)
            return this.newPsetUI(model, expressID);
        const mainGroup = await this.newEntityTree(model, expressID);
        if (!mainGroup)
            return null;
        this.addEntityActions(model, expressID, mainGroup);
        mainGroup.onExpand.add(async () => {
            const { uiProcessed } = mainGroup.data;
            if (uiProcessed)
                return;
            mainGroup.addChild(...this.newAttributesUI(model, expressID));
            const elementPropsIndexation = modelElementsIndexation[expressID] ?? [];
            for (const id of elementPropsIndexation) {
                const entity = await model.getProperties(id);
                if (!entity)
                    continue;
                const renderFunction = this._renderFunctions[entity.type] ?? this._renderFunctions[0];
                const ui = modelElementsIndexation[id]
                    ? await this.newEntityUI(model, id)
                    : await renderFunction(model, id);
                if (!ui)
                    continue;
                mainGroup.addChild(...[ui].flat());
            }
            mainGroup.data.uiProcessed = true;
        });
        return mainGroup;
    }
    setEntityIndex(model, expressID) {
        if (!this._indexMap[model.uuid][expressID])
            this._indexMap[model.uuid][expressID] = new Set();
        return this._indexMap[model.uuid][expressID];
    }
    newAttributesUI(model, expressID) {
        if (!model.hasProperties)
            return [];
        const attributesGroup = new AttributeSet(this.components, this, model, expressID);
        attributesGroup.attributesToIgnore = this.attributesToIgnore;
        return [attributesGroup];
    }
    async newPsetUI(model, psetID) {
        const uiGroups = [];
        const pset = await model.getProperties(psetID);
        if (!pset || pset.type !== WEBIFC.IFCPROPERTYSET) {
            return uiGroups;
        }
        const uiGroup = await this.newEntityTree(model, psetID);
        if (!uiGroup) {
            return uiGroups;
        }
        await this.addPsetActions(model, psetID, uiGroup);
        uiGroup.onExpand.add(async () => {
            const { uiProcessed } = uiGroup.data;
            if (uiProcessed)
                return;
            const psetPropsID = await IfcPropertiesUtils.getPsetProps(model, psetID, async (propID) => {
                const prop = await model.getProperties(propID);
                if (!prop)
                    return;
                const tag = await this.newPropertyTag(model, psetID, propID, "NominalValue");
                if (tag) {
                    uiGroup.addChild(tag);
                }
            });
            if (!psetPropsID || psetPropsID.length === 0) {
                const template = `
         <p class="text-base text-gray-500 py-1 px-3">
            This pset has no properties.
         </p>
        `;
                const notFoundText = new SimpleUIComponent(this.components, template);
                uiGroup.addChild(notFoundText);
            }
            uiGroup.data.uiProcessed = true;
        });
        uiGroups.push(uiGroup);
        return uiGroups;
    }
    async newQsetUI(model, qsetID) {
        const uiGroups = [];
        const qset = await model.getProperties(qsetID);
        if (!qset || qset.type !== WEBIFC.IFCELEMENTQUANTITY) {
            return uiGroups;
        }
        const uiGroup = await this.newEntityTree(model, qsetID);
        if (!uiGroup) {
            return uiGroups;
        }
        await this.addPsetActions(model, qsetID, uiGroup);
        await IfcPropertiesUtils.getQsetQuantities(model, qsetID, async (quantityID) => {
            const { key } = await IfcPropertiesUtils.getQuantityValue(model, quantityID);
            if (!key)
                return;
            const tag = await this.newPropertyTag(model, qsetID, quantityID, key);
            if (tag) {
                uiGroup.addChild(tag);
            }
        });
        uiGroups.push(uiGroup);
        return uiGroups;
    }
    async addPsetActions(model, psetID, uiGroup) {
        if (!this.propertiesManager)
            return;
        const propsUI = this.propertiesManager.uiElement;
        const psetActions = propsUI.get("psetActions");
        const event = await this.propertiesManager.setAttributeListener(model, psetID, "Name");
        event.add((v) => (uiGroup.description = v.toString()));
        uiGroup.innerElements.titleContainer.onmouseenter = () => {
            psetActions.data = { model, psetID };
            uiGroup.slots.titleRight.addChild(psetActions);
        };
        uiGroup.innerElements.titleContainer.onmouseleave = () => {
            if (psetActions.modalVisible)
                return;
            psetActions.removeFromParent();
            psetActions.cleanData();
        };
    }
    addEntityActions(model, expressID, uiGroup) {
        if (!this.propertiesManager)
            return;
        const propsUI = this.propertiesManager.uiElement;
        const entityActions = propsUI.get("entityActions");
        uiGroup.innerElements.titleContainer.onmouseenter = () => {
            entityActions.data = { model, elementIDs: [expressID] };
            uiGroup.slots.titleRight.addChild(entityActions);
        };
        uiGroup.innerElements.titleContainer.onmouseleave = () => {
            if (entityActions.modal.visible)
                return;
            entityActions.removeFromParent();
            entityActions.cleanData();
        };
    }
    async newEntityTree(model, expressID) {
        const entity = await model.getProperties(expressID);
        if (!entity)
            return null;
        const currentUI = this._currentUI[expressID];
        if (currentUI)
            return currentUI;
        const entityTree = new TreeView(this.components);
        this._currentUI[expressID] = entityTree;
        // const entityTree = this._entityUIPool.get();
        entityTree.title = `${IfcCategoryMap[entity.type]}`;
        const { name } = await IfcPropertiesUtils.getEntityName(model, expressID);
        entityTree.description = name;
        return entityTree;
    }
    async newPropertyTag(model, setID, expressID, valueKey) {
        const entity = await model.getProperties(expressID);
        if (!entity) {
            return null;
        }
        const tag = new PropertyTag(this.components, this, model, expressID);
        // @ts-ignore
        this._currentUI[expressID] = tag;
        if (!this.propertiesManager)
            return tag;
        // #region ManagementUI
        const propsUI = this.propertiesManager.uiElement;
        const propActions = propsUI.get("propActions");
        tag.get().onmouseenter = () => {
            propActions.data = { model, setID, expressID, valueKey };
            tag.addChild(propActions);
        };
        tag.get().onmouseleave = () => {
            if (propActions.modalVisible)
                return;
            propActions.removeFromParent();
            propActions.cleanData();
        };
        // #endregion ManagementUI
        return tag;
    }
    cloneProperty(item, result = {}) {
        if (!item) {
            return result;
        }
        for (const key in item) {
            const value = item[key];
            const isArray = Array.isArray(value);
            const isObject = typeof value === "object" && !isArray && value !== null;
            if (isArray) {
                result[key] = [];
                const subResult = result[key];
                this.clonePropertyArray(value, subResult);
            }
            else if (isObject) {
                result[key] = {};
                const subResult = result[key];
                this.cloneProperty(value, subResult);
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }
    clonePropertyArray(item, result) {
        for (const value of item) {
            const isArray = Array.isArray(value);
            const isObject = typeof value === "object" && !isArray && value !== null;
            if (isArray) {
                const subResult = [];
                result.push(subResult);
                this.clonePropertyArray(value, subResult);
            }
            else if (isObject) {
                const subResult = {};
                result.push(subResult);
                this.cloneProperty(value, subResult);
            }
            else {
                result.push(value);
            }
        }
    }
}
IfcPropertiesProcessor.uuid = "23a889ab-83b3-44a4-8bee-ead83438370b";
ToolComponent.libraryUUIDs.add(IfcPropertiesProcessor.uuid);
//# sourceMappingURL=index.js.map