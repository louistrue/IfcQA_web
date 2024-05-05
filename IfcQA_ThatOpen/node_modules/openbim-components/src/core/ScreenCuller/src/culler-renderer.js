import * as THREE from "three";
import { Component, Event } from "../../../base-types";
import { readPixelsAsync } from "./screen-culler-helper";
/**
 * A base renderer to determine visibility on screen
 */
export class CullerRenderer extends Component {
    constructor(components, settings) {
        super(components);
        /** {@link Disposable.onDisposed} */
        this.onDisposed = new Event();
        /**
         * Fires after making the visibility check to the meshes. It lists the
         * meshes that are currently visible, and the ones that were visible
         * just before but not anymore.
         */
        this.onViewUpdated = new Event();
        /** {@link Component.enabled} */
        this.enabled = true;
        /**
         * Needs to check whether there are objects that need to be hidden or shown.
         * You can bind this to the camera movement, to a certain interval, etc.
         */
        this.needsUpdate = false;
        /**
         * Render the internal scene used to determine the object visibility. Used
         * for debugging purposes.
         */
        this.renderDebugFrame = false;
        this._width = 512;
        this._height = 512;
        this.autoUpdate = true;
        this.updateInterval = 1000;
        this.scene = new THREE.Scene();
        this._availableColor = 1;
        /**
         * The function that the culler uses to reprocess the scene. Generally it's
         * better to call needsUpdate, but you can also call this to force it.
         * @param force if true, it will refresh the scene even if needsUpdate is
         * not true.
         */
        this.updateVisibility = async (force) => {
            if (!this.enabled)
                return;
            if (!this.needsUpdate && !force)
                return;
            const camera = this.components.camera.get();
            camera.updateMatrix();
            this.renderer.setSize(this._width, this._height);
            this.renderer.setRenderTarget(this.renderTarget);
            this.renderer.render(this.scene, camera);
            const context = this.renderer.getContext();
            await readPixelsAsync(context, 0, 0, this._width, this._height, context.RGBA, context.UNSIGNED_BYTE, this._buffer);
            this.renderer.setRenderTarget(null);
            if (this.renderDebugFrame) {
                this.renderer.render(this.scene, camera);
            }
            this.worker.postMessage({
                buffer: this._buffer,
            });
            this.needsUpdate = false;
        };
        this.applySettings(settings);
        this.renderer = new THREE.WebGLRenderer();
        const planes = this.components.renderer.clippingPlanes;
        this.renderer.clippingPlanes = planes;
        this.renderTarget = new THREE.WebGLRenderTarget(this._width, this._height);
        this.bufferSize = this._width * this._height * 4;
        this._buffer = new Uint8Array(this.bufferSize);
        const code = `
      addEventListener("message", (event) => {
        const { buffer } = event.data;
        const colors = new Map();
        for (let i = 0; i < buffer.length; i += 4) {
          const r = buffer[i];
          const g = buffer[i + 1];
          const b = buffer[i + 2];
          const code = "" + r + "-" + g + "-" + b;
          if(colors.has(code)) {
            colors.set(code, colors.get(code) + 1);
          } else {
            colors.set(code, 1);
          }
        }
        postMessage({ colors });
      });
    `;
        const blob = new Blob([code], { type: "application/javascript" });
        this.worker = new Worker(URL.createObjectURL(blob));
    }
    /**
     * {@link Component.get}.
     */
    get() {
        return this.renderer;
    }
    /** {@link Disposable.dispose} */
    async dispose() {
        this.enabled = false;
        for (const child of this.scene.children) {
            child.removeFromParent();
        }
        this.onViewUpdated.reset();
        this.worker.terminate();
        this.renderer.dispose();
        this.renderTarget.dispose();
        this._buffer = null;
        this.onDisposed.reset();
    }
    getAvailableColor() {
        // src: https://stackoverflow.com/a/67579485
        let bigOne = BigInt(this._availableColor.toString());
        const colorArray = [];
        do {
            colorArray.unshift(Number(bigOne % 256n));
            bigOne /= 256n;
        } while (bigOne);
        while (colorArray.length !== 3) {
            colorArray.unshift(0);
        }
        const [r, g, b] = colorArray;
        const code = `${r}-${g}-${b}`;
        return { r, g, b, code };
    }
    increaseColor() {
        if (this._availableColor === 256 * 256 * 256) {
            console.warn("Color can't be increased over 256 x 256 x 256!");
            return;
        }
        this._availableColor++;
    }
    decreaseColor() {
        if (this._availableColor === 1) {
            console.warn("Color can't be decreased under 0!");
            return;
        }
        this._availableColor--;
    }
    applySettings(settings) {
        if (settings) {
            if (settings.updateInterval !== undefined) {
                this.updateInterval = settings.updateInterval;
            }
            if (settings.height !== undefined) {
                this._height = settings.height;
            }
            if (settings.width !== undefined) {
                this._width = settings.width;
            }
            if (settings.autoUpdate !== undefined) {
                this.autoUpdate = settings.autoUpdate;
            }
        }
    }
}
//# sourceMappingURL=culler-renderer.js.map