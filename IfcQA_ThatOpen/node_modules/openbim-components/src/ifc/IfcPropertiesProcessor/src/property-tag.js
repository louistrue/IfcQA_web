import { SimpleUIComponent } from "../../../ui/SimpleUIComponent";
import { UIManager } from "../../../ui/UIManager";
import { IfcPropertiesUtils } from "../../IfcPropertiesUtils";
export class PropertyTag extends SimpleUIComponent {
    get label() {
        return this.innerElements.label.textContent;
    }
    set label(value) {
        this.innerElements.label.textContent = value;
    }
    get value() {
        return this.innerElements.value.textContent;
    }
    set value(value) {
        this.innerElements.value.textContent = String(value);
    }
    constructor(components, propertiesProcessor, model, expressID) {
        const template = `
    <div class="flex gap-x-2 hover:bg-ifcjs-120 py-1 px-3 rounded-md items-center min-h-[40px]">
      <div class="flex flex-col grow">
        <p id="label" class="${UIManager.Class.Label}"></p>
        <p id="value" class="text-base my-0"></p>
      </div> 
    </div> 
    `;
        super(components, template);
        this.name = "PropertyTag";
        this.expressID = 0;
        this.innerElements = {
            label: this.getInnerElement("label"),
            value: this.getInnerElement("value"),
        };
        this.model = model;
        this.expressID = expressID;
        this._propertiesProcessor = propertiesProcessor;
        this.setInitialValues();
        this.setListeners();
    }
    async dispose(onlyChildren = false) {
        await super.dispose(onlyChildren);
        this.model = null;
        this._propertiesProcessor = null;
        if (Object.keys(this.innerElements).length) {
            this.innerElements.value.remove();
            this.innerElements.label.remove();
        }
    }
    async setListeners() {
        const propertiesManager = this._propertiesProcessor.propertiesManager;
        if (!propertiesManager)
            return;
        const { key: nameKey } = await IfcPropertiesUtils.getEntityName(this.model, this.expressID);
        const { key: valueKey } = await IfcPropertiesUtils.getQuantityValue(this.model, this.expressID);
        if (nameKey) {
            const event = await propertiesManager.setAttributeListener(this.model, this.expressID, nameKey);
            event.add((v) => (this.label = v.toString()));
        }
        if (valueKey) {
            const event = await propertiesManager.setAttributeListener(this.model, this.expressID, valueKey);
            event.add((v) => (this.value = v));
        }
    }
    async setInitialValues() {
        const entity = await this.model.getProperties(this.expressID);
        if (!entity) {
            this.label = "NULL";
            this.value = `ExpressID ${this.expressID} not found`;
        }
        else {
            const { name } = await IfcPropertiesUtils.getEntityName(this.model, this.expressID);
            const { value } = await IfcPropertiesUtils.getQuantityValue(this.model, this.expressID);
            this.label = name;
            this.value = value;
        }
    }
}
//# sourceMappingURL=property-tag.js.map