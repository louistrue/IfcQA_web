import * as THREE from "three";
import { CullerRenderer, CullerRendererSettings } from "./culler-renderer";
import { Components } from "../../Components";
import { Event } from "../../../base-types";
/**
 * A renderer to determine a mesh visibility on screen
 */
export declare class MeshCullerRenderer extends CullerRenderer {
    threshold: number;
    readonly onViewUpdated: Event<{
        seen: Set<THREE.Mesh>;
        unseen: Set<THREE.Mesh>;
    }>;
    colorMeshes: Map<string, THREE.InstancedMesh<THREE.BufferGeometry<THREE.NormalBufferAttributes>, THREE.Material | THREE.Material[]>>;
    isProcessing: boolean;
    private _colorCodeMeshMap;
    private _meshIDColorCodeMap;
    private _currentVisibleMeshes;
    private _recentlyHiddenMeshes;
    private readonly _transparentMat;
    constructor(components: Components, settings?: CullerRendererSettings);
    dispose(): Promise<void>;
    add(mesh: THREE.Mesh | THREE.InstancedMesh): void;
    remove(mesh: THREE.Mesh | THREE.InstancedMesh): void;
    private handleWorkerMessage;
    private getAvailableMaterial;
}
