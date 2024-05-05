import * as WEBIFC from "web-ifc";
import { Disposable, Event, Component } from "../../../base-types";
import { Components } from "../../../core";
import { IfcStreamingSettings } from "./streaming-settings";
import { StreamedGeometries, StreamedAsset } from "./base-types";
export declare class FragmentIfcStreamConverter extends Component<WEBIFC.IfcAPI> implements Disposable {
    static readonly uuid: "d9999a00-e1f5-4d3f-8cfe-c56e08609764";
    onGeometryStreamed: Event<{
        buffer: Uint8Array;
        data: StreamedGeometries;
    }>;
    onAssetStreamed: Event<StreamedAsset[]>;
    onProgress: Event<number>;
    onIfcLoaded: Event<Uint8Array>;
    /** {@link Disposable.onDisposed} */
    readonly onDisposed: Event<string>;
    settings: IfcStreamingSettings;
    enabled: boolean;
    private _spatialTree;
    private _metaData;
    private _visitedGeometries;
    private _webIfc;
    private _streamSerializer;
    private _geometries;
    private _geometryCount;
    private _civil;
    private _groupSerializer;
    private _assets;
    private _meshesWithHoles;
    constructor(components: Components);
    get(): WEBIFC.IfcAPI;
    dispose(): Promise<void>;
    streamFromBuffer(data: Uint8Array): Promise<void>;
    streamFromCallBack(loadCallback: WEBIFC.ModelLoadCallback): Promise<void>;
    private readIfcFile;
    private streamIfcFile;
    private streamAllGeometries;
    private cleanUp;
    private getMesh;
    private getGeometry;
    private streamAssets;
    private streamGeometries;
}
