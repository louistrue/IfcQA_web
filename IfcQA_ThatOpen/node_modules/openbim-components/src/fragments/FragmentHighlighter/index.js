import * as THREE from "three";
import { Event, } from "../../base-types";
import { Component } from "../../base-types/component";
import { FragmentManager } from "../FragmentManager";
import { FragmentBoundingBox } from "../FragmentBoundingBox";
import { ToolComponent } from "../../core/ToolsComponent";
import { PostproductionRenderer } from "../../navigation/PostproductionRenderer";
export class FragmentHighlighter extends Component {
    get outlineEnabled() {
        return this._outlineEnabled;
    }
    set outlineEnabled(value) {
        this._outlineEnabled = value;
        if (!value) {
            delete this._postproduction.customEffects.outlinedMeshes.fragments;
        }
    }
    get _postproduction() {
        if (!(this.components.renderer instanceof PostproductionRenderer)) {
            throw new Error("Postproduction renderer is needed for outlines!");
        }
        const renderer = this.components.renderer;
        return renderer.postproduction;
    }
    constructor(components) {
        super(components);
        /** {@link Disposable.onDisposed} */
        this.onDisposed = new Event();
        /** {@link Updateable.onBeforeUpdate} */
        this.onBeforeUpdate = new Event();
        /** {@link Updateable.onAfterUpdate} */
        this.onAfterUpdate = new Event();
        this.needsUpdate = false;
        /** {@link Configurable.isSetup} */
        this.isSetup = false;
        this.enabled = true;
        this.highlightMats = {};
        this.events = {};
        this.multiple = "ctrlKey";
        this.zoomFactor = 1.5;
        this.zoomToSelection = false;
        this.selection = {};
        this.excludeOutline = new Set();
        this.fillEnabled = true;
        this.outlineMaterial = new THREE.MeshBasicMaterial({
            color: "white",
            transparent: true,
            depthTest: false,
            depthWrite: false,
            opacity: 0.4,
        });
        this._eventsActive = false;
        this._outlineEnabled = true;
        this._outlinedMeshes = {};
        this._invisibleMaterial = new THREE.MeshBasicMaterial({ visible: false });
        this._tempMatrix = new THREE.Matrix4();
        this.config = {
            selectName: "select",
            hoverName: "hover",
            selectionMaterial: new THREE.MeshBasicMaterial({
                color: "#BCF124",
                transparent: true,
                opacity: 0.85,
                depthTest: true,
            }),
            hoverMaterial: new THREE.MeshBasicMaterial({
                color: "#6528D7",
                transparent: true,
                opacity: 0.2,
                depthTest: true,
            }),
            autoHighlightOnClick: true,
            cullHighlightMeshes: true,
        };
        this._mouseState = {
            down: false,
            moved: false,
        };
        this.onFragmentsDisposed = (data) => {
            this.disposeOutlinedMeshes(data.fragmentIDs);
        };
        this.onSetup = new Event();
        this.onMouseDown = () => {
            if (!this.enabled)
                return;
            this._mouseState.down = true;
        };
        this.onMouseUp = async (event) => {
            if (!this.enabled)
                return;
            if (event.target !== this.components.renderer.get().domElement)
                return;
            this._mouseState.down = false;
            if (this._mouseState.moved || event.button !== 0) {
                this._mouseState.moved = false;
                return;
            }
            this._mouseState.moved = false;
            if (this.config.autoHighlightOnClick) {
                const mult = this.multiple === "none" ? true : !event[this.multiple];
                await this.highlight(this.config.selectName, mult, this.zoomToSelection);
            }
        };
        this.onMouseMove = async () => {
            if (!this.enabled)
                return;
            if (this._mouseState.moved) {
                await this.clearFills(this.config.hoverName);
                return;
            }
            this._mouseState.moved = this._mouseState.down;
            await this.highlight(this.config.hoverName, true, false);
        };
        this.components.tools.add(FragmentHighlighter.uuid, this);
        const fragmentManager = components.tools.get(FragmentManager);
        fragmentManager.onFragmentsDisposed.add(this.onFragmentsDisposed);
    }
    get() {
        return this.highlightMats;
    }
    getHoveredSelection() {
        return this.selection[this.config.hoverName];
    }
    disposeOutlinedMeshes(fragmentIDs) {
        for (const id of fragmentIDs) {
            const mesh = this._outlinedMeshes[id];
            if (!mesh)
                continue;
            mesh.geometry.dispose();
            delete this._outlinedMeshes[id];
        }
    }
    async dispose() {
        this.setupEvents(false);
        this.config.hoverMaterial.dispose();
        this.config.selectionMaterial.dispose();
        this.onBeforeUpdate.reset();
        this.onAfterUpdate.reset();
        for (const matID in this.highlightMats) {
            const mats = this.highlightMats[matID] || [];
            for (const mat of mats) {
                mat.dispose();
            }
        }
        this.disposeOutlinedMeshes(Object.keys(this._outlinedMeshes));
        this.outlineMaterial.dispose();
        this._invisibleMaterial.dispose();
        this.highlightMats = {};
        this.selection = {};
        for (const name in this.events) {
            this.events[name].onClear.reset();
            this.events[name].onHighlight.reset();
        }
        this.onSetup.reset();
        const fragmentManager = this.components.tools.get(FragmentManager);
        fragmentManager.onFragmentsDisposed.remove(this.onFragmentsDisposed);
        this.events = {};
        await this.onDisposed.trigger(FragmentHighlighter.uuid);
        this.onDisposed.reset();
    }
    async add(name, material) {
        if (this.highlightMats[name]) {
            throw new Error("A highlight with this name already exists.");
        }
        this.highlightMats[name] = material;
        this.selection[name] = {};
        this.events[name] = {
            onHighlight: new Event(),
            onClear: new Event(),
        };
        await this.updateHighlight();
    }
    async updateHighlight() {
        if (!this.fillEnabled) {
            return;
        }
        await this.onBeforeUpdate.trigger(this);
        const fragments = this.components.tools.get(FragmentManager);
        for (const fragmentID in fragments.list) {
            const fragment = fragments.list[fragmentID];
            this.addHighlightToFragment(fragment);
            const outlinedMesh = this._outlinedMeshes[fragmentID];
            if (outlinedMesh) {
                fragment.mesh.updateMatrixWorld(true);
                outlinedMesh.position.set(0, 0, 0);
                outlinedMesh.rotation.set(0, 0, 0);
                outlinedMesh.scale.set(1, 1, 1);
                outlinedMesh.applyMatrix4(fragment.mesh.matrixWorld);
            }
        }
        await this.onAfterUpdate.trigger(this);
    }
    async highlight(name, removePrevious = true, zoomToSelection = this.zoomToSelection) {
        if (!this.enabled)
            return null;
        this.checkSelection(name);
        const fragments = this.components.tools.get(FragmentManager);
        const fragList = [];
        const meshes = fragments.meshes;
        const result = this.components.raycaster.castRay(meshes);
        if (!result || !result.face) {
            await this.clear(name);
            return null;
        }
        const mesh = result.object;
        const geometry = mesh.geometry;
        const index = result.face.a;
        const instanceID = result.instanceId;
        if (!geometry || index === undefined || instanceID === undefined) {
            return null;
        }
        if (removePrevious) {
            await this.clear(name);
        }
        if (!this.selection[name][mesh.fragment.id]) {
            this.selection[name][mesh.fragment.id] = new Set();
        }
        fragList.push(mesh.fragment);
        const itemID = mesh.fragment.getItemID(instanceID);
        if (itemID === null) {
            throw new Error("Item ID not found!");
        }
        this.selection[name][mesh.fragment.id].add(itemID);
        await this.regenerate(name, mesh.fragment.id);
        const group = mesh.fragment.group;
        if (group) {
            const data = group.data.get(itemID);
            if (!data) {
                throw new Error("Data not found!");
            }
            const keys = data[0];
            for (let i = 0; i < keys.length; i++) {
                const fragKey = keys[i];
                const fragID = group.keyFragments.get(fragKey);
                if (!fragID) {
                    throw new Error("Fragment ID not found!");
                }
                if (fragID === mesh.fragment.id)
                    continue;
                const fragment = fragments.list[fragID];
                fragList.push(fragment);
                if (!this.selection[name][fragID]) {
                    this.selection[name][fragID] = new Set();
                }
                this.selection[name][fragID].add(itemID);
                await this.regenerate(name, fragID);
            }
        }
        await this.events[name].onHighlight.trigger(this.selection[name]);
        if (zoomToSelection) {
            await this.zoomSelection(name);
        }
        return { id: itemID, fragments: fragList };
    }
    async highlightByID(name, ids, removePrevious = true, zoomToSelection = this.zoomToSelection) {
        if (!this.enabled)
            return;
        if (removePrevious) {
            await this.clear(name);
        }
        const styles = this.selection[name];
        for (const fragID in ids) {
            if (!styles[fragID]) {
                styles[fragID] = new Set();
            }
            for (const id of ids[fragID]) {
                styles[fragID].add(id);
            }
            await this.regenerate(name, fragID);
        }
        await this.events[name].onHighlight.trigger(this.selection[name]);
        if (zoomToSelection) {
            await this.zoomSelection(name);
        }
    }
    /**
     * Clears any selection previously made by calling {@link highlight}.
     */
    async clear(name) {
        await this.clearFills(name);
        if (!name || !this.excludeOutline.has(name)) {
            await this.clearOutlines();
        }
    }
    async setup(config) {
        if (config?.selectionMaterial) {
            this.config.selectionMaterial.dispose();
        }
        if (config?.hoverMaterial) {
            this.config.hoverMaterial.dispose();
        }
        this.config = { ...this.config, ...config };
        this.outlineMaterial.color.set(0xf0ff7a);
        this.excludeOutline.add(this.config.hoverName);
        await this.add(this.config.selectName, [this.config.selectionMaterial]);
        await this.add(this.config.hoverName, [this.config.hoverMaterial]);
        this.setupEvents(true);
        this.enabled = true;
        this.isSetup = true;
        await this.onSetup.trigger(this);
    }
    async regenerate(name, fragID) {
        if (this.fillEnabled) {
            await this.updateFragmentFill(name, fragID);
        }
        if (this._outlineEnabled) {
            await this.updateFragmentOutline(name, fragID);
        }
    }
    async zoomSelection(name) {
        if (!this.fillEnabled && !this._outlineEnabled) {
            return;
        }
        const bbox = this.components.tools.get(FragmentBoundingBox);
        const fragments = this.components.tools.get(FragmentManager);
        bbox.reset();
        const selected = this.selection[name];
        if (!Object.keys(selected).length) {
            return;
        }
        for (const fragID in selected) {
            const fragment = fragments.list[fragID];
            if (this.fillEnabled) {
                const highlight = fragment.fragments[name];
                if (highlight) {
                    bbox.addMesh(highlight.mesh);
                }
            }
            if (this._outlineEnabled && this._outlinedMeshes[fragID]) {
                bbox.addMesh(this._outlinedMeshes[fragID]);
            }
        }
        const sphere = bbox.getSphere();
        const i = Infinity;
        const mi = -Infinity;
        const { x, y, z } = sphere.center;
        const isInf = sphere.radius === i || x === i || y === i || z === i;
        const isMInf = sphere.radius === mi || x === mi || y === mi || z === mi;
        const isZero = sphere.radius === 0;
        if (isInf || isMInf || isZero) {
            return;
        }
        sphere.radius *= this.zoomFactor;
        const camera = this.components.camera;
        await camera.controls.fitToSphere(sphere, true);
    }
    async clearStyle(name) {
        const fragments = this.components.tools.get(FragmentManager);
        for (const fragID in this.selection[name]) {
            const fragment = fragments.list[fragID];
            if (!fragment)
                continue;
            const selection = fragment.fragments[name];
            if (selection) {
                selection.mesh.removeFromParent();
            }
        }
        await this.events[name].onClear.trigger(null);
        this.selection[name] = {};
    }
    async updateFragmentFill(name, fragmentID) {
        const fragments = this.components.tools.get(FragmentManager);
        const ids = this.selection[name][fragmentID];
        const fragment = fragments.list[fragmentID];
        if (!fragment)
            return;
        const selection = fragment.fragments[name];
        if (!selection)
            return;
        const fragmentParent = fragment.mesh.parent;
        if (!fragmentParent)
            return;
        fragmentParent.add(selection.mesh);
        selection.setVisibility(false);
        selection.setVisibility(true, ids);
    }
    checkSelection(name) {
        if (!this.selection[name]) {
            throw new Error(`Selection ${name} does not exist.`);
        }
    }
    addHighlightToFragment(fragment) {
        for (const name in this.highlightMats) {
            if (!fragment.fragments[name]) {
                const material = this.highlightMats[name];
                const subFragment = fragment.addFragment(name, material);
                subFragment.group = fragment.group;
                subFragment.mesh.renderOrder = 2;
                subFragment.mesh.frustumCulled = false;
            }
        }
    }
    async clearFills(name) {
        const names = name ? [name] : Object.keys(this.selection);
        for (const name of names) {
            await this.clearStyle(name);
        }
    }
    async clearOutlines() {
        const effects = this._postproduction.customEffects;
        const fragmentsOutline = effects.outlinedMeshes.fragments;
        if (fragmentsOutline) {
            fragmentsOutline.meshes.clear();
        }
        for (const fragID in this._outlinedMeshes) {
            const mesh = this._outlinedMeshes[fragID];
            mesh.count = 0;
        }
    }
    async updateFragmentOutline(name, fragmentID) {
        const fragments = this.components.tools.get(FragmentManager);
        if (!this.selection[name][fragmentID]) {
            return;
        }
        if (this.excludeOutline.has(name)) {
            return;
        }
        const ids = this.selection[name][fragmentID];
        const fragment = fragments.list[fragmentID];
        if (!fragment)
            return;
        const geometry = fragment.mesh.geometry;
        const customEffects = this._postproduction.customEffects;
        if (!customEffects.outlinedMeshes.fragments) {
            customEffects.outlinedMeshes.fragments = {
                meshes: new Set(),
                material: this.outlineMaterial,
            };
        }
        const outlineEffect = customEffects.outlinedMeshes.fragments;
        // Create a copy of the original fragment mesh for outline
        if (!this._outlinedMeshes[fragmentID]) {
            const newGeometry = new THREE.BufferGeometry();
            newGeometry.attributes = geometry.attributes;
            newGeometry.index = geometry.index;
            const newMesh = new THREE.InstancedMesh(newGeometry, this._invisibleMaterial, fragment.capacity);
            newMesh.frustumCulled = false;
            newMesh.renderOrder = 999;
            fragment.mesh.updateMatrixWorld(true);
            newMesh.applyMatrix4(fragment.mesh.matrixWorld);
            this._outlinedMeshes[fragmentID] = newMesh;
            const scene = this.components.scene.get();
            scene.add(newMesh);
        }
        const outlineMesh = this._outlinedMeshes[fragmentID];
        outlineEffect.meshes.add(outlineMesh);
        let counter = 0;
        for (const id of ids) {
            const instancesIDs = fragment.getInstancesIDs(id);
            if (!instancesIDs) {
                throw new Error("Instances IDs not found!");
            }
            for (const instance of instancesIDs) {
                fragment.mesh.getMatrixAt(instance, this._tempMatrix);
                outlineMesh.setMatrixAt(counter++, this._tempMatrix);
            }
        }
        outlineMesh.count = counter;
        outlineMesh.instanceMatrix.needsUpdate = true;
    }
    setupEvents(active) {
        const container = this.components.renderer.get().domElement;
        if (active === this._eventsActive) {
            return;
        }
        this._eventsActive = active;
        if (active) {
            container.addEventListener("mousedown", this.onMouseDown);
            container.addEventListener("mouseup", this.onMouseUp);
            container.addEventListener("mousemove", this.onMouseMove);
        }
        else {
            container.removeEventListener("mousedown", this.onMouseDown);
            container.removeEventListener("mouseup", this.onMouseUp);
            container.removeEventListener("mousemove", this.onMouseMove);
        }
    }
}
FragmentHighlighter.uuid = "cb8a76f2-654a-4b50-80c6-66fd83cafd77";
ToolComponent.libraryUUIDs.add(FragmentHighlighter.uuid);
//# sourceMappingURL=index.js.map