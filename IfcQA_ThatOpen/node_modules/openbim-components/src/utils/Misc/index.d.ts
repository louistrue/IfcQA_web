import { Fragment } from "bim-fragment";
import * as THREE from "three";
export declare function generateExpressIDFragmentIDMap(fragmentsList: Fragment[]): {
    [fragmentID: string]: Set<number>;
};
export declare function generateIfcGUID(): string;
export declare function bufferGeometryToIndexed(geometry: THREE.BufferGeometry): void;
export declare function isPointInFrontOfPlane(point: number[], planePoint: number[], planeNormal: number[]): boolean;
export declare function isTransparent(material: THREE.Material): boolean;
