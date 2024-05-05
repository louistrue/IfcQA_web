import * as THREE from "three";
import { Component, Configurable, Disposable, Event } from "../../base-types";
import { Components } from "../Components";
import { MeshCullerRenderer, CullerRendererSettings } from "./src";
/**
 * A tool to handle big scenes efficiently by automatically hiding the objects
 * that are not visible to the camera.
 */
export declare class ScreenCuller extends Component<Map<string, THREE.InstancedMesh>> implements Disposable, Configurable<CullerRendererSettings> {
    static readonly uuid: "69f2a50d-c266-44fc-b1bd-fa4d34be89e6";
    config: Required<CullerRendererSettings>;
    isSetup: boolean;
    /** {@link Disposable.onDisposed} */
    readonly onDisposed: Event<string>;
    /** {@link Component.enabled} */
    get enabled(): boolean;
    set enabled(value: boolean);
    /** @deprecated use ScreenCuller.elements.onViewUpdated instead. */
    get onViewUpdated(): Event<{
        seen: Set<THREE.Mesh<THREE.BufferGeometry<THREE.NormalBufferAttributes>, THREE.Material | THREE.Material[], THREE.Object3DEventMap>>;
        unseen: Set<THREE.Mesh<THREE.BufferGeometry<THREE.NormalBufferAttributes>, THREE.Material | THREE.Material[], THREE.Object3DEventMap>>;
    }>;
    /** @deprecated use ScreenCuller.elements.needsUpdate instead. */
    get needsUpdate(): boolean;
    /** @deprecated use ScreenCuller.elements.needsUpdate instead. */
    set needsUpdate(value: boolean);
    /** @deprecated use ScreenCuller.elements.renderDebugFrame instead. */
    get renderDebugFrame(): boolean;
    /** @deprecated use ScreenCuller.elements.renderDebugFrame instead. */
    set renderDebugFrame(value: boolean);
    private _elements?;
    get elements(): MeshCullerRenderer;
    /** @deprecated use ScreenCuller.elements.get instead. */
    get renderer(): THREE.WebGLRenderer;
    constructor(components: Components);
    readonly onSetup: Event<ScreenCuller>;
    setup(config?: Partial<CullerRendererSettings>): Promise<void>;
    /**
     * {@link Component.get}.
     * @returns the map of internal meshes used to determine visibility.
     */
    get(): Map<string, THREE.InstancedMesh<THREE.BufferGeometry<THREE.NormalBufferAttributes>, THREE.Material | THREE.Material[]>>;
    /** {@link Disposable.dispose} */
    dispose(): Promise<void>;
    /**
     * @deprecated use ScreenCuller.elements.add instead.
     */
    add(mesh: THREE.Mesh | THREE.InstancedMesh): void;
    /**
     * @deprecated use ScreenCuller.elements.updateVisibility instead.
     */
    updateVisibility: (force?: boolean) => Promise<void>;
}
