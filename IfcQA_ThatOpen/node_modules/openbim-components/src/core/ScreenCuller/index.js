import { Component, Event } from "../../base-types";
import { ToolComponent } from "../ToolsComponent";
import { MeshCullerRenderer } from "./src";
/**
 * A tool to handle big scenes efficiently by automatically hiding the objects
 * that are not visible to the camera.
 */
export class ScreenCuller extends Component {
    /** {@link Component.enabled} */
    get enabled() {
        if (!this._elements) {
            return false;
        }
        return this.elements.enabled;
    }
    set enabled(value) {
        if (!this._elements) {
            return;
        }
        this.elements.enabled = value;
    }
    /** @deprecated use ScreenCuller.elements.onViewUpdated instead. */
    get onViewUpdated() {
        return this.elements.onViewUpdated;
    }
    /** @deprecated use ScreenCuller.elements.needsUpdate instead. */
    get needsUpdate() {
        return this.elements.needsUpdate;
    }
    /** @deprecated use ScreenCuller.elements.needsUpdate instead. */
    set needsUpdate(value) {
        this.elements.needsUpdate = value;
    }
    /** @deprecated use ScreenCuller.elements.renderDebugFrame instead. */
    get renderDebugFrame() {
        return this.elements.renderDebugFrame;
    }
    /** @deprecated use ScreenCuller.elements.renderDebugFrame instead. */
    set renderDebugFrame(value) {
        this.elements.renderDebugFrame = value;
    }
    get elements() {
        if (!this._elements) {
            throw new Error("Elements not initialized! Call ScreenCuller.setup() first");
        }
        return this._elements;
    }
    /** @deprecated use ScreenCuller.elements.get instead. */
    get renderer() {
        return this.elements.get();
    }
    constructor(components) {
        super(components);
        this.config = {
            updateInterval: 1000,
            width: 512,
            height: 512,
            autoUpdate: true,
        };
        this.isSetup = false;
        /** {@link Disposable.onDisposed} */
        this.onDisposed = new Event();
        this.onSetup = new Event();
        /**
         * @deprecated use ScreenCuller.elements.updateVisibility instead.
         */
        this.updateVisibility = async (force) => {
            await this.elements.updateVisibility(force);
        };
        components.tools.add(ScreenCuller.uuid, this);
    }
    async setup(config) {
        this._elements = new MeshCullerRenderer(this.components, config);
        this.elements.onViewUpdated.add(({ seen, unseen }) => {
            for (const mesh of seen) {
                mesh.visible = true;
            }
            for (const mesh of unseen) {
                mesh.visible = false;
            }
        });
        this.isSetup = true;
        await this.onSetup.trigger(this);
    }
    /**
     * {@link Component.get}.
     * @returns the map of internal meshes used to determine visibility.
     */
    get() {
        return this.elements.colorMeshes;
    }
    /** {@link Disposable.dispose} */
    async dispose() {
        this.enabled = false;
        await this.elements.dispose();
        await this.onDisposed.trigger(ScreenCuller.uuid);
        this.onDisposed.reset();
    }
    /**
     * @deprecated use ScreenCuller.elements.add instead.
     */
    add(mesh) {
        this.elements.add(mesh);
    }
}
ScreenCuller.uuid = "69f2a50d-c266-44fc-b1bd-fa4d34be89e6";
ToolComponent.libraryUUIDs.add(ScreenCuller.uuid);
//# sourceMappingURL=index.js.map