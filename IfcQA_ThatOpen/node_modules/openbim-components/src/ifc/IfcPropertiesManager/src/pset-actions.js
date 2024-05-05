import { SimpleUIComponent, TextInput, Dropdown, Button } from "../../../ui";
import { Event } from "../../../base-types";
import { Modal } from "../../../ui/Modal";
export class PsetActionsUI extends SimpleUIComponent {
    constructor(components) {
        super(components, `<div class="flex"></div>`);
        this.modalVisible = false;
        this.onEditPset = new Event();
        this.onRemovePset = new Event();
        this.onNewProp = new Event();
        this.data = {};
        this._modal = new Modal(components, "New Property Set");
        this._components.ui.add(this._modal);
        this._modal.visible = false;
        this._modal.onHidden.add(() => this.removeFromParent());
        this._modal.onCancel.add(() => {
            this._modal.visible = false;
            this._modal.slots.content.dispose(true);
        });
        this.editPsetBtn = new Button(this._components);
        this.editPsetBtn.materialIcon = "edit";
        this.editPsetBtn.onClick.add(() => this.setEditUI());
        this.removePsetBtn = new Button(this._components);
        this.removePsetBtn.materialIcon = "delete";
        this.removePsetBtn.onClick.add(() => this.setRemoveUI());
        this.addPropBtn = new Button(this._components);
        this.addPropBtn.materialIcon = "add";
        this.addPropBtn.onClick.add(() => this.setAddPropUI());
        this.addChild(this.addPropBtn, this.editPsetBtn, this.removePsetBtn);
    }
    async dispose(onlyChildren = false) {
        await super.dispose(onlyChildren);
        await this.editPsetBtn.dispose();
        await this.removePsetBtn.dispose();
        await this.addPropBtn.dispose();
        await this._modal.dispose();
        this.onEditPset.reset();
        this.onRemovePset.reset();
        this.onNewProp.reset();
        this.data = {};
    }
    async setEditUI() {
        const { model, psetID } = this.data;
        if (!model || !psetID || !model.hasProperties)
            return;
        const entity = await model.getProperties(psetID);
        if (!entity)
            return;
        this._modal.onAccept.reset();
        this._modal.title = "Edit Property Set";
        const editUI = new SimpleUIComponent(this._components, `<div class="flex flex-col gap-y-4 p-4 overflow-auto"></div>`);
        const nameInput = new TextInput(this._components);
        nameInput.label = "Name";
        const descriptionInput = new TextInput(this._components);
        descriptionInput.label = "Description";
        this._modal.onAccept.add(async () => {
            this._modal.visible = false;
            await this.onEditPset.trigger({
                model,
                psetID,
                name: nameInput.value,
                description: descriptionInput.value,
            });
        });
        editUI.addChild(nameInput, descriptionInput);
        nameInput.value = entity.Name?.value ?? "";
        descriptionInput.value = entity.Description?.value ?? "";
        this._modal.setSlot("content", editUI);
        this._modal.visible = true;
    }
    setRemoveUI() {
        const { model, psetID } = this.data;
        if (!model || !psetID)
            return;
        this._modal.onAccept.reset();
        this._modal.title = "Remove Property Set";
        const removeUI = new SimpleUIComponent(this._components, `<div class="flex flex-col gap-y-4 p-4 overflow-auto"></div>`);
        const warningText = document.createElement("div");
        warningText.className = "text-base text-center";
        warningText.textContent =
            "Are you sure to delete this property set? This action can't be undone.";
        removeUI.get().append(warningText);
        this._modal.onAccept.add(async () => {
            this._modal.visible = false;
            this.removeFromParent(); // As the psetUI is going to be disposed, then we need to first remove the action buttons so they do not become disposed as well.
            await this.onRemovePset.trigger({ model, psetID });
        });
        this._modal.setSlot("content", removeUI);
        this._modal.visible = true;
    }
    setAddPropUI() {
        const { model, psetID } = this.data;
        if (!model || !psetID)
            return;
        this._modal.onAccept.reset();
        this._modal.title = "New Property";
        const addPropUI = new SimpleUIComponent(this._components, `<div class="flex flex-col gap-y-4 p-4 overflow-auto"></div>`);
        const nameInput = new TextInput(this._components);
        nameInput.label = "Name";
        const typeInput = new Dropdown(this._components);
        typeInput.label = "Type";
        typeInput.addOption("IfcText", "IfcLabel", "IfcIdentifier");
        typeInput.value = "IfcText";
        const valueInput = new TextInput(this._components);
        valueInput.label = "Value";
        this._modal.onAccept.add(async () => {
            this._modal.visible = false;
            const name = nameInput.value;
            const type = typeInput.value;
            if (name === "" || !type)
                return;
            await this.onNewProp.trigger({
                model,
                psetID,
                name,
                type,
                value: valueInput.value,
            });
        });
        addPropUI.addChild(nameInput, typeInput, valueInput);
        this._modal.setSlot("content", addPropUI);
        this._modal.visible = true;
    }
}
//# sourceMappingURL=pset-actions.js.map