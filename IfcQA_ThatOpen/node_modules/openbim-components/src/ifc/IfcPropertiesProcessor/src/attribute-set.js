import { TreeView } from "../../../ui";
import { AttributeTag } from "./attribute-tag";
export class AttributeSet extends TreeView {
    set expressID(value) {
        this._expressID = value;
        this._attributes = [];
        this.slots.content.dispose(true);
    }
    get expressID() {
        return this._expressID;
    }
    constructor(components, propertiesProcessor, model, expressID) {
        super(components, "ATTRIBUTES");
        this.name = "AttributeSet";
        this.attributesToIgnore = [];
        this._expressID = 0;
        this._attributes = [];
        this._generated = false;
        this.model = model;
        this.expressID = expressID;
        this._propertiesProcessor = propertiesProcessor;
        this.onExpand.add(() => this.generate());
    }
    async dispose(onlyChildren = false) {
        await super.dispose(onlyChildren);
        this.model = null;
        this.attributesToIgnore = [];
        this._attributes = [];
        this._propertiesProcessor = null;
    }
    async generate() {
        if (this._generated || !this.model.hasProperties)
            return;
        await this.update();
        this._generated = true;
    }
    async update() {
        const entity = await this.model.getProperties(this.expressID);
        if (!entity)
            return;
        for (const attributeName in entity) {
            const ignore = this.attributesToIgnore.includes(attributeName);
            if (ignore)
                continue;
            const included = this._attributes.includes(attributeName);
            if (included) {
                // const tag = this.slots.content.children.find((child) => {
                //   if (!(child instanceof AttributeTag)) return false;
                //   return child.attributeName === attributeName;
                // }) as AttributeTag;
                // tag?.update();
            }
            else {
                const attribute = entity[attributeName];
                if (!attribute?.value)
                    continue; // in case there is an attribute without handle
                this._attributes.push(attributeName);
                const tag = new AttributeTag(this._components, this._propertiesProcessor, this.model, this.expressID, attributeName);
                this.addChild(tag);
            }
        }
    }
}
//# sourceMappingURL=attribute-set.js.map