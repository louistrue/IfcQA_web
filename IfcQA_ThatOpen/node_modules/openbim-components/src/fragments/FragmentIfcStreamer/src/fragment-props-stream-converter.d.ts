import * as WEBIFC from "web-ifc";
import { Component, Disposable, Event } from "../../../base-types";
import { PropertiesStreamingSettings } from "./streaming-settings";
export declare class FragmentPropsStreamConverter extends Component<WEBIFC.IfcAPI> implements Disposable {
    static readonly uuid: "88d2c89c-ce32-47d7-8cb6-d51e4b311a0b";
    onPropertiesStreamed: Event<{
        type: number;
        data: {
            [id: number]: any;
        };
    }>;
    onProgress: Event<number>;
    onIndicesStreamed: Event<number[][]>;
    /** {@link Disposable.onDisposed} */
    readonly onDisposed: Event<string>;
    enabled: boolean;
    settings: PropertiesStreamingSettings;
    private _webIfc;
    get(): WEBIFC.IfcAPI;
    dispose(): Promise<void>;
    streamFromBuffer(data: Uint8Array): Promise<void>;
    streamFromCallBack(loadCallback: WEBIFC.ModelLoadCallback): Promise<void>;
    private readIfcFile;
    private streamIfcFile;
    private streamAllProperties;
    private getIndices;
    private cleanUp;
}
