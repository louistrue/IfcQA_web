import * as WEBIFC from "web-ifc";
import * as THREE from "three";
import * as FRAGS from "bim-fragment";
import { Event, Component } from "../../../base-types";
import { ToolComponent } from "../../../core";
import { IfcStreamingSettings } from "./streaming-settings";
import { isPointInFrontOfPlane, obbFromPoints } from "../../../utils";
import { SpatialStructure } from "../../FragmentIfcLoader/src/spatial-structure";
import { CivilReader } from "../../FragmentIfcLoader/src/civil-reader";
import { IfcMetadataReader } from "../../FragmentIfcLoader/src/ifc-metadata-reader";
// TODO: Deduplicate with IfcFragmentLoader
export class FragmentIfcStreamConverter extends Component {
    constructor(components) {
        super(components);
        this.onGeometryStreamed = new Event();
        this.onAssetStreamed = new Event();
        this.onProgress = new Event();
        this.onIfcLoaded = new Event();
        /** {@link Disposable.onDisposed} */
        this.onDisposed = new Event();
        this.settings = new IfcStreamingSettings();
        this.enabled = true;
        this._spatialTree = new SpatialStructure();
        this._metaData = new IfcMetadataReader();
        this._visitedGeometries = new Map();
        this._webIfc = new WEBIFC.IfcAPI();
        this._streamSerializer = new FRAGS.StreamSerializer();
        this._geometries = new Map();
        this._geometryCount = 0;
        this._civil = new CivilReader();
        this._groupSerializer = new FRAGS.Serializer();
        this._assets = [];
        this._meshesWithHoles = new Set();
        this.components.tools.add(FragmentIfcStreamConverter.uuid, this);
        this.settings.excludedCategories.add(WEBIFC.IFCOPENINGELEMENT);
    }
    get() {
        return this._webIfc;
    }
    async dispose() {
        this.onIfcLoaded.reset();
        this.onGeometryStreamed.reset();
        this.onAssetStreamed.reset();
        this._webIfc = null;
        await this.onDisposed.trigger(FragmentIfcStreamConverter.uuid);
        this.onDisposed.reset();
    }
    async streamFromBuffer(data) {
        const before = performance.now();
        await this.readIfcFile(data);
        await this.streamAllGeometries();
        this.cleanUp();
        console.log(`Streaming the IFC took ${performance.now() - before} ms!`);
    }
    async streamFromCallBack(loadCallback) {
        const before = performance.now();
        await this.streamIfcFile(loadCallback);
        await this.streamAllGeometries();
        this.cleanUp();
        console.log(`Streaming the IFC took ${performance.now() - before} ms!`);
    }
    async readIfcFile(data) {
        const { path, absolute, logLevel } = this.settings.wasm;
        this._webIfc.SetWasmPath(path, absolute);
        await this._webIfc.Init();
        if (logLevel) {
            this._webIfc.SetLogLevel(logLevel);
        }
        this._webIfc.OpenModel(data, this.settings.webIfc);
    }
    async streamIfcFile(loadCallback) {
        const { path, absolute, logLevel } = this.settings.wasm;
        this._webIfc.SetWasmPath(path, absolute);
        await this._webIfc.Init();
        if (logLevel) {
            this._webIfc.SetLogLevel(logLevel);
        }
        this._webIfc.OpenModelFromCallback(loadCallback, this.settings.webIfc);
    }
    async streamAllGeometries() {
        const { minGeometrySize, minAssetsSize } = this.settings;
        // Precompute the level to which each item belongs
        this._spatialTree.setUp(this._webIfc);
        // Get all IFC objects and group them in chunks of specified size
        const allIfcEntities = this._webIfc.GetIfcEntityList(0);
        const chunks = [[]];
        const group = new FRAGS.FragmentsGroup();
        const { FILE_NAME, FILE_DESCRIPTION } = WEBIFC;
        group.ifcMetadata = {
            name: this._metaData.get(this._webIfc, FILE_NAME),
            description: this._metaData.get(this._webIfc, FILE_DESCRIPTION),
            schema: this._webIfc.GetModelSchema(0) || "IFC2X3",
            maxExpressID: this._webIfc.GetMaxExpressID(0),
        };
        let counter = 0;
        let index = 0;
        for (const type of allIfcEntities) {
            if (!this._webIfc.IsIfcElement(type) && type !== WEBIFC.IFCSPACE) {
                continue;
            }
            if (this.settings.excludedCategories.has(type)) {
                continue;
            }
            const result = this._webIfc.GetLineIDsWithType(0, type);
            const size = result.size();
            for (let i = 0; i < size; i++) {
                if (counter > minGeometrySize) {
                    counter = 0;
                    index++;
                    chunks.push([]);
                }
                const itemID = result.get(i);
                chunks[index].push(itemID);
                const level = this._spatialTree.itemsByFloor[itemID] || 0;
                group.data.set(itemID, [[], [level, type]]);
                counter++;
            }
        }
        this._spatialTree.cleanUp();
        let nextProgress = 0.01;
        let chunkCounter = 0;
        for (const chunk of chunks) {
            chunkCounter++;
            this._webIfc.StreamMeshes(0, chunk, (mesh) => {
                this.getMesh(this._webIfc, mesh, group);
            });
            if (this._geometryCount > minGeometrySize) {
                await this.streamGeometries();
            }
            if (this._assets.length > minAssetsSize) {
                await this.streamAssets();
            }
            const currentProgress = chunkCounter / chunks.length;
            if (currentProgress > nextProgress) {
                nextProgress += 0.01;
                nextProgress = Math.max(nextProgress, currentProgress);
                await this.onProgress.trigger(Math.round(nextProgress * 100) / 100);
            }
        }
        // Stream remaining assets and geometries
        if (this._geometryCount) {
            await this.streamGeometries();
        }
        if (this._assets.length) {
            await this.streamAssets();
        }
        const { opaque, transparent } = group.geometryIDs;
        for (const [id, { index, uuid }] of this._visitedGeometries) {
            group.keyFragments.set(index, uuid);
            const geometryID = id > 1 ? opaque : transparent;
            geometryID.set(id, index);
        }
        // Delete assets that have no geometric representation
        const ids = group.data.keys();
        for (const id of ids) {
            const [keys] = group.data.get(id);
            if (!keys.length) {
                group.data.delete(id);
            }
        }
        const matrix = this._webIfc.GetCoordinationMatrix(0);
        group.coordinationMatrix.fromArray(matrix);
        group.ifcCivil = this._civil.read(this._webIfc);
        const buffer = this._groupSerializer.export(group);
        await this.onIfcLoaded.trigger(buffer);
        group.dispose(true);
    }
    cleanUp() {
        this._webIfc = null;
        this._webIfc = new WEBIFC.IfcAPI();
        this._visitedGeometries.clear();
        this._geometries.clear();
        this._assets = [];
        this._meshesWithHoles.clear();
    }
    getMesh(webIfc, mesh, group) {
        const size = mesh.geometries.size();
        const id = mesh.expressID;
        const asset = { id, geometries: [] };
        if (mesh.expressID === 664833) {
            console.log("Heyyy");
        }
        for (let i = 0; i < size; i++) {
            const geometry = mesh.geometries.get(i);
            const geometryID = geometry.geometryExpressID;
            // Distinguish between opaque and transparent geometries
            const factor = geometry.color.w === 1 ? 1 : -1;
            const transpGeometryID = geometryID * factor;
            if (!this._visitedGeometries.has(transpGeometryID)) {
                if (!this._visitedGeometries.has(geometryID)) {
                    // This is the first time we see this geometry
                    this.getGeometry(webIfc, geometryID);
                }
                // Save geometry for fragment generation
                // separating transparent and opaque geometries
                const index = this._visitedGeometries.size;
                const uuid = THREE.MathUtils.generateUUID();
                this._visitedGeometries.set(transpGeometryID, { uuid, index });
            }
            const geometryData = this._visitedGeometries.get(transpGeometryID);
            if (geometryData === undefined) {
                throw new Error("Error getting geometry data for streaming!");
            }
            const data = group.data.get(id);
            if (!data) {
                throw new Error("Data not found!");
            }
            data[0].push(geometryData.index);
            const { x, y, z, w } = geometry.color;
            const color = [x, y, z, w];
            const transformation = geometry.flatTransformation;
            asset.geometries.push({ color, geometryID, transformation });
        }
        this._assets.push(asset);
    }
    getGeometry(webIfc, id) {
        const geometry = webIfc.GetGeometry(0, id);
        const index = webIfc.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());
        const vertexData = webIfc.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
        const position = new Float32Array(vertexData.length / 2);
        const normal = new Float32Array(vertexData.length / 2);
        for (let i = 0; i < vertexData.length; i += 6) {
            position[i / 2] = vertexData[i];
            position[i / 2 + 1] = vertexData[i + 1];
            position[i / 2 + 2] = vertexData[i + 2];
            normal[i / 2] = vertexData[i + 3];
            normal[i / 2 + 1] = vertexData[i + 4];
            normal[i / 2 + 2] = vertexData[i + 5];
        }
        // const bbox = makeApproxBoundingBox(position, index);
        const obb = obbFromPoints(position);
        const boundingBox = new Float32Array(obb.transformation.elements);
        // Simple hole test: see if all triangles are facing away the center
        // Using the vertex normal because it's easier
        // Geometries with holes are treated as transparent items
        // in the visibility test for geometry streaming
        // Not perfect, but it will work for most cases and all the times it fails
        // are false positives, so it's always on the safety side
        const centerArray = [obb.center.x, obb.center.y, obb.center.z];
        let hasHoles = false;
        for (let i = 0; i < position.length - 2; i += 3) {
            const x = position[i];
            const y = position[i + 1];
            const z = position[i + 2];
            const nx = normal[i];
            const ny = normal[i + 1];
            const nz = normal[i + 2];
            const pos = [x, y, z];
            const nor = [nx, ny, nz];
            if (isPointInFrontOfPlane(centerArray, pos, nor)) {
                hasHoles = true;
                break;
            }
        }
        this._geometries.set(id, {
            position,
            normal,
            index,
            boundingBox,
            hasHoles,
        });
        geometry.delete();
        this._geometryCount++;
    }
    async streamAssets() {
        await this.onAssetStreamed.trigger(this._assets);
        this._assets = null;
        this._assets = [];
    }
    async streamGeometries() {
        let buffer = this._streamSerializer.export(this._geometries);
        let data = {};
        for (const [id, { boundingBox, hasHoles }] of this._geometries) {
            data[id] = { boundingBox, hasHoles };
        }
        await this.onGeometryStreamed.trigger({ data, buffer });
        // Force memory disposal of all created items
        data = null;
        buffer = null;
        this._geometries.clear();
        this._geometryCount = 0;
    }
}
FragmentIfcStreamConverter.uuid = "d9999a00-e1f5-4d3f-8cfe-c56e08609764";
ToolComponent.libraryUUIDs.add(FragmentIfcStreamConverter.uuid);
//# sourceMappingURL=fragment-ifc-stream-converter.js.map