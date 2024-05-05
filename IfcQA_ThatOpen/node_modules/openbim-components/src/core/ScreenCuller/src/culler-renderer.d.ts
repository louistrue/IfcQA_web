import * as THREE from "three";
import { Component, Event } from "../../../base-types";
import { Components } from "../../Components";
export interface CullerRendererSettings {
    updateInterval?: number;
    width?: number;
    height?: number;
    autoUpdate?: boolean;
}
/**
 * A base renderer to determine visibility on screen
 */
export declare class CullerRenderer extends Component<THREE.WebGLRenderer> {
    /** {@link Disposable.onDisposed} */
    readonly onDisposed: Event<string>;
    /**
     * Fires after making the visibility check to the meshes. It lists the
     * meshes that are currently visible, and the ones that were visible
     * just before but not anymore.
     */
    readonly onViewUpdated: Event<any>;
    /** {@link Component.enabled} */
    enabled: boolean;
    /**
     * Needs to check whether there are objects that need to be hidden or shown.
     * You can bind this to the camera movement, to a certain interval, etc.
     */
    needsUpdate: boolean;
    /**
     * Render the internal scene used to determine the object visibility. Used
     * for debugging purposes.
     */
    renderDebugFrame: boolean;
    private _width;
    private _height;
    protected autoUpdate: boolean;
    protected updateInterval: number;
    protected readonly worker: Worker;
    protected readonly renderer: THREE.WebGLRenderer;
    private readonly renderTarget;
    protected readonly scene: THREE.Scene;
    private readonly bufferSize;
    private _availableColor;
    private readonly _buffer;
    constructor(components: Components, settings?: CullerRendererSettings);
    /**
     * {@link Component.get}.
     */
    get(): THREE.WebGLRenderer;
    /** {@link Disposable.dispose} */
    dispose(): Promise<void>;
    /**
     * The function that the culler uses to reprocess the scene. Generally it's
     * better to call needsUpdate, but you can also call this to force it.
     * @param force if true, it will refresh the scene even if needsUpdate is
     * not true.
     */
    updateVisibility: (force?: boolean) => Promise<void>;
    protected getAvailableColor(): {
        r: number;
        g: number;
        b: number;
        code: string;
    };
    protected increaseColor(): void;
    protected decreaseColor(): void;
    private applySettings;
}
